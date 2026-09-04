import type { FactionId, GameState, LandRegion } from '../types'
import { isLand } from '../types'

/** Manpower pool cap as a fraction of controlled Population (Epoch 1; mobilization raises it later). */
export const MANPOWER_CAP_FRACTION = 0.02

export function controlledRegions(state: GameState, faction: FactionId): LandRegion[] {
  return state.regionOrder.map((id) => state.regions[id]).filter((r): r is LandRegion => isLand(r) && r.controller === faction)
}

export function controlledPopulation(state: GameState, faction: FactionId): number {
  return controlledRegions(state, faction).reduce((s, r) => s + r.population, 0)
}

export function manpowerCap(state: GameState, faction: FactionId): number {
  return Math.floor(controlledPopulation(state, faction) * MANPOWER_CAP_FRACTION)
}

/**
 * Remove `amount` people from a faction's controlled regions, proportionally to population
 * (largest-remainder rounding so the total is exact). Call on an Immer draft.
 */
export function drawPopulation(state: GameState, faction: FactionId, amount: number): void {
  const regions = controlledRegions(state, faction)
  const total = regions.reduce((s, r) => s + r.population, 0)
  if (amount <= 0 || total <= 0) return
  const exact = regions.map((r) => (amount * r.population) / total)
  const floors = exact.map((v) => Math.floor(v))
  let leftover = amount - floors.reduce((s, v) => s + v, 0)
  const order = exact.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (leftover <= 0) break
    floors[i] += 1
    leftover -= 1
  }
  regions.forEach((r, i) => {
    r.population -= floors[i]
  })
}
