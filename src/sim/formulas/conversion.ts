// Production → Equipment / Manpower conversion (skeleton §4.5). These accumulate toward discrete
// units, so fractions are floored and banked, never discarded.

import type { BuildingType, FactionId, GameState } from '../types'
import { isLand } from '../types'

export const FACILITY_BONUS_PER_LEVEL = 0.2

/** output_per_point = base × (1 + 0.20 × level) — linear, not compounding. */
export function facilityMultiplier(level: number): number {
  return 1 + FACILITY_BONUS_PER_LEVEL * level
}

/**
 * A faction's effective conversion multiplier for a facility type. These represent nation-scale
 * infrastructure (a training pipeline, an industrial supply chain) that the whole faction draws
 * on regardless of where it's built, not a per-region bonus — so the multiplier is
 * facilityMultiplier() applied to the *sum* of levels across every controlled region. A faction
 * holding six regions with a level-1 facility each gets the same bonus as a one-region faction
 * with a single level-6 facility.
 */
export function factionFacilityMultiplier(
  state: GameState,
  faction: FactionId,
  facility: Extract<BuildingType, 'production-facility' | 'training-facility'>,
): number {
  let totalLevel = 0
  for (const id of state.regionOrder) {
    const r = state.regions[id]
    if (isLand(r) && r.controller === faction) totalLevel += r.buildings[facility] ?? 0
  }
  return facilityMultiplier(totalLevel)
}

/** Floor to whole units, carrying the fraction forward. */
export function convertWithRemainder(points: number, multiplier: number, remainder: number): { units: number; remainder: number } {
  const raw = points * multiplier + remainder
  const units = Math.floor(raw + 1e-9)
  return { units, remainder: raw - units }
}
