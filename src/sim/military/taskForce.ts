// Task Forces: composition grid + line assignment (Epoch 2 skeleton §6 Task Force Editor). Every
// mutating function operates on an Immer draft. Resources move with the edits: lowering a target
// returns Equipment to the stockpile and Manpower to the pool immediately, so nothing is stranded.

import { log } from '../log'
import type {
  CompositionLine,
  FactionId,
  GameState,
  LineRole,
  Priority,
  RegionId,
  TaskForce,
  UnitDesign,
} from '../types'
import { isLand, LINE_ROLES, LINE_SLOTS } from '../types'
import { designStats, findDuplicate } from './design'

export type TaskForceResult = { ok: true; id: number } | { ok: false; reason: string }

export function factionTaskForces(state: GameState, faction: FactionId): TaskForce[] {
  return state.taskForces.filter((tf) => tf.faction === faction)
}

export function findTaskForce(state: GameState, id: number): TaskForce | undefined {
  return state.taskForces.find((tf) => tf.id === id)
}

export function findDesign(state: GameState, faction: FactionId, designId: number): UnitDesign | undefined {
  return state.factions[faction].designs.find((d) => d.id === designId)
}

/** Manpower one full unit of this design needs. */
export function unitManpower(design: UnitDesign): number {
  return designStats(design.platform, design.modules).manpower
}

function emptyLines(): Record<LineRole, (number | null)[]> {
  return {
    frontLine: Array<number | null>(LINE_SLOTS.frontLine).fill(null),
    longRange: Array<number | null>(LINE_SLOTS.longRange).fill(null),
    cas: Array<number | null>(LINE_SLOTS.cas).fill(null),
  }
}

/** Raise an empty Task Force in a land region the faction controls. */
export function createTaskForce(
  state: GameState,
  faction: FactionId,
  regionId: RegionId,
  name?: string,
): TaskForceResult {
  const region = state.regions[regionId]
  if (!region || !isLand(region)) return { ok: false, reason: 'Task Forces can only be raised on land.' }
  if (region.controller !== faction) return { ok: false, reason: `You don't control ${region.name}.` }
  const id = state.nextTaskForceId++
  const tf: TaskForce = {
    id,
    name: (name ?? '').trim() || `Task Force ${id}`,
    faction,
    regionId,
    composition: [],
    lines: emptyLines(),
  }
  state.taskForces.push(tf)
  log(state, 'military', `${faction} raises ${tf.name} in ${region.name}`)
  return { ok: true, id }
}

export function renameTaskForce(state: GameState, id: number, name: string): void {
  const tf = findTaskForce(state, id)
  const trimmed = name.trim()
  if (tf && trimmed) tf.name = trimmed
}

/** Disband: Equipment returns to the stockpile, Manpower to the pool. */
export function deleteTaskForce(state: GameState, id: number): void {
  const tf = findTaskForce(state, id)
  if (!tf) return
  for (const line of [...tf.composition]) releaseLine(state, tf, line)
  state.taskForces = state.taskForces.filter((t) => t.id !== id)
  log(state, 'military', `${tf.faction} disbands ${tf.name}`)
}

function releaseLine(state: GameState, tf: TaskForce, line: CompositionLine): void {
  const f = state.factions[tf.faction]
  if (line.equipment > 0) f.stockpile[line.designId] = (f.stockpile[line.designId] ?? 0) + line.equipment
  f.manpower += line.manpower
  line.equipment = 0
  line.manpower = 0
}

/**
 * Set a unit type's desired count (+/−). Adding a type starts it at Normal priority; a target of 0
 * removes it. Anything filled beyond the new target returns to the stockpile/pool at once, and
 * line slots the count no longer covers are vacated.
 */
export function setTarget(state: GameState, tfId: number, designId: number, target: number): TaskForceResult {
  const tf = findTaskForce(state, tfId)
  if (!tf) return { ok: false, reason: 'That Task Force no longer exists.' }
  const design = findDesign(state, tf.faction, designId)
  if (!design) return { ok: false, reason: 'That unit design no longer exists.' }
  const f = state.factions[tf.faction]
  const next = Math.max(0, Math.floor(target))
  let line = tf.composition.find((l) => l.designId === designId)
  if (!line) {
    if (next === 0) return { ok: true, id: tfId }
    line = { designId, target: 0, priority: 'normal', equipment: 0, manpower: 0 }
    tf.composition.push(line)
  }
  line.target = next
  const mp = unitManpower(design)
  if (line.equipment > next) {
    f.stockpile[designId] = (f.stockpile[designId] ?? 0) + (line.equipment - next)
    line.equipment = next
  }
  if (line.manpower > next * mp) {
    f.manpower += line.manpower - next * mp
    line.manpower = next * mp
  }
  trimSlots(tf, designId, next)
  if (next === 0) tf.composition = tf.composition.filter((l) => l.designId !== designId)
  return { ok: true, id: tfId }
}

/** Normal → High → Low → Normal (§3.8 chevrons). */
export function cyclePriority(state: GameState, tfId: number, designId: number): void {
  const line = findTaskForce(state, tfId)?.composition.find((l) => l.designId === designId)
  if (!line) return
  const order: Priority[] = ['normal', 'high', 'low']
  line.priority = order[(order.indexOf(line.priority) + 1) % order.length]
}

/** Which roles a design may be assigned to (§5.1–5.3). Land platforms hold the line; standoff weapons reach. */
export function eligibleRoles(design: UnitDesign): LineRole[] {
  const stats = designStats(design.platform, design.modules)
  const roles: LineRole[] = ['frontLine']
  if (stats.standoffCapable) roles.push('longRange')
  // CAS needs an aircraft platform; none exists yet (Light Aircraft arrives with its own slice).
  return roles
}

/** Slots this design already occupies across every role. */
export function assignedCount(tf: TaskForce, designId: number): number {
  return LINE_ROLES.reduce((s, role) => s + tf.lines[role].filter((id) => id === designId).length, 0)
}

/** Designs a given role's picker offers: eligible, in the composition, and not yet fully placed (§6). */
export function slotOptions(state: GameState, tf: TaskForce, role: LineRole): UnitDesign[] {
  const out: UnitDesign[] = []
  for (const line of tf.composition) {
    const design = findDesign(state, tf.faction, line.designId)
    if (!design || !eligibleRoles(design).includes(role)) continue
    if (assignedCount(tf, line.designId) < line.target) out.push(design)
  }
  return out
}

export function assignSlot(
  state: GameState,
  tfId: number,
  role: LineRole,
  index: number,
  designId: number | null,
): TaskForceResult {
  const tf = findTaskForce(state, tfId)
  if (!tf) return { ok: false, reason: 'That Task Force no longer exists.' }
  if (index < 0 || index >= LINE_SLOTS[role]) return { ok: false, reason: 'No such slot.' }
  if (designId === null) {
    tf.lines[role][index] = null
    return { ok: true, id: tfId }
  }
  const design = findDesign(state, tf.faction, designId)
  if (!design) return { ok: false, reason: 'That unit design no longer exists.' }
  if (!eligibleRoles(design).includes(role)) return { ok: false, reason: `${design.name} can't take that role.` }
  const line = tf.composition.find((l) => l.designId === designId)
  const already = assignedCount(tf, designId) - (tf.lines[role][index] === designId ? 1 : 0)
  if (!line || already >= line.target) return { ok: false, reason: `Every ${design.name} is already placed.` }
  tf.lines[role][index] = designId
  return { ok: true, id: tfId }
}

/** Vacate slots (last first) so a design never occupies more slots than its target count. */
function trimSlots(tf: TaskForce, designId: number, target: number): void {
  let excess = assignedCount(tf, designId) - target
  for (const role of [...LINE_ROLES].reverse()) {
    for (let i = tf.lines[role].length - 1; i >= 0 && excess > 0; i--) {
      if (tf.lines[role][i] === designId) {
        tf.lines[role][i] = null
        excess--
      }
    }
  }
}

/** Remove a design from every Task Force of its faction: Manpower back to the pool, Equipment lost (§6 Delete Unit). */
export function purgeDesign(state: GameState, faction: FactionId, designId: number): void {
  const f = state.factions[faction]
  for (const tf of factionTaskForces(state, faction)) {
    const line = tf.composition.find((l) => l.designId === designId)
    if (line) {
      f.manpower += line.manpower
      tf.composition = tf.composition.filter((l) => l.designId !== designId)
    }
    for (const role of LINE_ROLES) tf.lines[role] = tf.lines[role].map((id) => (id === designId ? null : id))
  }
  delete f.stockpile[designId]
  for (const key of Object.keys(f.manufacturing)) if (key.startsWith(`${designId}|`)) delete f.manufacturing[key]
}

// ---------------------------------------------------------------------------------------------
// Devtools (§7)

/** Fill every line to target instantly, bypassing the pipeline (nothing is drawn from the pool). */
export function fillTaskForce(state: GameState, id: number): void {
  const tf = findTaskForce(state, id)
  if (!tf) return
  for (const line of tf.composition) {
    const design = findDesign(state, tf.faction, line.designId)
    if (!design) continue
    line.equipment = line.target
    line.manpower = line.target * unitManpower(design)
  }
  log(state, 'dev', `${tf.name} filled to target`)
}

/**
 * Hand a Task Force to another faction. Its designs are adopted into the new roster (matched by
 * module multiset, else copied), so the units keep meaning what they meant.
 */
export function setTaskForceFaction(state: GameState, id: number, faction: FactionId): void {
  const tf = findTaskForce(state, id)
  if (!tf || tf.faction === faction) return
  const from = tf.faction
  const to = state.factions[faction]
  const remap = new Map<number, number>()
  for (const line of tf.composition) {
    const design = findDesign(state, from, line.designId)
    if (!design) continue
    let adopted = findDuplicate(to.designs, design.platform, design.modules)
    if (!adopted) {
      let name = design.name
      for (let n = 2; to.designs.some((d) => d.name.toLowerCase() === name.toLowerCase()); n++)
        name = `${design.name} (${n})`
      adopted = { id: to.nextDesignId++, name, platform: design.platform, modules: [...design.modules] }
      to.designs.push(adopted)
    }
    remap.set(line.designId, adopted.id)
    line.designId = adopted.id
  }
  for (const role of LINE_ROLES)
    tf.lines[role] = tf.lines[role].map((d) => (d === null ? null : (remap.get(d) ?? null)))
  tf.faction = faction
  log(state, 'dev', `${tf.name} reassigned from ${from} to ${faction}`)
}
