// Shared scaffolding for sim tests: the handful of things nearly every scenario test needs — a fresh
// sandbox, a way to run the clock, a filled Task Force. Test-only; nothing in the app imports this.
//
// A typical scenario:
//
//   const s = newGame((d) => {
//     giveRegion(d, 'c-land', CN)
//     setFactionRelation(d, US, CN, 'hostile')
//     for (const f of [US, CN]) saveDesign(d, f, LIGHT_INFANTRY)   // design id 1 in each roster
//     raiseTaskForce(d, US, 'w-land', [[1, 12]])                    // Task Force id 1
//     raiseTaskForce(d, CN, 'c-land', [[1, 6]])                     // Task Force id 2
//     orderMove(d, 1, 'c-land')
//   })
//   const later = ticks(s, 48)
//
// Ids are handed out in order starting from 1 (designs per faction, Task Forces game-wide), and the
// default seed is fixed, so a scenario plays out the same way on every run.

import { produce } from 'immer'
import { advanceTick } from './advance'
import { DUMMY_MAP } from './data/dummyMap'
import type { DesignInput } from './military/roster'
import { createTaskForce, fillTaskForce, setTarget } from './military/taskForce'
import { createInitialState } from './state'
import type { FactionId, GameState, LandRegion, RegionId } from './types'
import { isLand } from './types'

export const US = 'united-states' as const satisfies FactionId
export const CN = 'china' as const satisfies FactionId

/** The cheapest legal design: one Small Arms module (50 Production, 50 Manpower). */
export const LIGHT_INFANTRY: DesignInput = {
  name: 'Light Infantry',
  platform: 'infantry',
  modules: ['inf-small-arms-1'],
}
/** A Long-Range Fires unit that can't hold the Front Line. */
export const TOWED_ARTILLERY: DesignInput = { name: 'Towed Artillery', platform: 'artillery', modules: ['art-tube'] }

/** A fresh dummy-map sandbox, optionally edited by `setup` (which receives an Immer draft). */
export function newGame(setup?: (draft: GameState) => void, seed = 1): GameState {
  const state = createInitialState(DUMMY_MAP, seed)
  return setup ? produce(state, (d) => void setup(d)) : state
}

/** Advance `n` ticks. Auto-pause conditions (pulse end, interrupts) are ignored, as in `advancePulse`. */
export function ticks(state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) state = advanceTick(state).state
  return state
}

/** A land region by id; throws rather than returning a maritime region or undefined. */
export function land(state: GameState, id: RegionId): LandRegion {
  const region = state.regions[id]
  if (!region || !isLand(region)) throw new Error(`"${id}" is not a land region`)
  return region
}

/** Hand a land region to a faction (or to no one). Call on a draft. */
export function giveRegion(draft: GameState, id: RegionId, controller: FactionId | null): void {
  land(draft, id).controller = controller
}

/**
 * Raise a Task Force and fill it to target instantly, bypassing the production pipeline. `units` is
 * [design id, count] pairs from the faction's roster; new units auto-place on their first eligible
 * line. Returns the Task Force id. Call on a draft.
 */
export function raiseTaskForce(
  draft: GameState,
  faction: FactionId,
  regionId: RegionId,
  units: [designId: number, count: number][],
): number {
  const created = createTaskForce(draft, faction, regionId)
  if (!created.ok) throw new Error(created.reason)
  for (const [designId, count] of units) {
    const r = setTarget(draft, created.id, designId, count)
    if (!r.ok) throw new Error(r.reason)
  }
  fillTaskForce(draft, created.id)
  return created.id
}
