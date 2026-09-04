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

export type ProductionCategory = 'equipment' | 'manpower' | 'construction'

/** This pulse's Production split for a faction, fixed at pulse start (skeleton §4.3). */
export interface ProductionAllocation {
  total: number
  equipment: number
  manpower: number
  construction: number
  /** Every destination was capped or empty — Production had nowhere to go. */
  warning: boolean
}

export const ZERO_ALLOCATION: ProductionAllocation = { total: 0, equipment: 0, manpower: 0, construction: 0, warning: false }

/** One grid square under construction. Only one level receives progress at a time. */
export interface ConstructionProject {
  id: number
  regionId: RegionId
  building: BuildingType
  /** The level currently being built. */
  level: number
  /** Locked when this level started building. */
  cost: number
  progress: number
  /** Further levels queued behind this one; each is priced when it actually starts. */
  queuedLevels: number
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
  allocation: ProductionAllocation
  projects: ConstructionProject[]
  nextProjectId: number
  /** Banked fractional conversion progress (floor, carry forward). */
  equipmentRemainder: number
  manpowerRemainder: number
  /** Construction stream with no project to flow into; rerouted at pulse end. */
  constructionLeftover: number
}

/** Something that auto-pauses the game and needs the player's attention. */
export type Interrupt = {
  kind: 'construction-complete'
  faction: FactionId
  regionId: RegionId
  building: BuildingType
  level: number
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

/** Outcome of the Energy sourcing calculation for one consuming region this Pulse. */
export interface EnergyResult {
  demand: number
  /** demand × global fair share — the universal baseline before blockade effects. */
  entitlement: number
  delivered: number
  /** delivered ÷ demand, 0–1. Fossil output is curtailed by this. */
  fulfillment: number
  /** Regions actually drawn from, in order. */
  sources: RegionId[]
}

/**
 * Values computed once at pulse start and held for the whole pulse (skeleton §1.4, §4.4).
 * A snapshot of computed outcomes — never edited directly; edit the inputs instead.
 */
export interface PulseSnapshot {
  totalSupply: number
  totalDemand: number
  /** min(1, supply ÷ demand): every faction gets this share of its own demand under shortage. */
  fairShare: number
  energy: Record<RegionId, EnergyResult>
  /** Weather state at pulse start, used for Renewable output all pulse. */
  weather: Record<RegionId, boolean>
}

export interface GameState {
  /** Absolute tick count since game start. */
  tick: number
  pulse: PulseSnapshot
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
  interrupts: Interrupt[]
}
