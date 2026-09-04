// Production → Equipment / Manpower conversion (skeleton §4.5). These accumulate toward discrete
// units, so fractions are floored and banked, never discarded.

import { productionFor } from '../snapshot'
import type { BuildingType, FactionId, GameState } from '../types'
import { isLand } from '../types'

export const FACILITY_BONUS_PER_LEVEL = 0.2

/** output_per_point = base × (1 + 0.20 × level) — linear, not compounding. */
export function facilityMultiplier(level: number): number {
  return 1 + FACILITY_BONUS_PER_LEVEL * level
}

/**
 * A faction's effective conversion multiplier for a facility type. Production is pooled
 * faction-wide, so each region's facility improves conversion of that region's own contribution:
 * the multiplier is the Production-weighted average across controlled regions.
 */
export function factionFacilityMultiplier(
  state: GameState,
  faction: FactionId,
  facility: Extract<BuildingType, 'production-facility' | 'training-facility'>,
): number {
  let weighted = 0
  let total = 0
  for (const id of state.regionOrder) {
    const r = state.regions[id]
    if (!isLand(r) || r.controller !== faction) continue
    const p = productionFor(state, r).total
    weighted += p * facilityMultiplier(r.buildings[facility] ?? 0)
    total += p
  }
  return total > 0 ? weighted / total : 1
}

/** Floor to whole units, carrying the fraction forward. */
export function convertWithRemainder(points: number, multiplier: number, remainder: number): { units: number; remainder: number } {
  const raw = points * multiplier + remainder
  const units = Math.floor(raw + 1e-9)
  return { units, remainder: raw - units }
}
