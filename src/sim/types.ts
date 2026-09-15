// Core simulation types. This module has no dependencies on React or the store.

export type RegionId = string

export type FactionId =
  'mankind-united' | 'china' | 'united-states' | 'widows' | 'laserward' | 'hive' | 'gamer' | 'red-queen'

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
  'fossil-fuel-plant' | 'renewable-plant' | 'production-facility' | 'training-facility' | 'fortification'

export type Focus = 'balanced' | 'equipment' | 'manpower' | 'construction'

interface RegionBase {
  id: RegionId
  name: string
  /** Fossil-fuel supply rate per Pulse (not a depleting stock). */
  energyReserve: number
  weatherActive: boolean
  weatherTicksRemaining: number
}

/** Faction-level relationship: symmetric, one shared state per pair. */
export type FactionRelation = 'friendly' | 'neutral' | 'hostile'
/** Country-level relationship: symmetric, one shared state per pair. */
export type CountryRelation = 'peace' | 'war'

/** Sorted "a|b" pair keys → state. Unstored pairs are Neutral / At Peace. */
export interface RelationState {
  factions: Record<string, FactionRelation>
  countries: Record<string, CountryRelation>
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

export const ZERO_ALLOCATION: ProductionAllocation = {
  total: 0,
  equipment: 0,
  manpower: 0,
  construction: 0,
  warning: false,
}

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

/** A saved unit design: a platform plus its equipped module multiset (Epoch 2 skeleton §3, §6). */
export interface UnitDesign {
  id: number
  /** Player-facing name; unique within a faction's roster. */
  name: string
  platform: 'infantry'
  modules: string[]
}

/** Resource priority of one unit type inside one Task Force (§3.8): the tier it draws from in the waterfall. */
export type Priority = 'high' | 'normal' | 'low'
export const PRIORITIES: readonly Priority[] = ['high', 'normal', 'low']

/** One cell of a Task Force's composition grid (§6): a desired count and what's actually filled so far. */
export interface CompositionLine {
  designId: number
  /** Desired unit count, set with +/−. */
  target: number
  priority: Priority
  /** Whole units' worth of Equipment on hand — Equipment is binary per unit (§3.10). */
  equipment: number
  /** People assigned; fills linearly toward target × the design's Manpower (§3.10). */
  manpower: number
}

export type LineRole = 'frontLine' | 'longRange' | 'cas'
export const LINE_ROLES: readonly LineRole[] = ['frontLine', 'longRange', 'cas']
/** Slots per combat role (§5.1–5.3); each slot holds one unit. Reserves are everything unassigned. */
export const LINE_SLOTS: Record<LineRole, number> = { frontLine: 12, longRange: 12, cas: 6 }

export interface TaskForce {
  id: number
  name: string
  faction: FactionId
  regionId: RegionId
  composition: CompositionLine[]
  /** Per role, the design id in each slot (null = empty). */
  lines: Record<LineRole, (number | null)[]>
}

export interface FactionState {
  id: FactionId
  money: number
  research: number
  legitimacy: number
  manpower: number
  focus: Focus
  allocation: ProductionAllocation
  projects: ConstructionProject[]
  nextProjectId: number
  /** Banked fractional Manpower conversion progress (floor, carry forward). */
  manpowerRemainder: number
  /** Finished Equipment not assigned to any Task Force, per design id (§3.9). */
  stockpile: Record<string, number>
  /** Production banked toward the next whole unit of each Equipment SKU, per design id. */
  manufacturing: Record<string, number>
  /** Construction stream with no project to flow into; rerouted at pulse end. */
  constructionLeftover: number
  /** The Unit Editor roster (Epoch 2 skeleton §6). */
  designs: UnitDesign[]
  nextDesignId: number
}

/** Something that auto-pauses the game and needs the player's attention. */
export type Interrupt = {
  kind: 'construction-complete'
  faction: FactionId
  regionId: RegionId
  building: BuildingType
  level: number
}

export type LogCategory = 'time' | 'economy' | 'stability' | 'energy' | 'construction' | 'weather' | 'military' | 'dev'

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
  relations: RelationState
  taskForces: TaskForce[]
  nextTaskForceId: number
  globalTension: number
  rngSeed: number
  settings: SimSettings
  log: LogEntry[]
  interrupts: Interrupt[]
}
