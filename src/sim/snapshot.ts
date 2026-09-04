import { allocateEnergy } from './formulas/energy'
import { regionProduction, type ProductionBreakdown } from './formulas/production'
import type { GameState, LandRegion, PulseSnapshot, RegionId } from './types'

/** Compute the pulse-start snapshot: Energy allocation and the Weather state Renewables use all pulse. */
export function computePulseSnapshot(state: GameState): PulseSnapshot {
  const { totalSupply, totalDemand, fairShare, results } = allocateEnergy(state)
  const weather: Record<RegionId, boolean> = {}
  for (const id of state.regionOrder) weather[id] = state.regions[id].weatherActive
  return { totalSupply, totalDemand, fairShare, energy: results, weather }
}

/** A region's Production this pulse, using the pulse-start Energy and Weather snapshot. */
export function productionFor(state: GameState, region: LandRegion): ProductionBreakdown {
  const energy = state.pulse.energy[region.id]
  return regionProduction(region, energy ? energy.fulfillment : 1, state.pulse.weather[region.id] ?? region.weatherActive)
}
