import type { LandRegion } from '../types'

export const POPULATION_PER_PRODUCTION = 100_000
export const PLANT_OUTPUT_PER_LEVEL = 100
export const FOSSIL_ENERGY_PER_LEVEL = 100
export const WEATHER_RENEWABLE_FACTOR = 0.5
/** Supply : Production, before tech modifiers. */
export const SUPPLY_RATIO = 1

export interface ProductionBreakdown {
  population: number
  fossil: number
  renewable: number
  total: number
}

/** Energy a region's Fossil Fuel Plant demands per Pulse. */
export function fossilEnergyDemand(region: LandRegion): number {
  return (region.buildings['fossil-fuel-plant'] ?? 0) * FOSSIL_ENERGY_PER_LEVEL
}

/**
 * Region Production per Pulse, computed fresh. `energyFulfillment` is the fraction of Fossil demand
 * actually delivered this Pulse (0–1); `weatherActive` is the pulse-start snapshot.
 */
export function regionProduction(region: LandRegion, energyFulfillment = 1, weatherActive = region.weatherActive): ProductionBreakdown {
  const population = Math.floor(region.population / POPULATION_PER_PRODUCTION)
  const fossil = (region.buildings['fossil-fuel-plant'] ?? 0) * PLANT_OUTPUT_PER_LEVEL * energyFulfillment
  const renewable =
    (region.buildings['renewable-plant'] ?? 0) * PLANT_OUTPUT_PER_LEVEL * (weatherActive ? WEATHER_RENEWABLE_FACTOR : 1)
  return { population, fossil, renewable, total: population + fossil + renewable }
}

/** Supply is derived from Production, never stored. */
export function regionSupply(production: number): number {
  return production * SUPPLY_RATIO
}
