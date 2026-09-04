// Production pool → allocation → conversions. Every function here operates on an Immer draft.

import { TICKS_PER_PULSE } from '../clock'
import { BUILDINGS, buildingCost } from '../data/buildings'
import { formatInt } from '../format'
import { allocateProduction } from '../formulas/allocation'
import { convertWithRemainder, factionFacilityMultiplier } from '../formulas/conversion'
import { controlledRegions, drawPopulation, manpowerCap } from '../formulas/manpower'
import { log } from '../log'
import { productionFor } from '../snapshot'
import type { ConstructionProject, FactionId, GameState, LandRegion, ProductionAllocation } from '../types'
import { FACTION_IDS } from '../types'

/** Aggregate Production across a faction's controlled regions this pulse. */
export function factionProduction(state: GameState, faction: FactionId): number {
  return controlledRegions(state, faction).reduce((s, r) => s + productionFor(state, r).total, 0)
}

/** The allocation the faction's current focus would produce right now (pure; used for previews too). */
export function computeAllocation(state: GameState, faction: FactionId): ProductionAllocation {
  const f = state.factions[faction]
  return allocateProduction(factionProduction(state, faction), f.focus, {
    manpowerCapRoom: manpowerCap(state, faction) - f.manpower,
    hasProjects: f.projects.length > 0,
  })
}

/** Pulse start (first tick): fix every faction's allocation from its focus as of this moment. */
export function allocateAllFactions(state: GameState): void {
  for (const id of FACTION_IDS) {
    const f = state.factions[id]
    f.allocation = computeAllocation(state, id)
    f.constructionLeftover = 0
    if (f.allocation.total > 0) {
      const a = f.allocation
      log(
        state,
        'economy',
        `${id}: Production ${formatInt(a.total)} → Equipment ${formatInt(a.equipment)} / Manpower ${formatInt(a.manpower)} / Construction ${formatInt(a.construction)} (${f.focus})${a.warning ? ' — nowhere to go!' : ''}`,
      )
    }
  }
}

/** Per tick: Construction's share streams evenly into active projects; completed levels fire an interrupt. */
export function streamConstruction(state: GameState): void {
  for (const id of FACTION_IDS) {
    const f = state.factions[id]
    const perTick = f.allocation.construction / TICKS_PER_PULSE
    if (perTick <= 0) continue
    if (f.projects.length === 0) {
      f.constructionLeftover += perTick
      continue
    }
    const each = perTick / f.projects.length
    for (const p of [...f.projects]) {
      p.progress += each
      // A cheap queued level can complete in the same tick; keep going while the square is active.
      while (p.progress + 1e-9 >= p.cost && completeLevel(state, id, p)) {
        /* next queued level */
      }
    }
  }
}

/** Finish the level under construction. Returns true if the square still has a level building. */
function completeLevel(state: GameState, faction: FactionId, p: ConstructionProject): boolean {
  const f = state.factions[faction]
  const region = state.regions[p.regionId] as LandRegion
  region.buildings[p.building] = p.level
  state.interrupts.push({ kind: 'construction-complete', faction, regionId: p.regionId, building: p.building, level: p.level })
  log(state, 'construction', `${BUILDINGS[p.building].name} level ${p.level} completed in ${region.name}`)

  const excess = p.progress - p.cost
  if (p.queuedLevels > 0) {
    p.queuedLevels -= 1
    p.level += 1
    p.cost = buildingCost(p.building, p.level) // priced now, not when it was queued
    p.progress = excess
    return true
  }
  f.projects = f.projects.filter((x) => x.id !== p.id)
  f.constructionLeftover += excess
  return false
}

/** Pulse end: Equipment and Manpower land in the stockpiles; stranded Construction points reroute. */
export function creditPulseOutputs(state: GameState): void {
  for (const id of FACTION_IDS) {
    const f = state.factions[id]
    const a = f.allocation
    let equipmentPoints = a.equipment
    let manpowerPoints = a.manpower

    if (f.constructionLeftover > 0) {
      const weight = a.equipment + a.manpower
      const toEquipment = weight > 0 ? (f.constructionLeftover * a.equipment) / weight : f.constructionLeftover
      equipmentPoints += toEquipment
      manpowerPoints += f.constructionLeftover - toEquipment
      f.constructionLeftover = 0
    }

    if (equipmentPoints > 0) {
      const r = convertWithRemainder(equipmentPoints, factionFacilityMultiplier(state, id, 'production-facility'), f.equipmentRemainder)
      f.equipment += r.units
      f.equipmentRemainder = r.remainder
      if (r.units > 0) log(state, 'economy', `${id} produces ${formatInt(r.units)} Small Arms`)
    }

    if (manpowerPoints > 0) {
      const r = convertWithRemainder(manpowerPoints, factionFacilityMultiplier(state, id, 'training-facility'), f.manpowerRemainder)
      const room = Math.max(0, manpowerCap(state, id) - f.manpower)
      const trained = Math.min(r.units, room)
      f.manpower += trained
      f.manpowerRemainder = r.remainder
      drawPopulation(state, id, trained)
      if (trained > 0) log(state, 'economy', `${id} trains ${formatInt(trained)} Manpower`)
    }
  }
}
