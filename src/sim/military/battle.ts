// The battle lifecycle (Epoch 2 skeleton §4.6, §5.1–5.3; GDD §8.6.2, §8.6.6, §8.6.7): when a fight
// starts, when it ends, and what its outcome does to the two Task Forces. What happens *inside* one
// tick of a fight lives in battleRound.ts. Every mutating function operates on an Immer draft.
// Invasions start from the movement step the first tick a leg advances toward a defended region;
// standoff exchanges start from a side's own engage flag. Each runs one round per tick and stays on
// GameState afterwards as the Battle Log.

import { isPermissive } from '../formulas/domainControl'
import { formatInt } from '../format'
import { log } from '../log'
import { factionRelation } from '../relations'
import type { Battle, BattleOutcome, BattleSide, GameState, LineRole, RegionId, TaskForce } from '../types'
import { isLand, type LandRegion } from '../types'
import { costKey, count, resolveRound } from './battleRound'
import {
  CONSOLIDATION_STABILITY,
  lineStats,
  maxOrganization,
  ORG_REGEN_PER_TICK,
  SHOCK_TICKS,
  shockMultiplier,
  SURRENDER_EQUIPMENT_SHARE,
} from './combat'
import { adoptDesign, designStats } from './design'
import type { MoveResult } from './movement'
import { PLATFORMS } from './platforms'
import { deleteTaskForce, eligibleRoles, findDesign, findTaskForce } from './taskForce'

export function activeBattles(state: GameState): Battle[] {
  return state.battles.filter((b) => b.endedAt === null)
}

/** The live battle this Task Force is fighting, on either side. */
export function battleFor(state: GameState, tfId: number): Battle | undefined {
  return activeBattles(state).find((b) => b.attacker.taskForceId === tfId || b.defender.taskForceId === tfId)
}

/** The live invasion a Task Force is in, if any (standoff exchanges don't count as invasion combat). */
export function invasionFor(state: GameState, tfId: number): Battle | undefined {
  const b = battleFor(state, tfId)
  return b?.kind === 'invasion' ? b : undefined
}

/** Build a side from the Task Force's plan: slots take the planned design where units exist, the rest wait in Reserves. */
function makeSide(state: GameState, tf: TaskForce): BattleSide {
  const available: Record<string, number> = {}
  for (const line of tf.composition) if (line.equipment > 0) available[line.designId] = line.equipment
  const take = (role: LineRole): (number | null)[] =>
    tf.lines[role].map((designId) => {
      if (designId === null || (available[designId] ?? 0) <= 0) return null
      const design = findDesign(state, tf.faction, designId)
      if (!design || !eligibleRoles(design).includes(role)) return null
      available[designId] -= 1
      return designId
    })
  const frontLine = take('frontLine')
  const longRange = take('longRange')
  const cas = take('cas')
  const reserves: Record<string, number> = {}
  for (const [id, n] of Object.entries(available)) if (n > 0) reserves[id] = n
  return {
    taskForceId: tf.id,
    faction: tf.faction,
    name: tf.name,
    frontLine,
    longRange,
    cas,
    reserves,
    fielded: { longRange: count(longRange), cas: count(cas) },
    unitsLost: {},
    manpowerLost: 0,
    hits: { frontLine: 0, longRange: 0, cas: 0, airDefense: 0 },
  }
}

function freezeCosts(state: GameState, tfs: TaskForce[]): Record<string, number> {
  const costs: Record<string, number> = {}
  for (const tf of tfs) {
    for (const line of tf.composition) {
      const ls = lineStats(state, tf, line.designId)
      if (ls) costs[costKey(tf.faction, line.designId)] = ls.stats.cost
    }
  }
  return costs
}

/** Start an invasion: `attacker` is moving into `defender`'s region. */
export function startBattle(state: GameState, attacker: TaskForce, defender: TaskForce): Battle {
  const side = makeSide(state, attacker)
  // Shock (GDD §8.6.2): only a Ready attacker gets it; magnitude from the initial Front Line's average
  // Combat Speed, falling back to the whole force when the line plan is empty.
  let shock: Battle['shock'] = null
  if (attacker.shock === 'ready') {
    let speeds = side.frontLine
      .filter((id): id is number => id !== null)
      .map((id) => lineStats(state, attacker, id)?.stats.speed.combat ?? 0)
    if (speeds.length === 0) {
      speeds = attacker.composition.flatMap((line) => {
        const ls = lineStats(state, attacker, line.designId)
        return ls && PLATFORMS[ls.design.platform].kind === 'ground'
          ? Array<number>(line.equipment).fill(ls.stats.speed.combat)
          : []
      })
    }
    const average = speeds.length > 0 ? speeds.reduce((s, v) => s + v, 0) / speeds.length : 0
    if (average > 0) shock = { multiplier: shockMultiplier(average), until: state.tick + SHOCK_TICKS }
  }
  attacker.shock = 'planning'
  const battle: Battle = {
    id: state.nextBattleId++,
    kind: 'invasion',
    regionId: defender.regionId,
    attackerRegionId: attacker.regionId,
    startedAt: state.tick,
    endedAt: null,
    outcome: null,
    attacker: side,
    defender: makeSide(state, defender),
    shock,
    costs: freezeCosts(state, [attacker, defender]),
    airSuperiority: { contested: 0, attackerHome: 100 },
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

// ---------------------------------------------------------------------------------------------
// Standoff fire (§6 map-level toggle, §5.2 for the exchange itself)

/** Engage (or, with null, cancel) long-range fire against an adjacent hostile region. */
export function orderStandoff(state: GameState, tfId: number, target: RegionId | null): MoveResult {
  const tf = findTaskForce(state, tfId)
  if (!tf) return { ok: false, reason: 'That Task Force no longer exists.' }
  if (target === null) {
    tf.standoffTarget = null
    return { ok: true }
  }
  const region = state.regions[target]
  if (!region || !state.adjacency[tf.regionId].includes(target))
    return { ok: false, reason: 'Standoff fire needs an adjacent region.' }
  if (!isLand(region) || isPermissive(state, tf.faction, region)) return { ok: false, reason: 'Not a hostile region.' }
  tf.standoffTarget = target
  log(state, 'military', `${tf.name} opens long-range fire on ${region.name}`)
  return { ok: true }
}

/** Per tick: any engaged side with a hostile Task Force in its target region starts (or keeps) an exchange. */
export function startStandoffs(state: GameState): void {
  for (const tf of state.taskForces) {
    if (!tf.standoffTarget || battleFor(state, tf.id)) continue
    const target = state.taskForces.find(
      (t) =>
        t.regionId === tf.standoffTarget &&
        !t.retreating &&
        factionRelation(state, tf.faction, t.faction) === 'hostile' &&
        !battleFor(state, t.id),
    )
    if (!target) continue
    const battle: Battle = {
      id: state.nextBattleId++,
      kind: 'standoff',
      regionId: target.regionId,
      attackerRegionId: tf.regionId,
      startedAt: state.tick,
      endedAt: null,
      outcome: null,
      attacker: makeSide(state, tf),
      defender: makeSide(state, target),
      shock: null,
      costs: freezeCosts(state, [tf, target]),
      airSuperiority: { contested: 0, attackerHome: 100 },
    }
    state.battles.push(battle)
    log(
      state,
      'military',
      `${tf.name} and ${target.name} exchange long-range fire over ${state.regions[target.regionId].name}`,
    )
  }
}

/** One round for every live battle, then outcomes. */
export function resolveBattles(state: GameState): void {
  for (const battle of activeBattles(state)) {
    const attacker = findTaskForce(state, battle.attacker.taskForceId)
    const defender = findTaskForce(state, battle.defender.taskForceId)
    if (!attacker || !defender) {
      endBattle(
        state,
        battle,
        battle.kind === 'standoff' ? 'standoff-ended' : attacker ? 'attacker-won' : 'defender-won',
      )
      continue
    }
    if (battle.kind === 'invasion') {
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
    } else {
      // Fire happens while either side's flag is set — a logical OR (§6) — and both stay in place.
      const engaged =
        (attacker.standoffTarget === defender.regionId || defender.standoffTarget === attacker.regionId) &&
        attacker.regionId === battle.attackerRegionId &&
        defender.regionId === battle.regionId
      if (!engaged) {
        endBattle(state, battle, 'standoff-ended')
        continue
      }
    }

    const { attackerLost, defenderLost } = resolveRound(state, battle, attacker, defender)
    if (battle.kind !== 'invasion') continue
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
        // A rout is a real move (Eric, 2026-09-15): plotted like any order, walked at Combat Speed,
        // untargetable on the way; the region only clears when it arrives.
        defender.movement = { legs: [to], progress: 0, backtrack: 0 }
        defender.retreating = true
        defender.standoffTarget = null
        log(
          state,
          'military',
          `${battle.defender.name} breaks and retreats from ${region.name} toward ${state.regions[to].name}`,
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
    case 'standoff-ended':
      log(state, 'military', `Long-range fire over ${region.name} ceases`)
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
    const design = adoptDesign(roster, ls.design)
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
  }
  liftConsolidation(state)
}

/**
 * The consolidation lock lifts once Organization is full and Stability ≥ 50. Checked after Org recovery
 * *and again after pulse end*: Stability only drifts at pulse end, so without the second check a force
 * would show Stability 50.2 yet stay locked until the next tick (found in Eric's playtest, 2026-11-15).
 */
export function liftConsolidation(state: GameState): void {
  for (const tf of state.taskForces) {
    if (!tf.consolidating) continue
    const region = state.regions[tf.regionId]
    if (tf.organizationLost <= 0 && isLand(region) && region.stability >= CONSOLIDATION_STABILITY - 1e-9) {
      tf.consolidating = false
      log(state, 'military', `${tf.name} has consolidated ${region.name}`)
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
