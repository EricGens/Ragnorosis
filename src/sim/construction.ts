// Construction queue rules (skeleton §4.3, §4.7). Every building type occupies one grid square for
// its whole leveled lifetime; only one level per square receives progress at a time; a square
// with queued levels still counts as a single project slot.

import { BUILDINGS, buildingCost } from './data/buildings'
import type { BuildingType, ConstructionProject, FactionId, GameState, RegionId } from './types'
import { isLand } from './types'

export const MAX_ACTIVE_PROJECTS = 4

export type QueueResult = { ok: true } | { ok: false; reason: string }

export function findProject(state: GameState, faction: FactionId, regionId: RegionId, building: BuildingType): ConstructionProject | undefined {
  return state.factions[faction].projects.find((p) => p.regionId === regionId && p.building === building)
}

/** Building types a faction may start fresh in a region: allowed, and not already on the grid. */
export function availableBuildings(state: GameState, faction: FactionId, regionId: RegionId): BuildingType[] {
  const region = state.regions[regionId]
  if (!isLand(region) || region.controller !== faction) return []
  return (Object.keys(BUILDINGS) as BuildingType[]).filter(
    (type) => !(region.buildings[type] ?? 0) && !findProject(state, faction, regionId, type),
  )
}

export function canQueueBuild(state: GameState, faction: FactionId, regionId: RegionId, building: BuildingType): QueueResult {
  const region = state.regions[regionId]
  if (!isLand(region)) return { ok: false, reason: 'Buildings can only be placed in land regions.' }
  if (region.controller !== faction) return { ok: false, reason: 'You do not control this region.' }

  const def = BUILDINGS[building]
  const current = region.buildings[building] ?? 0
  const existing = findProject(state, faction, regionId, building)
  const highestPlanned = existing ? existing.level + existing.queuedLevels : current
  if (def.maxLevel !== undefined && highestPlanned >= def.maxLevel) {
    return { ok: false, reason: `${def.name} is capped at level ${def.maxLevel}.` }
  }
  if (!existing && state.factions[faction].projects.length >= MAX_ACTIVE_PROJECTS) {
    return { ok: false, reason: `At most ${MAX_ACTIVE_PROJECTS} projects can be under construction at once.` }
  }
  return { ok: true }
}

/** Queue a new building or the next level of an existing one. Call on an Immer draft. */
export function queueBuild(state: GameState, faction: FactionId, regionId: RegionId, building: BuildingType): QueueResult {
  const check = canQueueBuild(state, faction, regionId, building)
  if (!check.ok) return check

  const f = state.factions[faction]
  const existing = findProject(state, faction, regionId, building)
  if (existing) {
    existing.queuedLevels += 1
    return { ok: true }
  }
  const region = state.regions[regionId]
  const level = (isLand(region) ? (region.buildings[building] ?? 0) : 0) + 1
  f.projects.push({
    id: f.nextProjectId++,
    regionId,
    building,
    level,
    cost: buildingCost(building, level),
    progress: 0,
    queuedLevels: 0,
  })
  return { ok: true }
}

/** Remove a project (and anything queued behind it). Progress already made is lost. */
export function cancelProject(state: GameState, faction: FactionId, projectId: number): void {
  const f = state.factions[faction]
  f.projects = f.projects.filter((p) => p.id !== projectId)
}
