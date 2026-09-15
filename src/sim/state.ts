import { DEFAULT_DISTANCE, type MapDefinition } from './data/dummyMap'
import { pairKey } from './relations'
import { computePulseSnapshot } from './snapshot'
import type { FactionId, FactionState, GameState, Region, RegionId, SimSettings } from './types'
import { FACTION_IDS, ZERO_ALLOCATION } from './types'

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

/** Edge lengths: the default for every edge, then the map's overrides (which must name real edges). */
export function buildDistances(edges: [RegionId, RegionId][], overrides: [RegionId, RegionId, number][] = []) {
  const distances: Record<string, number> = {}
  for (const [a, b] of edges) distances[pairKey(a, b)] = DEFAULT_DISTANCE
  for (const [a, b, miles] of overrides) {
    if (!(pairKey(a, b) in distances)) throw new Error(`Distance for non-edge ${a} ↔ ${b}`)
    distances[pairKey(a, b)] = miles
  }
  return distances
}

function initialFaction(id: FactionId): FactionState {
  return {
    id,
    money: 0,
    research: 0,
    legitimacy: 0,
    manpower: 0,
    focus: 'balanced',
    allocation: { ...ZERO_ALLOCATION },
    projects: [],
    nextProjectId: 1,
    manpowerRemainder: 0,
    stockpile: {},
    manufacturing: {},
    constructionLeftover: 0,
    designs: [],
    nextDesignId: 1,
  }
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

  const state: GameState = {
    tick: 0,
    pulse: { totalSupply: 0, totalDemand: 0, fairShare: 1, energy: {}, weather: {} },
    regions,
    regionOrder,
    adjacency: buildAdjacency(regionOrder, map.edges),
    distances: buildDistances(map.edges, map.distances),
    factions,
    relations: { factions: {}, countries: {} },
    taskForces: [],
    nextTaskForceId: 1,
    battles: [],
    nextBattleId: 1,
    globalTension: 0,
    rngSeed: seed,
    settings: { ...DEFAULT_SETTINGS },
    log: [],
    interrupts: [],
  }
  state.pulse = computePulseSnapshot(state)
  return state
}
