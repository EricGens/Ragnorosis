// Energy sourcing (skeleton §1.4 "Energy", decisions doc "Energy"). Energy on the map is fossil
// fuel only. Two layers, computed once per Pulse:
//   1. Global fair share — if total demand exceeds total supply, every consumer is entitled to the
//      same fraction of its own demand, flat and universal.
//   2. Blockade — a consumer can only draw from regions it can reach along a path of regions where
//      its faction's Superiority is ≥ ACCESS_THRESHOLD. This only ever pushes delivery *below* the
//      fair-share baseline, never above it.

import type { EnergyResult, FactionId, GameState, LandRegion, Region, RegionId } from '../types'
import { isLand } from '../types'
import { fossilEnergyDemand } from './production'

export const ACCESS_THRESHOLD = 50
const EPSILON = 1e-9

/** Can `faction` move Energy through `region`? Air for land, Sea for maritime. Unaffiliated regions trade freely. */
export function passable(region: Region, faction: FactionId | null): boolean {
  if (faction === null) return true
  const s = region.superiority[faction]
  return (isLand(region) ? s.air : s.sea) >= ACCESS_THRESHOLD
}

/**
 * Source regions a consumer can draw from, in preference order: its own region, then same-country
 * regions, then everything else — each group ordered by path distance over passable regions.
 */
export function sourcePreferences(state: GameState, consumer: LandRegion): RegionId[] {
  const faction = consumer.controller
  const distance = new Map<RegionId, number>([[consumer.id, 0]])
  const queue: RegionId[] = [consumer.id]
  while (queue.length > 0) {
    const id = queue.shift()!
    const d = distance.get(id)!
    for (const n of state.adjacency[id]) {
      if (distance.has(n)) continue
      if (!passable(state.regions[n], faction)) continue
      distance.set(n, d + 1)
      queue.push(n)
    }
  }
  const reachable = [...distance.keys()].filter((id) => state.regions[id].energyReserve > 0)
  const rank = (id: RegionId) => {
    if (id === consumer.id) return 0
    const r = state.regions[id]
    return isLand(r) && r.country === consumer.country ? 1 : 2
  }
  return reachable.sort((a, b) => rank(a) - rank(b) || distance.get(a)! - distance.get(b)! || a.localeCompare(b))
}

export interface EnergyAllocation {
  totalSupply: number
  totalDemand: number
  fairShare: number
  results: Record<RegionId, EnergyResult>
}

/**
 * Allocate this pulse's Energy. Consumers claim from their most-preferred source with supply left;
 * when a source is over-claimed in a round, claims are scaled proportionally. Repeats until every
 * consumer is satisfied or has exhausted its reachable supply.
 */
export function allocateEnergy(state: GameState): EnergyAllocation {
  const regions = state.regionOrder.map((id) => state.regions[id])
  const consumers = regions.filter((r): r is LandRegion => isLand(r) && fossilEnergyDemand(r) > 0)

  const totalSupply = regions.reduce((sum, r) => sum + r.energyReserve, 0)
  const totalDemand = consumers.reduce((sum, r) => sum + fossilEnergyDemand(r), 0)
  const fairShare = totalDemand > 0 ? Math.min(1, totalSupply / totalDemand) : 1

  const supplyLeft = new Map<RegionId, number>(regions.map((r) => [r.id, r.energyReserve]))
  const remaining = new Map<RegionId, number>()
  const preferences = new Map<RegionId, RegionId[]>()
  const results: Record<RegionId, EnergyResult> = {}
  for (const c of consumers) {
    const demand = fossilEnergyDemand(c)
    remaining.set(c.id, demand * fairShare)
    preferences.set(c.id, sourcePreferences(state, c))
    results[c.id] = { demand, entitlement: demand * fairShare, delivered: 0, fulfillment: 0, sources: [] }
  }

  const maxRounds = (consumers.length + 1) * (regions.length + 1)
  for (let round = 0; round < maxRounds; round++) {
    const claims = new Map<RegionId, { consumer: RegionId; amount: number }[]>()
    for (const c of consumers) {
      const need = remaining.get(c.id)!
      if (need <= EPSILON) continue
      const source = preferences.get(c.id)!.find((s) => supplyLeft.get(s)! > EPSILON)
      if (!source) continue
      const list = claims.get(source) ?? []
      list.push({ consumer: c.id, amount: Math.min(need, supplyLeft.get(source)!) })
      claims.set(source, list)
    }
    if (claims.size === 0) break
    for (const [source, list] of claims) {
      const total = list.reduce((sum, x) => sum + x.amount, 0)
      const factor = Math.min(1, supplyLeft.get(source)! / total)
      for (const { consumer, amount } of list) {
        const granted = amount * factor
        supplyLeft.set(source, supplyLeft.get(source)! - granted)
        remaining.set(consumer, remaining.get(consumer)! - granted)
        const r = results[consumer]
        r.delivered += granted
        if (!r.sources.includes(source)) r.sources.push(source)
      }
    }
  }

  for (const r of Object.values(results)) {
    r.delivered = Math.min(r.delivered, r.entitlement)
    r.fulfillment = r.demand > 0 ? r.delivered / r.demand : 1
  }
  return { totalSupply, totalDemand, fairShare, results }
}
