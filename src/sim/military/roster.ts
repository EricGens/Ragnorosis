// Faction unit-design rosters (Epoch 2 skeleton §6 Unit Editor). Every function operates on an
// Immer draft and returns a result the UI can surface.

import { log } from '../log'
import type { FactionId, GameState, UnitDesign } from '../types'
import { designProblems } from './design'
import type { ModuleId, PlatformId } from './platforms'

export type RosterResult = { ok: true; id: number } | { ok: false; reason: string }

export interface DesignInput {
  /** Present when updating an existing design; its platform is fixed. */
  id?: number
  name: string
  platform: PlatformId
  modules: ModuleId[]
}

function nameTaken(designs: UnitDesign[], name: string, exceptId?: number): boolean {
  const key = name.trim().toLowerCase()
  return designs.some((d) => d.id !== exceptId && d.name.trim().toLowerCase() === key)
}

/** Create or update a design. Validates modules and enforces name uniqueness within the faction. */
export function saveDesign(state: GameState, faction: FactionId, input: DesignInput): RosterResult {
  const problems = designProblems(input.platform, input.modules)
  if (problems.length > 0) return { ok: false, reason: problems[0] }
  const name = input.name.trim()
  if (!name) return { ok: false, reason: 'Give the unit a name.' }

  const f = state.factions[faction]
  if (nameTaken(f.designs, name, input.id)) return { ok: false, reason: `A unit named "${name}" already exists.` }

  if (input.id !== undefined) {
    const existing = f.designs.find((d) => d.id === input.id)
    if (!existing) return { ok: false, reason: 'That unit no longer exists.' }
    if (existing.platform !== input.platform) return { ok: false, reason: "A unit's platform can't change once built." }
    existing.name = name
    existing.modules = [...input.modules]
    log(state, 'dev', `${faction}: updated unit design "${name}"`)
    return { ok: true, id: existing.id }
  }

  const design: UnitDesign = { id: f.nextDesignId++, name, platform: input.platform, modules: [...input.modules] }
  f.designs.push(design)
  log(state, 'dev', `${faction}: saved unit design "${name}"`)
  return { ok: true, id: design.id }
}

export function renameDesign(state: GameState, faction: FactionId, id: number, name: string): RosterResult {
  const f = state.factions[faction]
  const design = f.designs.find((d) => d.id === id)
  if (!design) return { ok: false, reason: 'That unit no longer exists.' }
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, reason: 'Give the unit a name.' }
  if (nameTaken(f.designs, trimmed, id)) return { ok: false, reason: `A unit named "${trimmed}" already exists.` }
  design.name = trimmed
  return { ok: true, id }
}

/** Remove a design from the roster. (Task Force cleanup attaches here once Task Forces exist.) */
export function deleteDesign(state: GameState, faction: FactionId, id: number): void {
  const f = state.factions[faction]
  const design = f.designs.find((d) => d.id === id)
  if (!design) return
  f.designs = f.designs.filter((d) => d.id !== id)
  log(state, 'dev', `${faction}: deleted unit design "${design.name}"`)
}
