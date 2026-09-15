// The battle state machine (Epoch 2 skeleton §1.2–1.4, §4.6, §5.1–5.3; GDD §8.6.2, §8.6.6, §8.6.7).
// Every mutating function operates on an Immer draft. Invasions start from the movement step the
// first tick a leg advances toward a defended region; standoff exchanges start from a side's own
// engage flag. Each runs one round per tick and stays on GameState afterwards as the Battle Log.

import { isPermissive } from '../formulas/domainControl'
import { formatInt } from '../format'
import { log } from '../log'
import { factionRelation } from '../relations'
import { nextRandom } from '../rng'
import type {
  Battle,
  BattleOutcome,
  BattleSide,
  FactionId,
  GameState,
  LandRegion,
  LineRole,
  RegionId,
  TaskForce,
} from '../types'
import { isLand, LINE_ROLES, LINE_SLOTS } from '../types'
import {
  AIR_PER_CAS_EFFECT,
  AIR_PER_LONG_RANGE_SUCCESS,
  CONSOLIDATION_STABILITY,
  columnFor,
  defenseMultiplier,
  destructionChance,
  engagementChances,
  inverseCostWeights,
  lineStats,
  maneuverBonus,
  manpowerFraction,
  maxOrganization,
  ORG_REGEN_PER_TICK,
  organization,
  partisanBonus,
  pierceMultiplier,
  REINFORCE_PERCENT,
  relativeBonus,
  sensorTotals,
  SHOCK_TICKS,
  shockMultiplier,
  SURRENDER_EQUIPMENT_SHARE,
  unitOrganization,
} from './combat'
import { designStats, findDuplicate } from './design'
import { PLATFORMS } from './platforms'
import { deleteTaskForce, eligibleRoles, findDesign, findTaskForce } from './taskForce'
import type { MoveResult } from './movement'

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

function costKey(faction: FactionId, designId: number): string {
  return `${faction}|${designId}`
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

const count = (line: (number | null)[]) => line.filter((id) => id !== null).length

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

// ---------------------------------------------------------------------------------------------
// One round

interface Mods {
  /** Shock (attacker) or Defensibility (defender). */
  multiplier: number
  /** Flat bonus to every nonzero vector value: partisans, freedom of maneuver. */
  bonus: number
  /** ISR adds to ground-column rolls, Radar to Anti-Air-column rolls (§1.2). */
  isr: number
  radar: number
}

interface Hit {
  damage: number
  piercing: number
  /** Where the hit lands: a slot on a line, or a unit type in Reserves. */
  target: { role: LineRole; index: number } | { reserve: number }
  /** Air defence fire at a CAS aircraft — counts as a kill for Air Superiority if it destroys (§1.3). */
  airDefense?: boolean
}

interface Fighter {
  tf: TaskForce
  side: BattleSide
  mods: Mods
  /** Successful engagements this tick that move Air Superiority (§1.3). */
  air: { opposite: number; own: number; cas: number; aaKills: number }
}

/** A unit's attack value against a target, at short or long range, with the side's modifiers. */
function attackValue(
  state: GameState,
  f: Fighter,
  designId: number,
  target: Fighter,
  targetDesignId: number,
  range: 'short' | 'long',
): { value: number; damage: number; piercing: number } {
  const ls = lineStats(state, f.tf, designId)
  const t = lineStats(state, target.tf, targetDesignId)
  if (!ls || !t) return { value: 0, damage: 0, piercing: 0 }
  const column = columnFor(t.design.platform)
  const raw = ls.stats.vector[column][range] ?? 0
  const fraction = manpowerFraction(ls.line, ls.stats)
  const sensor = column === 3 ? f.mods.radar : f.mods.isr
  const value = raw > 0 ? (raw + f.mods.bonus + sensor) * f.mods.multiplier * fraction : 0
  return { value, damage: ls.stats.damage * f.mods.multiplier * fraction, piercing: ls.stats.piercing }
}

/** The single partitioned roll (§5.1): true = first side scored, false = second, null = push. */
function duel(state: GameState, a: number, b: number): boolean | null {
  const c = engagementChances(a, b)
  const roll = nextRandom(state) * 100
  if (roll < c.attacker) return true
  if (roll < c.attacker + c.defender) return false
  return null
}

function occupied(line: (number | null)[]): { id: number; index: number }[] {
  return line.map((id, index) => ({ id, index })).filter((s): s is { id: number; index: number } => s.id !== null)
}

/** A random target on the enemy's Front Line or in Reserves that the striker has a nonzero long-range vector against (§5.2 item 5). */
function deepStrikeTarget(state: GameState, striker: Fighter, strikerId: number, enemy: Fighter): Hit['target'] | null {
  const ls = lineStats(state, striker.tf, strikerId)
  if (!ls) return null
  const canHit = (designId: number) => {
    const t = lineStats(state, enemy.tf, designId)
    return t !== undefined && (ls.stats.vector[columnFor(t.design.platform)].long ?? 0) > 0
  }
  const pool: Hit['target'][] = []
  for (const s of occupied(enemy.side.frontLine)) if (canHit(s.id)) pool.push({ role: 'frontLine', index: s.index })
  for (const [id, n] of Object.entries(enemy.side.reserves)) {
    if (n > 0 && canHit(Number(id))) for (let k = 0; k < n; k++) pool.push({ reserve: Number(id) })
  }
  if (pool.length === 0) return null
  return pool[Math.floor(nextRandom(state) * pool.length)]
}

function designAt(side: BattleSide, target: Hit['target']): number | null {
  return 'reserve' in target ? target.reserve : side[target.role][target.index]
}

/**
 * Long-Range Fires (§5.2): sort both rosters by anti-air capability, pair down the lists, reshuffle so
 * pure air-defence assets face ground-capable opponents (SEAD), resolve duels or SCUD-hunts, and let
 * anything unpaired reach into the enemy's Front Line or Reserves. Returns the hits and which of each
 * side's units were left without a pairing (they can still intercept CAS this tick, §5.3).
 */
function resolveLongRange(
  state: GameState,
  a: Fighter,
  b: Fighter,
): { hits: [Hit[], Hit[]]; unpaired: [number[], number[]] } {
  type Unit = { id: number; index: number; aa: number; ground: number }
  const roster = (f: Fighter): Unit[] =>
    occupied(f.side.longRange)
      .map(({ id, index }) => {
        const ls = lineStats(state, f.tf, id)
        const long = (c: number) => ls?.stats.vector[c].long ?? 0
        return { id, index, aa: long(3), ground: Math.max(long(0), long(1), long(2)) }
      })
      .sort((x, y) => y.aa - x.aa)
  const ra = roster(a)
  const rb = roster(b)
  const n = Math.min(ra.length, rb.length)
  const pairs: [Unit, Unit][] = []
  for (let i = 0; i < n; i++) pairs.push([ra[i], rb[i]])
  // SEAD pass: a pure air-defence unit facing a partner with no ground reach swaps partners with a pair
  // whose opponent does have ground reach, where possible.
  const pureAD = (u: Unit) => u.aa > 0 && u.ground === 0
  for (const sideIdx of [0, 1] as const) {
    for (let i = 0; i < pairs.length; i++) {
      const me = pairs[i][sideIdx]
      const foe = pairs[i][1 - sideIdx]
      if (!pureAD(me) || foe.ground > 0) continue
      const j = pairs.findIndex((p, k) => k !== i && !pureAD(p[sideIdx]) && p[1 - sideIdx].ground > 0)
      if (j < 0) continue
      const tmp = pairs[i][1 - sideIdx]
      pairs[i][1 - sideIdx] = pairs[j][1 - sideIdx]
      pairs[j][1 - sideIdx] = tmp
    }
  }
  const hits: [Hit[], Hit[]] = [[], []]
  const fighters = [a, b] as const
  for (const [ua, ub] of pairs) {
    const units = [ua, ub] as const
    const scudHunt = ua.aa > 0 !== ub.aa > 0
    if (!scudHunt) {
      // Symmetric duel: air-vs-air, or strike-vs-strike counter-battery.
      const va = attackValue(state, a, ua.id, b, ub.id, 'long')
      const vb = attackValue(state, b, ub.id, a, ua.id, 'long')
      const r = duel(state, va.value, vb.value)
      if (r === null) continue
      const w = r ? 0 : 1
      const winner = fighters[w]
      const v = r ? va : vb
      hits[w].push({ damage: v.damage, piercing: v.piercing, target: { role: 'longRange', index: units[1 - w].index } })
      winner.side.hits.longRange += 1
      // Air-vs-air duels have no tie to the ground: 50/50 which region moves (§1.3).
      if (ua.aa > 0 && ub.aa > 0 && nextRandom(state) < 0.5) winner.air.own += 1
      else winner.air.opposite += 1
    } else {
      // SCUD-hunt: the strike asset attacks a random target elsewhere; the interceptor tries to stop it.
      const s = ua.aa > 0 ? 1 : 0 // index of the striker
      const striker = fighters[s]
      const interceptor = fighters[1 - s]
      const strikeUnit = units[s]
      const interceptUnit = units[1 - s]
      const target = deepStrikeTarget(state, striker, strikeUnit.id, interceptor)
      const targetId = target ? designAt(interceptor.side, target) : null
      const vs =
        targetId === null
          ? { value: 0, damage: 0, piercing: 0 }
          : attackValue(state, striker, strikeUnit.id, interceptor, targetId, 'long')
      const vi = attackValue(state, interceptor, interceptUnit.id, striker, strikeUnit.id, 'long')
      const r = duel(state, vs.value, vi.value)
      if (r === null) continue
      if (r && target) {
        hits[s].push({ damage: vs.damage, piercing: vs.piercing, target })
        striker.side.hits.longRange += 1
        striker.air.opposite += 1
      } else if (!r) {
        hits[1 - s].push({
          damage: vi.damage,
          piercing: vi.piercing,
          target: { role: 'longRange', index: strikeUnit.index },
        })
        interceptor.side.hits.longRange += 1
        interceptor.air.opposite += 1
      }
    }
  }
  // Roster-size mismatch: the leftovers strike unopposed, unless they're pure air defence (idle, §5.2).
  const unpaired: [number[], number[]] = [[], []]
  for (const sideIdx of [0, 1] as const) {
    const rest = (sideIdx === 0 ? ra : rb).slice(n)
    const me = fighters[sideIdx]
    const enemy = fighters[1 - sideIdx]
    for (const u of rest) {
      if (pureAD(u)) {
        unpaired[sideIdx].push(u.id)
        continue
      }
      const target = deepStrikeTarget(state, me, u.id, enemy)
      const targetId = target ? designAt(enemy.side, target) : null
      if (!target || targetId === null) continue
      const v = attackValue(state, me, u.id, enemy, targetId, 'long')
      if (v.value > 0 && nextRandom(state) * 100 < 5) {
        hits[sideIdx].push({ damage: v.damage, piercing: v.piercing, target })
        me.side.hits.longRange += 1
        me.air.opposite += 1
      }
    }
  }
  return { hits, unpaired }
}

/**
 * CAS (§5.3): each aircraft runs at a random enemy Front Line unit; the enemy pools whatever
 * air-defence-capable units it has in Reserves plus its unpaired Long-Range assets, best first, to
 * intercept. A run with no interceptor left is unopposed.
 */
function resolveCas(state: GameState, me: Fighter, enemy: Fighter, enemyUnpairedLR: number[]): [Hit[], Hit[]] {
  const mine: Hit[] = []
  const theirs: Hit[] = []
  const runs = occupied(me.side.cas)
  if (runs.length === 0) return [mine, theirs]
  type Defender = { id: number; aa: number; where: Hit['target'] }
  const defenders: Defender[] = []
  const aaOf = (id: number) => lineStats(state, enemy.tf, id)?.stats.vector[3].short ?? 0
  for (const [id, n] of Object.entries(enemy.side.reserves)) {
    if (n > 0 && aaOf(Number(id)) > 0)
      for (let k = 0; k < n; k++)
        defenders.push({ id: Number(id), aa: aaOf(Number(id)), where: { reserve: Number(id) } })
  }
  for (const id of enemyUnpairedLR) {
    const index = enemy.side.longRange.indexOf(id)
    if (index >= 0 && aaOf(id) > 0) defenders.push({ id, aa: aaOf(id), where: { role: 'longRange', index } })
  }
  defenders.sort((x, y) => y.aa - x.aa)
  const targets = occupied(enemy.side.frontLine)
  runs.forEach((run, k) => {
    if (targets.length === 0) return
    const t = targets[Math.floor(nextRandom(state) * targets.length)]
    const vc = attackValue(state, me, run.id, enemy, t.id, 'short')
    const d = defenders[k]
    const vd = d ? attackValue(state, enemy, d.id, me, run.id, 'short') : { value: 0, damage: 0, piercing: 0 }
    if (!d) {
      if (vc.value > 0 && nextRandom(state) * 100 < 5) {
        mine.push({ damage: vc.damage, piercing: vc.piercing, target: { role: 'frontLine', index: t.index } })
        me.side.hits.cas += 1
        me.air.cas += 1
      }
      return
    }
    const r = duel(state, vc.value, vd.value)
    if (r === true) {
      mine.push({ damage: vc.damage, piercing: vc.piercing, target: { role: 'frontLine', index: t.index } })
      me.side.hits.cas += 1
      me.air.cas += 1
    } else if (r === false) {
      theirs.push({
        damage: vd.damage,
        piercing: vd.piercing,
        target: { role: 'cas', index: run.index },
        airDefense: true,
      })
    }
  })
  return [mine, theirs]
}

/** Front Line (§5.1): paired rolls, flanking for unpaired slots; targets drawn later by inverse cost. */
function resolveFrontLine(state: GameState, a: Fighter, b: Fighter): [Hit[], Hit[]] {
  const out: [Hit[], Hit[]] = [[], []]
  const fighters = [a, b] as const
  const nearest = (line: (number | null)[]) => line.find((id) => id !== null) ?? null
  const drawTarget = (enemy: Fighter): Hit['target'] | null => {
    const occ = occupied(enemy.side.frontLine)
    if (occ.length === 0) return null
    const weights = inverseCostWeights(occ.map((s) => battleCost(enemy, s.id)))
    let roll = nextRandom(state)
    for (let k = 0; k < occ.length; k++) {
      roll -= weights[k]
      if (roll < 0) return { role: 'frontLine', index: occ[k].index }
    }
    return { role: 'frontLine', index: occ[occ.length - 1].index }
  }
  const battleCost = (f: Fighter, id: number) => currentBattle!.costs[costKey(f.tf.faction, id)] ?? 1
  for (let i = 0; i < LINE_SLOTS.frontLine; i++) {
    const ua = a.side.frontLine[i]
    const ub = b.side.frontLine[i]
    if (ua !== null && ub !== null) {
      const va = attackValue(state, a, ua, b, ub, 'short')
      const vb = attackValue(state, b, ub, a, ua, 'short')
      const r = duel(state, va.value, vb.value)
      if (r === null) continue
      const w = r ? 0 : 1
      const target = drawTarget(fighters[1 - w])
      if (!target) continue
      const v = r ? va : vb
      out[w].push({ damage: v.damage, piercing: v.piercing, target })
      fighters[w].side.hits.frontLine += 1
    } else if (ua !== null || ub !== null) {
      // Flanking: an unopposed baseline roll against the nearest enemy front-line unit.
      const w = ua !== null ? 0 : 1
      const me = fighters[w]
      const enemy = fighters[1 - w]
      const near = nearest(enemy.side.frontLine)
      if (near === null) continue
      const v = attackValue(state, me, (ua ?? ub)!, enemy, near, 'short')
      if (v.value > 0 && nextRandom(state) * 100 < 5) {
        const target = drawTarget(enemy)
        if (target) {
          out[w].push({ damage: v.damage, piercing: v.piercing, target })
          me.side.hits.frontLine += 1
        }
      }
    }
  }
  return out
}

let currentBattle: Battle | null = null

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

/** Resolve hits against a side: survival check, then destruction or a push into Reserves (§5.1). */
function applyHits(state: GameState, hits: Hit[], target: Fighter, shooter: Fighter): void {
  for (const hit of hits) {
    const designId = designAt(target.side, hit.target)
    if (designId === null || ('reserve' in hit.target && (target.side.reserves[designId] ?? 0) <= 0)) continue
    const ls = lineStats(state, target.tf, designId)
    if (!ls) continue
    const damage = hit.damage * pierceMultiplier(hit.piercing, ls.stats.armor)
    const destroyed = nextRandom(state) < destructionChance(damage, ls.stats.health)
    if ('reserve' in hit.target) {
      if (destroyed) {
        target.side.reserves[designId] -= 1
        destroyUnit(state, target.tf, designId, target.side)
      } else {
        target.tf.organizationLost += unitOrganization(ls.line, ls.stats)
      }
      continue
    }
    target.side[hit.target.role][hit.target.index] = null
    if (destroyed) {
      destroyUnit(state, target.tf, designId, target.side)
      if (hit.airDefense) {
        shooter.side.hits.airDefense += 1
        shooter.air.aaKills += 1
      }
    } else {
      target.side.reserves[designId] = (target.side.reserves[designId] ?? 0) + 1
      target.tf.organizationLost += unitOrganization(ls.line, ls.stats)
    }
  }
}

/** Each empty slot rolls to pull an eligible Reserve unit up (§5.1–5.3 reinforcement). */
function reinforce(state: GameState, f: Fighter, role: LineRole): void {
  const line = f.side[role]
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== null) continue
    const pool = Object.entries(f.side.reserves).filter(([id, n]) => {
      const design = findDesign(state, f.tf.faction, Number(id))
      return n > 0 && design !== undefined && eligibleRoles(design).includes(role)
    })
    const total = pool.reduce((s, [, n]) => s + n, 0)
    if (total === 0) return
    if (nextRandom(state) * 100 >= REINFORCE_PERCENT) continue
    let roll = nextRandom(state) * total
    for (const [id, n] of pool) {
      roll -= n
      if (roll < 0) {
        line[i] = Number(id)
        f.side.reserves[id] = n - 1
        break
      }
    }
  }
}

function unitsRemaining(side: BattleSide): number {
  return (
    count(side.frontLine) +
    count(side.longRange) +
    count(side.cas) +
    Object.values(side.reserves).reduce((s, n) => s + n, 0)
  )
}

/** The three loss conditions (§5.1): Org at zero, everything destroyed, or an empty line with nothing that could hold it. */
function hasLost(state: GameState, f: Fighter): boolean {
  if (organization(state, f.tf) <= 0) return true
  if (unitsRemaining(f.side) === 0) return true
  if (count(f.side.frontLine) > 0) return false
  return !Object.entries(f.side.reserves).some(([id, n]) => {
    const design = findDesign(state, f.tf.faction, Number(id))
    return n > 0 && design !== undefined && eligibleRoles(design).includes('frontLine')
  })
}

/** The Air Superiority the attacker holds after this tick's engagements (§1.3). */
function updateAirSuperiority(battle: Battle, a: Fighter, d: Fighter): void {
  const cleared = (side: BattleSide, both: boolean) =>
    side.fielded.longRange > 0 &&
    count(side.longRange) === 0 &&
    (!both || (side.fielded.cas > 0 && count(side.cas) === 0))
  const both = battle.kind === 'invasion'
  const anyA = a.air.opposite + a.air.own + a.air.cas + a.air.aaKills > 0
  const anyD = d.air.opposite + d.air.own + d.air.cas + d.air.aaKills > 0
  let contested =
    AIR_PER_LONG_RANGE_SUCCESS * a.air.opposite +
    AIR_PER_CAS_EFFECT * (a.air.cas + a.air.aaKills) -
    AIR_PER_CAS_EFFECT * (d.air.cas + d.air.aaKills) -
    AIR_PER_LONG_RANGE_SUCCESS * d.air.own
  let home = 100 - AIR_PER_LONG_RANGE_SUCCESS * d.air.opposite + AIR_PER_LONG_RANGE_SUCCESS * a.air.own
  if (cleared(d.side, both) && anyA) contested = 100
  if (cleared(a.side, both) && anyD) home = 0
  battle.airSuperiority = {
    contested: Math.max(0, Math.min(100, contested)),
    attackerHome: Math.max(0, Math.min(100, home)),
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

    const region = state.regions[battle.regionId] as LandRegion
    const invasion = battle.kind === 'invasion'
    const shockOn = invasion && battle.shock !== null && state.tick <= battle.shock.until
    const maneuver = maneuverBonus(battle.airSuperiority.contested + battle.airSuperiority.attackerHome)
    const a: Fighter = {
      tf: attacker,
      side: battle.attacker,
      mods: {
        multiplier: shockOn ? battle.shock!.multiplier : 1,
        bonus: (invasion ? partisanBonus(region.stability) : 0) + Math.max(0, maneuver),
        isr: 0,
        radar: 0,
      },
      air: { opposite: 0, own: 0, cas: 0, aaKills: 0 },
    }
    const d: Fighter = {
      tf: defender,
      side: battle.defender,
      mods: { multiplier: invasion ? defenseMultiplier(region) : 1, bonus: Math.max(0, -maneuver), isr: 0, radar: 0 },
      air: { opposite: 0, own: 0, cas: 0, aaKills: 0 },
    }
    // Sensors (§1.2): from units currently on a line; only the relative delta matters.
    const active = (side: BattleSide) =>
      [...side.frontLine, ...side.longRange, ...side.cas].filter((id): id is number => id !== null)
    const sa = sensorTotals(state, attacker, active(battle.attacker))
    const sd = sensorTotals(state, defender, active(battle.defender))
    a.mods.isr = relativeBonus(sa.isr, sd.isr)
    a.mods.radar = relativeBonus(sa.radar, sd.radar)
    d.mods.isr = relativeBonus(sd.isr, sa.isr)
    d.mods.radar = relativeBonus(sd.radar, sa.radar)

    currentBattle = battle
    const lr = resolveLongRange(state, a, d)
    let hitsA = lr.hits[0]
    let hitsD = lr.hits[1]
    if (invasion) {
      const [casA, aaD] = resolveCas(state, a, d, lr.unpaired[1])
      const [casD, aaA] = resolveCas(state, d, a, lr.unpaired[0])
      const fl = resolveFrontLine(state, a, d)
      hitsA = [...hitsA, ...casA, ...aaA, ...fl[0]]
      hitsD = [...hitsD, ...casD, ...aaD, ...fl[1]]
    }
    currentBattle = null
    applyHits(state, hitsA, d, a)
    applyHits(state, hitsD, a, d)
    for (const role of LINE_ROLES) {
      if (!invasion && role !== 'longRange') continue
      reinforce(state, a, role)
      reinforce(state, d, role)
    }
    updateAirSuperiority(battle, a, d)

    if (!invasion) continue
    const attackerLost = hasLost(state, a)
    const defenderLost = hasLost(state, d)
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
