// The invasion battle state machine (Epoch 2 skeleton §4.6, §5.1; GDD §8.6.2, §8.6.6, §8.6.7).
// Every mutating function operates on an Immer draft. Battles start from the movement step the
// first tick a leg advances toward a region a hostile Task Force is in, run one round per tick,
// and stay on GameState afterwards as the Battle Log.

import { isPermissive } from '../formulas/domainControl'
import { formatInt } from '../format'
import { log } from '../log'
import { factionRelation } from '../relations'
import { nextRandom } from '../rng'
import type { Battle, BattleOutcome, BattleSide, FactionId, GameState, LandRegion, RegionId, TaskForce } from '../types'
import { isLand, LINE_SLOTS } from '../types'
import {
  CONSOLIDATION_STABILITY,
  columnFor,
  defenseMultiplier,
  destructionChance,
  engagementChances,
  inverseCostWeights,
  lineStats,
  manpowerFraction,
  maxOrganization,
  ORG_REGEN_PER_TICK,
  organization,
  partisanBonus,
  pierceMultiplier,
  REINFORCE_PERCENT,
  SHOCK_TICKS,
  shockMultiplier,
  SURRENDER_EQUIPMENT_SHARE,
  unitOrganization,
} from './combat'
import { designStats, findDuplicate } from './design'
import { deleteTaskForce, findTaskForce } from './taskForce'

export function activeBattles(state: GameState): Battle[] {
  return state.battles.filter((b) => b.endedAt === null)
}

/** The live battle this Task Force is fighting, on either side. */
export function battleFor(state: GameState, tfId: number): Battle | undefined {
  return activeBattles(state).find((b) => b.attacker.taskForceId === tfId || b.defender.taskForceId === tfId)
}

function costKey(faction: FactionId, designId: number): string {
  return `${faction}|${designId}`
}

/** Build a side from the Task Force's plan: eligible slots take the planned design, the rest wait in Reserves. */
function makeSide(tf: TaskForce): BattleSide {
  const available: Record<string, number> = {}
  for (const line of tf.composition) if (line.equipment > 0) available[line.designId] = line.equipment
  const frontLine: (number | null)[] = Array<number | null>(LINE_SLOTS.frontLine).fill(null)
  tf.lines.frontLine.forEach((designId, i) => {
    if (designId !== null && (available[designId] ?? 0) > 0) {
      frontLine[i] = designId
      available[designId] -= 1
    }
  })
  const reserves: Record<string, number> = {}
  for (const [id, n] of Object.entries(available)) if (n > 0) reserves[id] = n
  return {
    taskForceId: tf.id,
    faction: tf.faction,
    name: tf.name,
    frontLine,
    reserves,
    unitsLost: {},
    manpowerLost: 0,
    hitsLanded: 0,
  }
}

/** Start an invasion: `attacker` is moving into `defender`'s region. Returns the battle. */
export function startBattle(state: GameState, attacker: TaskForce, defender: TaskForce): Battle {
  const costs: Record<string, number> = {}
  for (const tf of [attacker, defender]) {
    for (const line of tf.composition) {
      const ls = lineStats(state, tf, line.designId)
      if (ls) costs[costKey(tf.faction, line.designId)] = ls.stats.cost
    }
  }
  const side = makeSide(attacker)
  // Shock (GDD §8.6.2): only a Ready attacker gets it; magnitude from the initial Front Line's average Combat Speed.
  let shock: Battle['shock'] = null
  if (attacker.shock === 'ready') {
    // Average Combat Speed of the initial Front Line; an unplanned line (filled by reinforcement) falls
    // back to every unit in the force. A Task Force with nothing to fight with simply gets no Shock.
    let speeds = side.frontLine
      .filter((id): id is number => id !== null)
      .map((id) => lineStats(state, attacker, id)?.stats.speed.combat ?? 0)
    if (speeds.length === 0) {
      speeds = attacker.composition.flatMap((line) => {
        const ls = lineStats(state, attacker, line.designId)
        return ls ? Array<number>(line.equipment).fill(ls.stats.speed.combat) : []
      })
    }
    const average = speeds.length > 0 ? speeds.reduce((s, v) => s + v, 0) / speeds.length : 0
    if (average > 0) shock = { multiplier: shockMultiplier(average), until: state.tick + SHOCK_TICKS }
  }
  attacker.shock = 'planning'
  const battle: Battle = {
    id: state.nextBattleId++,
    regionId: defender.regionId,
    startedAt: state.tick,
    endedAt: null,
    outcome: null,
    attacker: side,
    defender: makeSide(defender),
    shock,
    costs,
  }
  state.battles.push(battle)
  attacker.lastInvasionCombatTick = state.tick
  defender.lastInvasionCombatTick = state.tick
  log(
    state,
    'military',
    `${attacker.name} invades ${state.regions[defender.regionId].name}, defended by ${defender.name}${shock ? ` — Shock ×${shock.multiplier.toFixed(1)}` : ' — no Shock (still Planning)'}`,
  )
  return battle
}

interface Hit {
  damage: number
  piercing: number
}

/** A unit's attack value against a target platform, with the side's modifiers. */
function attackValue(
  state: GameState,
  tf: TaskForce,
  designId: number,
  targetDesignId: number,
  targetTf: TaskForce,
  mods: { multiplier: number; bonus: number },
): { value: number; damage: number; piercing: number } {
  const ls = lineStats(state, tf, designId)
  const target = lineStats(state, targetTf, targetDesignId)
  if (!ls || !target) return { value: 0, damage: 0, piercing: 0 }
  const fraction = manpowerFraction(ls.line, ls.stats)
  const raw = ls.stats.vector[columnFor(target.design.platform)].short
  const value = raw > 0 ? (raw + mods.bonus) * mods.multiplier * fraction : 0
  return { value, damage: ls.stats.damage * mods.multiplier * fraction, piercing: ls.stats.piercing }
}

/** Remove one unit from a Task Force line: casualties for its Manpower share, Equipment gone. */
function destroyUnit(state: GameState, tf: TaskForce, designId: number, side: BattleSide): void {
  const ls = lineStats(state, tf, designId)
  if (!ls) return
  const fraction = manpowerFraction(ls.line, ls.stats)
  const casualties = Math.round(ls.stats.manpower * fraction)
  ls.line.equipment -= 1
  ls.line.manpower = Math.max(0, ls.line.manpower - casualties)
  side.unitsLost[designId] = (side.unitsLost[designId] ?? 0) + 1
  side.manpowerLost += casualties
  // The destroyed unit's Organization leaves with the maximum; don't also count it as lost.
  tf.organizationLost = Math.min(tf.organizationLost, maxOrganization(state, tf))
}

/** Resolve one side's collected hits against the other side's Front Line (§5.1). */
function applyHits(state: GameState, hits: Hit[], target: TaskForce, targetSide: BattleSide, battle: Battle): void {
  for (const hit of hits) {
    const occupied = targetSide.frontLine
      .map((id, i) => ({ id, i }))
      .filter((s): s is { id: number; i: number } => s.id !== null)
    if (occupied.length === 0) return
    const weights = inverseCostWeights(occupied.map((s) => battle.costs[costKey(target.faction, s.id)] ?? 1))
    let roll = nextRandom(state)
    let pick = occupied[occupied.length - 1]
    for (let k = 0; k < occupied.length; k++) {
      roll -= weights[k]
      if (roll < 0) {
        pick = occupied[k]
        break
      }
    }
    const ls = lineStats(state, target, pick.id)
    if (!ls) continue
    const damage = hit.damage * pierceMultiplier(hit.piercing, ls.stats.armor)
    targetSide.frontLine[pick.i] = null
    if (nextRandom(state) < destructionChance(damage, ls.stats.health)) {
      destroyUnit(state, target, pick.id, targetSide)
    } else {
      // Pushed off the line into Reserves; the Organization cost lands either way.
      targetSide.reserves[pick.id] = (targetSide.reserves[pick.id] ?? 0) + 1
      target.organizationLost += unitOrganization(ls.line, ls.stats)
    }
  }
}

/** Each empty slot rolls to pull a random Reserve unit up (§5.1 reinforcement). */
function reinforce(state: GameState, side: BattleSide): void {
  for (let i = 0; i < side.frontLine.length; i++) {
    if (side.frontLine[i] !== null) continue
    const pool = Object.entries(side.reserves).filter(([, n]) => n > 0)
    const total = pool.reduce((s, [, n]) => s + n, 0)
    if (total === 0) return
    if (nextRandom(state) * 100 >= REINFORCE_PERCENT) continue
    let roll = nextRandom(state) * total
    for (const [id, n] of pool) {
      roll -= n
      if (roll < 0) {
        side.frontLine[i] = Number(id)
        side.reserves[id] = n - 1
        break
      }
    }
  }
}

function unitsRemaining(side: BattleSide): number {
  return side.frontLine.filter((id) => id !== null).length + Object.values(side.reserves).reduce((s, n) => s + n, 0)
}

/** The three loss conditions (§5.1): Org at zero, everything destroyed, or an empty line with no Reserves. */
function hasLost(state: GameState, tf: TaskForce, side: BattleSide): boolean {
  if (organization(state, tf) <= 0) return true
  if (unitsRemaining(side) === 0) return true
  const lineEmpty = side.frontLine.every((id) => id === null)
  const reservesEmpty = Object.values(side.reserves).every((n) => n <= 0)
  return lineEmpty && reservesEmpty
}

/** One round of Front Line combat for every live battle, then outcomes. */
export function resolveBattles(state: GameState): void {
  for (const battle of activeBattles(state)) {
    const attacker = findTaskForce(state, battle.attacker.taskForceId)
    const defender = findTaskForce(state, battle.defender.taskForceId)
    if (!attacker || !defender) {
      endBattle(state, battle, attacker ? 'attacker-won' : 'defender-won')
      continue
    }
    // Either side leaving ends it: the attacker redirected (or is walking back), the defender moved out.
    if (!attacker.movement || attacker.movement.backtrack > 0 || attacker.movement.legs[0] !== battle.regionId) {
      endBattle(state, battle, 'attacker-withdrew')
      continue
    }
    if (defender.regionId !== battle.regionId) {
      endBattle(state, battle, 'defender-withdrew')
      continue
    }
    attacker.lastInvasionCombatTick = state.tick
    defender.lastInvasionCombatTick = state.tick

    const region = state.regions[battle.regionId] as LandRegion
    const shockOn = battle.shock !== null && state.tick <= battle.shock.until
    const attackMods = { multiplier: shockOn ? battle.shock!.multiplier : 1, bonus: partisanBonus(region.stability) }
    const defendMods = { multiplier: defenseMultiplier(region), bonus: 0 }

    const attackerHits: Hit[] = []
    const defenderHits: Hit[] = []
    const aLine = battle.attacker.frontLine
    const dLine = battle.defender.frontLine
    const nearest = (line: (number | null)[]) => line.find((id) => id !== null) ?? null
    for (let i = 0; i < LINE_SLOTS.frontLine; i++) {
      const a = aLine[i]
      const d = dLine[i]
      if (a !== null && d !== null) {
        const av = attackValue(state, attacker, a, d, defender, attackMods)
        const dv = attackValue(state, defender, d, a, attacker, defendMods)
        const chances = engagementChances(av.value, dv.value)
        const roll = nextRandom(state) * 100
        if (roll < chances.attacker) attackerHits.push({ damage: av.damage, piercing: av.piercing })
        else if (roll < chances.attacker + chances.defender)
          defenderHits.push({ damage: dv.damage, piercing: dv.piercing })
      } else if (a !== null) {
        // Flanking (§5.1): unopposed baseline roll against the nearest enemy front-line unit.
        const target = nearest(dLine)
        if (target !== null) {
          const av = attackValue(state, attacker, a, target, defender, attackMods)
          if (av.value > 0 && nextRandom(state) * 100 < 5)
            attackerHits.push({ damage: av.damage, piercing: av.piercing })
        }
      } else if (d !== null) {
        const target = nearest(aLine)
        if (target !== null) {
          const dv = attackValue(state, defender, d, target, attacker, defendMods)
          if (dv.value > 0 && nextRandom(state) * 100 < 5)
            defenderHits.push({ damage: dv.damage, piercing: dv.piercing })
        }
      }
    }
    battle.attacker.hitsLanded += attackerHits.length
    battle.defender.hitsLanded += defenderHits.length
    applyHits(state, attackerHits, defender, battle.defender, battle)
    applyHits(state, defenderHits, attacker, battle.attacker, battle)
    reinforce(state, battle.attacker)
    reinforce(state, battle.defender)

    const attackerLost = hasLost(state, attacker, battle.attacker)
    const defenderLost = hasLost(state, defender, battle.defender)
    // Both breaking on the same tick: the defender holds (decisions doc).
    if (attackerLost) endBattle(state, battle, 'defender-won')
    else if (defenderLost)
      endBattle(state, battle, defenderRetreatTarget(state, defender) ? 'attacker-won' : 'defender-surrendered')
  }
}

/** Where a beaten defender falls back: own territory first, then Friendly, then anywhere not hostile (GDD §8.6.6). */
export function defenderRetreatTarget(state: GameState, tf: TaskForce): RegionId | null {
  const options = state.adjacency[tf.regionId]
    .map((id) => state.regions[id])
    .filter((r) => isLand(r) && isPermissive(state, tf.faction, r))
    .filter(
      (r) =>
        !state.taskForces.some(
          (t) => t.regionId === r.id && factionRelation(state, tf.faction, t.faction) === 'hostile',
        ),
    )
  const rank = (r: LandRegion) =>
    r.controller === tf.faction
      ? 0
      : r.controller && factionRelation(state, tf.faction, r.controller) === 'friendly'
        ? 1
        : 2
  return (options as LandRegion[]).sort((a, b) => rank(a) - rank(b))[0]?.id ?? null
}

function endBattle(state: GameState, battle: Battle, outcome: BattleOutcome): void {
  battle.endedAt = state.tick
  battle.outcome = outcome
  const attacker = findTaskForce(state, battle.attacker.taskForceId)
  const defender = findTaskForce(state, battle.defender.taskForceId)
  const region = state.regions[battle.regionId]
  switch (outcome) {
    case 'defender-won':
      if (attacker?.movement) {
        // Beaten: the transit clock's progress is owed back at Combat Speed (§4.6).
        attacker.movement = {
          legs: [],
          progress: 0,
          backtrack: attacker.movement.backtrack + attacker.movement.progress,
          returnFrom: battle.regionId,
        }
      }
      log(state, 'military', `${battle.defender.name} holds ${region.name}; ${battle.attacker.name} falls back`)
      break
    case 'attacker-won': {
      const to = defender ? defenderRetreatTarget(state, defender) : null
      if (defender && to) {
        defender.regionId = to
        defender.movement = null
        log(
          state,
          'military',
          `${battle.defender.name} breaks and retreats from ${region.name} to ${state.regions[to].name}`,
        )
      }
      break
    }
    case 'defender-surrendered':
      if (defender && attacker) seizeEquipment(state, defender, attacker)
      if (defender) deleteTaskForce(state, defender.id)
      log(state, 'military', `${battle.defender.name} is surrounded in ${region.name} and surrenders`)
      break
    case 'attacker-withdrew':
      log(state, 'military', `${battle.attacker.name} breaks off the attack on ${region.name}`)
      break
    case 'defender-withdrew':
      log(
        state,
        'military',
        `${battle.defender.name} withdraws from ${region.name}; ${battle.attacker.name} presses on`,
      )
      break
  }
}

/** The victor converts a share of a surrendered force's Equipment into its own matching designs (§3.11). */
function seizeEquipment(state: GameState, loser: TaskForce, victor: TaskForce): void {
  const roster = state.factions[victor.faction]
  for (const line of loser.composition) {
    const ls = lineStats(state, loser, line.designId)
    if (!ls) continue
    const units = Math.floor(line.equipment * SURRENDER_EQUIPMENT_SHARE)
    if (units <= 0) continue
    let design = findDuplicate(roster.designs, ls.design.platform, ls.design.modules)
    if (!design) {
      let name = ls.design.name
      for (let n = 2; roster.designs.some((d) => d.name.toLowerCase() === name.toLowerCase()); n++)
        name = `${ls.design.name} (${n})`
      design = { id: roster.nextDesignId++, name, platform: ls.design.platform, modules: [...ls.design.modules] }
      roster.designs.push(design)
    }
    roster.stockpile[design.id] = (roster.stockpile[design.id] ?? 0) + units
    line.equipment -= units // so disbanding doesn't also hand it back to the loser
    log(state, 'military', `${victor.faction} seizes ${units} ${design.name} Equipment`)
  }
}

/** Organization regenerates out of contact at 0.5% of max per tick; the consolidation lock lifts when met. */
export function recoverTaskForces(state: GameState): void {
  for (const tf of state.taskForces) {
    if (tf.organizationLost > 0 && !battleFor(state, tf.id)) {
      tf.organizationLost = Math.max(0, tf.organizationLost - ORG_REGEN_PER_TICK * maxOrganization(state, tf))
    }
    if (tf.consolidating) {
      const region = state.regions[tf.regionId]
      if (tf.organizationLost <= 0 && isLand(region) && region.stability >= CONSOLIDATION_STABILITY) {
        tf.consolidating = false
        log(state, 'military', `${tf.name} has consolidated ${region.name}`)
      }
    }
  }
}

/** Pulse end (GDD §8.6.2): a Planning Task Force with no invasion combat this whole pulse is Ready again. */
export function clearPlanning(state: GameState, pulseStartTick: number): void {
  for (const tf of state.taskForces) {
    if (tf.shock === 'planning' && tf.lastInvasionCombatTick < pulseStartTick) {
      tf.shock = 'ready'
      log(state, 'military', `${tf.name} is Ready — Shock available`)
    }
  }
}

/** For displays: units destroyed on a side valued at *today's* costs (§6, deliberately not historical). */
export function lossValue(state: GameState, side: BattleSide): number {
  let total = 0
  for (const [id, n] of Object.entries(side.unitsLost)) {
    const design = state.factions[side.faction].designs.find((d) => d.id === Number(id))
    if (design) total += n * designStats(design.platform, design.modules).cost
  }
  return total
}

export function formatLosses(state: GameState, side: BattleSide): string {
  const parts = Object.entries(side.unitsLost).map(([id, n]) => {
    const design = state.factions[side.faction].designs.find((d) => d.id === Number(id))
    return `${n} ${design?.name ?? 'unit'}`
  })
  return `${parts.length > 0 ? parts.join(', ') : 'no units'}, ${formatInt(side.manpowerLost)} Manpower`
}
