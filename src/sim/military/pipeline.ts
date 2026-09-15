// The Equipment/Manpower production pipeline (Epoch 2 skeleton §3.7–3.10). Manpower is fungible —
// one pool, prioritized only at drawdown. Equipment is SKU-committed the moment it's made, so the
// same priority waterfall runs *before* manufacture to decide what gets built. Every mutating
// function operates on an Immer draft.

import { formatInt } from '../format'
import { factionFacilityMultiplier } from '../formulas/conversion'
import { log } from '../log'
import type { CompositionLine, FactionId, GameState, Priority, TaskForce, UnitDesign } from '../types'
import { PRIORITIES } from '../types'
import { designStats } from './design'
import { factionTaskForces, findDesign, unitManpower } from './taskForce'

export const WATERFALL_SHARE: Record<Priority, number> = { high: 0.6, normal: 0.3, low: 0.1 }
/** Stockpile production cap as a multiple of total Task Force demand (§3.9; naval/airships will use 2). */
export const STOCKPILE_CAP_MULTIPLE = 3

// ---------------------------------------------------------------------------------------------
// The waterfall (§3.8)

export interface Recipient {
  priority: Priority
  /** How much this recipient can still absorb. */
  need: number
  /** Its proportional share of a tier's budget (Production-equivalent of its full demand, §3.9). */
  weight: number
}

/**
 * Split `budget` among recipients by weight; anyone who saturates hands the surplus back to be
 * re-split among the rest. Bounded structurally: each pass either spends the budget or removes at
 * least one saturated recipient, so no epsilon loop is needed.
 */
export function distribute(
  budget: number,
  recipients: { need: number; weight: number }[],
): { grants: number[]; leftover: number } {
  const grants = recipients.map(() => 0)
  let active = recipients.map((_, i) => i).filter((i) => recipients[i].need > 0)
  while (budget > 0 && active.length > 0) {
    const totalWeight = active.reduce((s, i) => s + recipients[i].weight, 0)
    const next: number[] = []
    let spent = 0
    for (const i of active) {
      const share = totalWeight > 0 ? (budget * recipients[i].weight) / totalWeight : budget / active.length
      const room = recipients[i].need - grants[i]
      const give = Math.min(share, room)
      grants[i] += give
      spent += give
      if (give < room) next.push(i)
    }
    budget -= spent
    if (next.length === active.length) break // nobody saturated → the whole budget went out
    active = next
  }
  return { grants, leftover: Math.max(0, budget) }
}

/**
 * 60/30/10 by priority tier, each tier's unspent share flowing down to the next (§3.8). Whatever
 * the Low tier leaves is offered back up the tiers to anyone still short — the split governs
 * contention, it never reserves Production for a tier with nothing to fill (decisions doc).
 */
export function waterfall(amount: number, recipients: Recipient[]): { grants: number[]; leftover: number } {
  const grants = recipients.map(() => 0)
  let carry = 0
  const sweep = (tier: Priority, budget: number): number => {
    const indices = recipients.map((_, i) => i).filter((i) => recipients[i].priority === tier)
    const r = distribute(
      budget,
      indices.map((i) => ({ need: recipients[i].need - grants[i], weight: recipients[i].weight })),
    )
    indices.forEach((i, k) => {
      grants[i] += r.grants[k]
    })
    return r.leftover
  }
  for (const tier of PRIORITIES) carry = sweep(tier, amount * WATERFALL_SHARE[tier] + carry)
  for (const tier of PRIORITIES) if (carry > 0) carry = sweep(tier, carry)
  return { grants, leftover: carry }
}

// ---------------------------------------------------------------------------------------------
// Demand summaries (shared with the Military Button)

/** One Military Button line: a SKU's demand pooled across every Task Force at one priority (§6). */
export interface DemandPool {
  design: UnitDesign
  priority: Priority
  cost: number
  target: number
  equipped: number
}

/** A SKU's faction-wide totals and stockpile standing. */
export interface SkuStanding {
  design: UnitDesign
  cost: number
  target: number
  equipped: number
  stockpile: number
  /** 3× total demand (§3.9); production toward the stockpile stops here, the number itself may sit above it. */
  stockpileCap: number
  /** Production banked toward the next unit. */
  banked: number
}

export function demandPools(state: GameState, faction: FactionId): DemandPool[] {
  const pools = new Map<string, DemandPool>()
  for (const tf of factionTaskForces(state, faction)) {
    for (const line of tf.composition) {
      const design = findDesign(state, faction, line.designId)
      if (!design) continue
      const key = `${line.designId}|${line.priority}`
      let pool = pools.get(key)
      if (!pool) {
        pool = {
          design,
          priority: line.priority,
          cost: designStats(design.platform, design.modules).cost,
          target: 0,
          equipped: 0,
        }
        pools.set(key, pool)
      }
      pool.target += line.target
      pool.equipped += line.equipment
    }
  }
  return [...pools.values()]
}

/**
 * Manufacturing banks are per demand pool (design × priority) plus one per design for stockpile
 * accumulation, so a tier's Production only ever builds units for that tier's lines.
 */
export function bankKey(designId: number, tier: Priority | 'stockpile'): string {
  return `${designId}|${tier}`
}

/** Production banked toward this design across every tier bucket. */
export function bankedFor(state: GameState, faction: FactionId, designId: number): number {
  const prefix = `${designId}|`
  let total = 0
  for (const [key, amount] of Object.entries(state.factions[faction].manufacturing)) {
    if (key.startsWith(prefix)) total += amount
  }
  return total
}

export function skuStanding(state: GameState, faction: FactionId, design: UnitDesign): SkuStanding {
  const f = state.factions[faction]
  let target = 0
  let equipped = 0
  for (const tf of factionTaskForces(state, faction)) {
    const line = tf.composition.find((l) => l.designId === design.id)
    if (line) {
      target += line.target
      equipped += line.equipment
    }
  }
  return {
    design,
    cost: designStats(design.platform, design.modules).cost,
    target,
    equipped,
    stockpile: f.stockpile[design.id] ?? 0,
    stockpileCap: STOCKPILE_CAP_MULTIPLE * target,
    banked: bankedFor(state, faction, design.id),
  }
}

export function allStandings(state: GameState, faction: FactionId): SkuStanding[] {
  return state.factions[faction].designs.map((d) => skuStanding(state, faction, d))
}

/** Production (post-facility-bonus) that still has an Equipment destination: unfilled demand plus stockpile room. */
export function equipmentProductionRoom(state: GameState, faction: FactionId): number {
  let room = 0
  for (const s of allStandings(state, faction)) {
    const wantedUnits = s.target + s.stockpileCap
    const onHand = s.equipped + s.stockpile
    room += Math.max(0, (wantedUnits - onHand) * s.cost - s.banked)
  }
  return room
}

/** The same room expressed in allocation points, before the Production Facility bonus is applied. */
export function equipmentAllocationRoom(state: GameState, faction: FactionId): number {
  const room = equipmentProductionRoom(state, faction)
  return room <= 0 ? 0 : Math.ceil(room / factionFacilityMultiplier(state, faction, 'production-facility'))
}

// ---------------------------------------------------------------------------------------------
// Equipment (§3.7–3.9)

/** Under-strength lines of one design, optionally one priority, High first then by Task Force. */
function shortLines(state: GameState, faction: FactionId, designId: number, priority?: Priority) {
  const lines: { tf: TaskForce; line: CompositionLine }[] = []
  for (const tf of factionTaskForces(state, faction)) {
    for (const line of tf.composition) {
      if (line.designId !== designId || line.equipment >= line.target) continue
      if (priority === undefined || line.priority === priority) lines.push({ tf, line })
    }
  }
  return lines.sort(
    (a, b) => PRIORITIES.indexOf(a.line.priority) - PRIORITIES.indexOf(b.line.priority) || a.tf.id - b.tf.id,
  )
}

/** Hand `units` of a design to under-strength lines; returns however many found no taker. */
function handOut(state: GameState, faction: FactionId, designId: number, units: number, priority?: Priority): number {
  const design = findDesign(state, faction, designId)
  for (const { tf, line } of shortLines(state, faction, designId, priority)) {
    if (units <= 0) break
    const give = Math.min(units, line.target - line.equipment)
    line.equipment += give
    units -= give
    log(state, 'military', `${tf.name} receives ${give} ${design?.name ?? 'unit'} Equipment`)
  }
  return units
}

/** Finished Equipment flows from the stockpile to under-strength lines, High priority first, then by Task Force. */
export function deliverEquipment(state: GameState, faction: FactionId): void {
  const f = state.factions[faction]
  for (const [key, have] of Object.entries(f.stockpile)) {
    if (have <= 0) continue
    f.stockpile[key] = handOut(state, faction, Number(key), have)
  }
}

/** Turn a bank's Production into whole units (binary per unit, §3.10). Returns units made. */
function popUnits(state: GameState, faction: FactionId, key: string, cost: number): number {
  const f = state.factions[faction]
  const banked = f.manufacturing[key] ?? 0
  const units = Math.floor(banked / cost + 1e-9)
  if (units > 0) f.manufacturing[key] = Math.max(0, banked - units * cost)
  return units
}

/**
 * Spend this pulse's Equipment Production. Phase A: the waterfall over Task Force demand pools,
 * each pool's Production building units for that pool's own lines. Phase B: stockpile
 * accumulation toward each SKU's cap, weighted by Production-equivalent demand (§3.9's 250/320
 * example). Returns the Production that had nowhere to go.
 */
export function manufactureEquipment(state: GameState, faction: FactionId, production: number): number {
  if (production <= 0) return production
  const f = state.factions[faction]
  const made = new Map<number, number>()
  const bank = (key: string, amount: number) => {
    if (amount > 0) f.manufacturing[key] = (f.manufacturing[key] ?? 0) + amount
  }
  const note = (designId: number, units: number) => {
    if (units > 0) made.set(designId, (made.get(designId) ?? 0) + units)
  }

  deliverEquipment(state, faction)

  // Phase A — demand, by priority tier.
  const pools = demandPools(state, faction)
  const a = waterfall(
    production,
    pools.map((p) => ({
      priority: p.priority,
      need: Math.max(0, p.target - p.equipped) * p.cost,
      weight: p.target * p.cost,
    })),
  )
  pools.forEach((p, i) => {
    const key = bankKey(p.design.id, p.priority)
    bank(key, a.grants[i])
    const units = popUnits(state, faction, key, p.cost)
    note(p.design.id, units)
    const spare = handOut(state, faction, p.design.id, units, p.priority)
    if (spare > 0) f.stockpile[p.design.id] = (f.stockpile[p.design.id] ?? 0) + spare
  })

  // Phase B — stockpile accumulation with whatever the demand tiers left.
  const standings = allStandings(state, faction).filter((s) => s.target > 0)
  const b = distribute(
    a.leftover,
    standings.map((s) => ({
      need: Math.max(0, (s.stockpileCap - s.stockpile) * s.cost - s.banked),
      weight: s.target * s.cost,
    })),
  )
  standings.forEach((s, i) => {
    const key = bankKey(s.design.id, 'stockpile')
    bank(key, b.grants[i])
    const units = popUnits(state, faction, key, s.cost)
    note(s.design.id, units)
    if (units > 0) f.stockpile[s.design.id] = (f.stockpile[s.design.id] ?? 0) + units
  })
  deliverEquipment(state, faction)

  for (const [designId, units] of made) {
    const design = findDesign(state, faction, designId)
    log(state, 'military', `${faction} manufactures ${units} ${design?.name ?? 'unit'} Equipment`)
  }
  return b.leftover
}

// ---------------------------------------------------------------------------------------------
// Manpower (§3.7, §3.10)

/** Draw the pool down into under-strength lines through the same 60/30/10 waterfall; partial fill is linear. */
export function drawdownManpower(state: GameState, faction: FactionId): void {
  const f = state.factions[faction]
  if (f.manpower <= 0) return
  const lines: { tf: TaskForce; line: CompositionLine; full: number }[] = []
  for (const tf of factionTaskForces(state, faction)) {
    for (const line of tf.composition) {
      const design = findDesign(state, faction, line.designId)
      if (design) lines.push({ tf, line, full: line.target * unitManpower(design) })
    }
  }
  const { grants } = waterfall(
    f.manpower,
    lines.map(({ line, full }) => ({ priority: line.priority, need: Math.max(0, full - line.manpower), weight: full })),
  )
  lines.forEach(({ tf, line }, i) => {
    const give = Math.min(Math.floor(grants[i]), f.manpower)
    if (give <= 0) return
    line.manpower += give
    f.manpower -= give
    log(state, 'military', `${tf.name} draws ${formatInt(give)} Manpower`)
  })
}
