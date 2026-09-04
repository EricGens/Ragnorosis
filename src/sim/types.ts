// Core simulation types. This module has no dependencies on React or the store.

export type RegionId = string

export type FactionId =
  | 'mankind-united'
  | 'china'
  | 'united-states'
  | 'widows'
  | 'laserward'
  | 'hive'
  | 'gamer'
  | 'red-queen'

export const FACTION_IDS: readonly FactionId[] = [
  'mankind-united',
  'china',
  'united-states',
  'widows',
  'laserward',
  'hive',
  'gamer',
  'red-queen',
]

/** Closed enum: determines move legality and map rendering. Never runtime-editable. */
export type RegionType = 'land' | 'maritime'

/** Open-ended descriptive tags: modify behavior/stats without touching legality. */
export type TerrainTrait = 'rugged' | 'mountainous'

export type BuildingType =
  | 'fossil-fuel-plant'
  | 'renewable-plant'
  | 'production-facility'
  | 'training-facility'
  | 'fortification'

export type Focus = 'balanced' | 'equipment' | 'manpower' | 'construction'

/** Per-region, per-faction domain access, 0–100. Dev-editable placeholder until real domain control exists. */
export interface Superiority {
  air: number
  sea: number
}

interface RegionBase {
  id: RegionId
  name: string
  /** Fossil-fuel supply rate per Pulse (not a depleting stock). */
  energyReserve: number
  weatherActive: boolean
  weatherTicksRemaining: number
  superiority: Record<FactionId, Superiority>
}

export interface LandRegion extends RegionBase {
  type: 'land'
  country: string
  controller: FactionId | null
  population: number
  /** Annual GDP in current dollars. */
  gdp: number
  /** 0.0–100.0 */
  stability: number
  /** Per faction, 0–100, non-summing. */
  popularity: Record<FactionId, number>
  traits: TerrainTrait[]
  /** Building type → current level. Absent = not built. */
  buildings: Partial<Record<BuildingType, number>>
}

export interface MaritimeRegion extends RegionBase {
  type: 'maritime'
}

export type Region = LandRegion | MaritimeRegion

export function isLand(region: Region): region is LandRegion {
  return region.type === 'land'
}

export interface FactionState {
  id: FactionId
  money: number
  research: number
  legitimacy: number
  /** Small Arms — the only Equipment type in Epoch 1. */
  equipment: number
  manpower: number
  focus: Focus
}

export type LogCategory = 'time' | 'economy' | 'stability' | 'energy' | 'construction' | 'weather' | 'dev'

export interface LogEntry {
  tick: number
  category: LogCategory
  message: string
}

export interface SimSettings {
  /** Probability per tick that inactive Weather activates in a region. Dev-editable; 0 in the sandbox. */
  weatherChancePerTick: number
  weatherDurationTicks: number
  /** Fraction of source population moved per neighbor pair per Pulse at a 100-point Stability delta. */
  immigrationRate: number
}

export interface GameState {
  /** Absolute tick count since game start. */
  tick: number
  regions: Record<RegionId, Region>
  /** Stable display/iteration order. */
  regionOrder: RegionId[]
  /** Pure boolean topology, symmetric. */
  adjacency: Record<RegionId, RegionId[]>
  factions: Record<FactionId, FactionState>
  globalTension: number
  rngSeed: number
  settings: SimSettings
  log: LogEntry[]
}
