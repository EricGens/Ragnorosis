// One tick of a fight (Epoch 2 skeleton §1.2–1.4, §5.1–5.3): sensors, Long-Range Fires, CAS, Front Line,
// hits, reinforcement, Air Superiority, and the loss check. battle.ts owns the lifecycle around it —
// when battles start, when they end, and what the outcome does. Every function operates on an Immer
// draft and draws from the state's RNG, so the order of calls here is part of the game's rules.

import { nextRandom } from '../rng'
import type { Battle, BattleSide, FactionId, GameState, LandRegion, LineRole, TaskForce } from '../types'
import { LINE_ROLES, LINE_SLOTS } from '../types'
import {
  AIR_PER_CAS_EFFECT,
  AIR_PER_LONG_RANGE_SUCCESS,
  columnFor,
  defenseMultiplier,
  destructionChance,
  engagementChances,
  inverseCostWeights,
  lineStats,
  maneuverBonus,
  manpowerFraction,
  maxOrganization,
  organization,
  partisanBonus,
  pierceMultiplier,
  REINFORCE_PERCENT,
  relativeBonus,
  sensorTotals,
  unopposedCasChance,
  unitOrganization,
} from './combat'
import { eligibleRoles, findDesign } from './taskForce'

/** Key into Battle.costs: Production cost per faction's design, frozen when the battle starts. */
export function costKey(faction: FactionId, designId: number): string {
  return `${faction}|${designId}`
}

/** Occupied slots on a line. */
export const count = (line: (number | null)[]) => line.filter((id) => id !== null).length

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

/** Pick an index with probability proportional to its weight. One draw from the state's RNG. */
export function drawWeighted(state: GameState, weights: number[]): number {
  let roll = nextRandom(state) * weights.reduce((s, w) => s + w, 0)
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]
    if (roll < 0) return i
  }
  return weights.length - 1
}

/**
 * CAS (§5.3, with Eric's 2026-11-16 rulings): the enemy pools whatever air-defence-capable units it has in
 * Reserves plus its unpaired Long-Range assets, best first, one interceptor per aircraft. An intercepted
 * aircraft is held to the enemy's Front Line and fights a duel for its run. An aircraft nobody rose to
 * meet is unopposed: it may also hunt the enemy's Long-Range line, and it hits at 5% + half its value.
 * Either way the pilot prefers the richer target — candidates are drawn in proportion to Production cost.
 */
function resolveCas(
  state: GameState,
  me: Fighter,
  enemy: Fighter,
  enemyUnpairedLR: number[],
  costs: Battle['costs'],
): [Hit[], Hit[]] {
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
  type Candidate = { id: number; index: number; role: LineRole }
  const frontLine: Candidate[] = occupied(enemy.side.frontLine).map((u) => ({ ...u, role: 'frontLine' }))
  const longRange: Candidate[] = occupied(enemy.side.longRange).map((u) => ({ ...u, role: 'longRange' }))
  runs.forEach((run, k) => {
    const d = defenders[k]
    const candidates = d ? frontLine : [...frontLine, ...longRange]
    if (candidates.length === 0) return
    const t =
      candidates[
        drawWeighted(
          state,
          candidates.map((c) => costs[costKey(enemy.tf.faction, c.id)] ?? 1),
        )
      ]
    const target: Hit['target'] = { role: t.role, index: t.index }
    const vc = attackValue(state, me, run.id, enemy, t.id, 'short')
    if (!d) {
      if (nextRandom(state) * 100 < unopposedCasChance(vc.value)) {
        mine.push({ damage: vc.damage, piercing: vc.piercing, target })
        me.side.hits.cas += 1
        me.air.cas += 1
      }
      return
    }
    const vd = attackValue(state, enemy, d.id, me, run.id, 'short')
    const r = duel(state, vc.value, vd.value)
    if (r === true) {
      mine.push({ damage: vc.damage, piercing: vc.piercing, target })
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
function resolveFrontLine(state: GameState, a: Fighter, b: Fighter, costs: Battle['costs']): [Hit[], Hit[]] {
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
  const battleCost = (f: Fighter, id: number) => costs[costKey(f.tf.faction, id)] ?? 1
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

/**
 * Resolve one tick of `battle` between its two Task Forces and report who, if anyone, has met a loss
 * condition. An invasion runs every line; a standoff exchange runs Long-Range Fires only (and its
 * caller ignores the loss flags — standoff fire alone never forces a retreat).
 */
export function resolveRound(
  state: GameState,
  battle: Battle,
  attacker: TaskForce,
  defender: TaskForce,
): { attackerLost: boolean; defenderLost: boolean } {
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

  const lr = resolveLongRange(state, a, d)
  let hitsA = lr.hits[0]
  let hitsD = lr.hits[1]
  if (invasion) {
    const [casA, aaD] = resolveCas(state, a, d, lr.unpaired[1], battle.costs)
    const [casD, aaA] = resolveCas(state, d, a, lr.unpaired[0], battle.costs)
    const fl = resolveFrontLine(state, a, d, battle.costs)
    hitsA = [...hitsA, ...casA, ...aaA, ...fl[0]]
    hitsD = [...hitsD, ...casD, ...aaD, ...fl[1]]
  }
  applyHits(state, hitsA, d, a)
  applyHits(state, hitsD, a, d)
  for (const role of LINE_ROLES) {
    if (!invasion && role !== 'longRange') continue
    reinforce(state, a, role)
    reinforce(state, d, role)
  }
  updateAirSuperiority(battle, a, d)
  return { attackerLost: hasLost(state, a), defenderLost: hasLost(state, d) }
}
