import type { LandRegion } from '../types'

export const BASE_DEFENSIBILITY = 10
export const DEFENSIBILITY_PER_TRAIT = 10
export const DEFENSIBILITY_PER_FORTIFICATION = 5

/** Computed, never stored: base + terrain traits + Fortification levels. */
export function defensibility(region: LandRegion): number {
  const fort = region.buildings.fortification ?? 0
  return (
    BASE_DEFENSIBILITY +
    DEFENSIBILITY_PER_TRAIT * region.traits.length +
    DEFENSIBILITY_PER_FORTIFICATION * fort
  )
}
