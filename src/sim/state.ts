import type { MapDefinition } from './data/dummyMap'
import type { FactionId, FactionState, GameState, Region, RegionId, SimSettings } from './types'
import { FACTION_IDS } from './types'

export const DEFAULT_SETTINGS: SimSettings = {
  weatherChancePerTick: 0,
  weatherDurationTicks: 24,
  immigrationRate: 0.001,
}

/** Build a symmetric adjacency map from once-listed undirected edges. */
export function buildAdjacency(regionIds: RegionId[], edges: [RegionId, RegionId][]): Record<RegionId, RegionId[]> {
  const adjacency: Record<RegionId, RegionId[]> = {}
  for (const id of regionIds) adjacency[id] = []
  for (const [a, b] of edges) {
    if (!(a in adjacency)) throw new Error(`Edge references unknown region "${a}"`)
    if (!(b in adjacency)) throw new Error(`Edge references unknown region "${b}"`)
    if (a === b) throw new Error(`Self-edge on region "${a}"`)
    if (adjacency[a].includes(b)) throw new Error(`Duplicate edge ${a} ↔ ${b}`)
    adjacency[a].push(b)
    adjacency[b].push(a)
  }
  return adjacency
}

function initialFaction(id: FactionId): FactionState {
  return { id, money: 0, research: 0, legitimacy: 0, equipment: 0, manpower: 0, focus: 'balanced' }
}

export function createInitialState(map: MapDefinition, seed = 1): GameState {
  const regions: Record<RegionId, Region> = {}
  const regionOrder: RegionId[] = []
  for (const region of map.regions) {
    if (region.id in regions) throw new Error(`Duplicate region id "${region.id}"`)
    regions[region.id] = structuredClone(region)
    regionOrder.push(region.id)
  }

  const factions = {} as Record<FactionId, FactionState>
  for (const id of FACTION_IDS) factions[id] = initialFaction(id)

  return {
    tick: 0,
    regions,
    regionOrder,
    adjacency: buildAdjacency(regionOrder, map.edges),
    factions,
    globalTension: 0,
    rngSeed: seed,
    settings: { ...DEFAULT_SETTINGS },
    log: [],
  }
}
