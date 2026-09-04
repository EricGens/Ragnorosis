// The 13-region dummy map (skeleton §1.1, §1.6, §4.2.1). This is data, not a special case:
// swapping in the full 190-region map means replacing this file, not the code that reads it.

import type {
  BuildingType,
  FactionId,
  LandRegion,
  MaritimeRegion,
  Region,
  RegionId,
  Superiority,
  TerrainTrait,
} from '../types'
import { FACTION_IDS } from '../types'

/** Authored map: regions plus each undirected edge listed once. */
export interface MapDefinition {
  regions: Region[]
  edges: [RegionId, RegionId][]
  layout: Record<RegionId, MapLayout>
}

/** Where a region sits on the rendered map. Land regions occupy grid cells; maritime regions wrap a corner. */
export type MapLayout = { kind: 'grid'; col: number; row: number } | { kind: 'corner'; corner: 'nw' | 'ne' | 'sw' | 'se' }

const DEFAULT_POPULARITY = 75
const DEFAULT_SUPERIORITY: Superiority = { air: 100, sea: 100 }

function forAllFactions<T>(value: T, overrides: Partial<Record<FactionId, T>> = {}): Record<FactionId, T> {
  const out = {} as Record<FactionId, T>
  for (const id of FACTION_IDS) out[id] = overrides[id] ?? value
  return out
}

function superiority(): Record<FactionId, Superiority> {
  return forAllFactions<Superiority>({ ...DEFAULT_SUPERIORITY })
}

interface LandOverrides {
  population?: number
  gdp?: number
  stability?: number
  energyReserve?: number
  traits?: TerrainTrait[]
  popularity?: Partial<Record<FactionId, number>>
  buildings?: Partial<Record<BuildingType, number>>
}

function land(
  id: RegionId,
  name: string,
  country: string,
  controller: FactionId | null,
  o: LandOverrides = {},
): LandRegion {
  return {
    id,
    name,
    type: 'land',
    country,
    controller,
    population: o.population ?? 10_000_000,
    gdp: o.gdp ?? 500e9,
    stability: o.stability ?? 50,
    energyReserve: o.energyReserve ?? 100,
    traits: o.traits ?? [],
    popularity: forAllFactions(DEFAULT_POPULARITY, o.popularity),
    buildings: o.buildings ?? {},
    weatherActive: false,
    weatherTicksRemaining: 0,
    superiority: superiority(),
  }
}

function maritime(id: RegionId, name: string, energyReserve = 0): MaritimeRegion {
  return {
    id,
    name,
    type: 'maritime',
    energyReserve,
    weatherActive: false,
    weatherTicksRemaining: 0,
    superiority: superiority(),
  }
}

const RUGGED_MOUNTAINOUS: TerrainTrait[] = ['rugged', 'mountainous']

export const DUMMY_MAP: MapDefinition = {
  regions: [
    land('nw-land', 'NW Land', 'United States', 'united-states', {
      buildings: { 'fossil-fuel-plant': 4, 'renewable-plant': 1, 'production-facility': 2, 'training-facility': 2 },
    }),
    land('n-land', 'N Land', 'United States', 'united-states', {
      traits: RUGGED_MOUNTAINOUS,
      energyReserve: 1500,
      buildings: { 'fossil-fuel-plant': 4, 'renewable-plant': 1, 'production-facility': 5, fortification: 5 },
    }),
    land('ne-land', 'NE Land', 'France', null, {
      buildings: { 'fossil-fuel-plant': 3, 'renewable-plant': 1 },
    }),
    land('w-land', 'W Land', 'United States', 'united-states', {
      popularity: { gamer: 40 },
      buildings: { 'fossil-fuel-plant': 3, 'renewable-plant': 1 },
    }),
    land('c-land', 'C Land', 'Taiwan', 'hive', {
      traits: RUGGED_MOUNTAINOUS,
      energyReserve: 10,
      buildings: { 'fossil-fuel-plant': 4, 'renewable-plant': 5, 'production-facility': 10, fortification: 10 },
    }),
    land('e-land', 'E Land', 'China', 'china', {
      popularity: { gamer: 5 },
      buildings: { 'fossil-fuel-plant': 3, 'renewable-plant': 1 },
    }),
    land('sw-land', 'SW Land', 'Mexico', 'mankind-united', {
      population: 100_000_000,
      gdp: 100e9,
      stability: 25,
      popularity: {
        'mankind-united': 75,
        'red-queen': 0,
        laserward: 10,
        china: 20,
        hive: 30,
        widows: 40,
        'united-states': 50,
        gamer: 60,
      },
      buildings: { 'fossil-fuel-plant': 3, 'training-facility': 5 },
    }),
    land('s-land', 'S Land', 'China', 'china', {
      buildings: { 'fossil-fuel-plant': 3 },
    }),
    land('se-land', 'SE Land', 'China', 'china', {
      gdp: 2e12,
      stability: 90,
      buildings: { 'fossil-fuel-plant': 4, 'training-facility': 3 },
    }),
    maritime('nw-maritime', 'NW Maritime'),
    maritime('ne-maritime', 'NE Maritime'),
    maritime('sw-maritime', 'SW Maritime', 1000),
    maritime('se-maritime', 'SE Maritime'),
  ],
  edges: [
    // Land grid, orthogonal only
    ['nw-land', 'n-land'],
    ['n-land', 'ne-land'],
    ['w-land', 'c-land'],
    ['c-land', 'e-land'],
    ['sw-land', 's-land'],
    ['s-land', 'se-land'],
    ['nw-land', 'w-land'],
    ['w-land', 'sw-land'],
    ['n-land', 'c-land'],
    ['c-land', 's-land'],
    ['ne-land', 'e-land'],
    ['e-land', 'se-land'],
    // Maritime ring
    ['nw-maritime', 'ne-maritime'],
    ['ne-maritime', 'se-maritime'],
    ['se-maritime', 'sw-maritime'],
    ['sw-maritime', 'nw-maritime'],
    // Coasts: corners touch one maritime region, edge-middles touch two
    ['nw-maritime', 'nw-land'],
    ['nw-maritime', 'n-land'],
    ['nw-maritime', 'w-land'],
    ['ne-maritime', 'ne-land'],
    ['ne-maritime', 'n-land'],
    ['ne-maritime', 'e-land'],
    ['sw-maritime', 'sw-land'],
    ['sw-maritime', 'w-land'],
    ['sw-maritime', 's-land'],
    ['se-maritime', 'se-land'],
    ['se-maritime', 'e-land'],
    ['se-maritime', 's-land'],
  ],
  layout: {
    'nw-land': { kind: 'grid', col: 0, row: 0 },
    'n-land': { kind: 'grid', col: 1, row: 0 },
    'ne-land': { kind: 'grid', col: 2, row: 0 },
    'w-land': { kind: 'grid', col: 0, row: 1 },
    'c-land': { kind: 'grid', col: 1, row: 1 },
    'e-land': { kind: 'grid', col: 2, row: 1 },
    'sw-land': { kind: 'grid', col: 0, row: 2 },
    's-land': { kind: 'grid', col: 1, row: 2 },
    'se-land': { kind: 'grid', col: 2, row: 2 },
    'nw-maritime': { kind: 'corner', corner: 'nw' },
    'ne-maritime': { kind: 'corner', corner: 'ne' },
    'sw-maritime': { kind: 'corner', corner: 'sw' },
    'se-maritime': { kind: 'corner', corner: 'se' },
  },
}
