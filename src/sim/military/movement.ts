// Task Force movement (Epoch 2 skeleton §4, land-only): distance geometry, time-distance pathing,
// per-leg speed by the entered region's permissiveness, redirect backtrack, and arrival. Every
// mutating function operates on an Immer draft.

import { isPermissive } from '../formulas/domainControl'
import { log } from '../log'
import { factionRelation, pairKey } from '../relations'
import type { FactionId, GameState, LandRegion, Region, RegionId, TaskForce } from '../types'
import { isLand } from '../types'
import { battleFor, startBattle } from './battle'
import { designStats } from './design'
import { findDesign, findTaskForce } from './taskForce'

export type MoveResult = { ok: true } | { ok: false; reason: string }

/** Placeholder for GDD §8.6.7's "significant Stability hit" on capture (decisions doc). */
export const CAPTURE_STABILITY_HIT = 25

export function distanceBetween(state: GameState, a: RegionId, b: RegionId): number {
  const d = state.distances[pairKey(a, b)]
  if (d === undefined) throw new Error(`${a} and ${b} are not adjacent`)
  return d
}

/** Combat(Transit) mph — the slowest ground component (§4.5); null when there is nothing to move. */
export function taskForceSpeed(state: GameState, tf: TaskForce): { combat: number; transit: number } | null {
  let speed: { combat: number; transit: number } | null = null
  for (const line of tf.composition) {
    const design = findDesign(state, tf.faction, line.designId)
    if (!design) continue
    const s = designStats(design.platform, design.modules).speed
    speed = speed ? { combat: Math.min(speed.combat, s.combat), transit: Math.min(speed.transit, s.transit) } : { ...s }
  }
  return speed
}

/** A hostile Task Force is "in" a region (its regionId) until its own move completes (§4.3). */
export function hostileTaskForceIn(state: GameState, faction: FactionId, regionId: RegionId): TaskForce | undefined {
  return state.taskForces.find(
    (t) => t.regionId === regionId && t.faction !== faction && factionRelation(state, faction, t.faction) === 'hostile',
  )
}

/**
 * Miles per tick while entering `region` (§4.5: the *entered* region's permissiveness decides). An
 * invasion leg — a hostile Task Force is in the region — always runs the transit clock at Combat
 * Speed (§4.6), whoever controls the ground.
 */
export function legRate(state: GameState, tf: TaskForce, region: Region, speed: { combat: number; transit: number }) {
  if (hostileTaskForceIn(state, tf.faction, region.id)) return speed.combat
  return isPermissive(state, tf.faction, region) ? speed.transit : speed.combat
}

/** Why a Task Force can't be sent into a region, if anything. Entering a defended region is invasion (§6). */
export function enterProblem(_state: GameState, _tf: TaskForce, region: Region): string | null {
  if (!isLand(region)) return "Land forces can't put to sea yet."
  return null
}

/** Pathing treats a defended region as this many times slower, so the router only fights when asked to. */
const DEFENDED_PATH_PENALTY = 3

/** Shortest path by time-distance over enterable land regions (§4.2); excludes `from`, includes `to`. */
export function findPath(state: GameState, tf: TaskForce, from: RegionId, to: RegionId): RegionId[] | null {
  if (from === to) return []
  const speed = taskForceSpeed(state, tf)
  if (!speed) return null
  const time = new Map<RegionId, number>([[from, 0]])
  const prev = new Map<RegionId, RegionId>()
  const done = new Set<RegionId>()
  while (true) {
    let current: RegionId | null = null
    for (const [id, t] of time) if (!done.has(id) && (current === null || t < time.get(current)!)) current = id
    if (current === null) return null
    if (current === to) break
    done.add(current)
    for (const next of state.adjacency[current]) {
      const region = state.regions[next]
      if (done.has(next) || enterProblem(state, tf, region)) continue
      const penalty = next !== to && hostileTaskForceIn(state, tf.faction, next) ? DEFENDED_PATH_PENALTY : 1
      const t =
        time.get(current)! + (penalty * distanceBetween(state, current, next)) / legRate(state, tf, region, speed)
      if (t < (time.get(next) ?? Infinity)) {
        time.set(next, t)
        prev.set(next, current)
      }
    }
  }
  const path: RegionId[] = []
  for (let id: RegionId | undefined = to; id !== undefined && id !== from; id = prev.get(id)) path.unshift(id)
  return path
}

/**
 * Issue a move order. A plain order replaces the current one — progress on the leg underway must be
 * walked back at Combat Speed first (§4.4) — while `append` queues the destination after the current
 * legs (shift-click, §6). Ordering a Task Force back to its own region is how it halts.
 */
export function orderMove(state: GameState, tfId: number, destination: RegionId, append = false): MoveResult {
  const tf = findTaskForce(state, tfId)
  if (!tf) return { ok: false, reason: 'That Task Force no longer exists.' }
  if (!taskForceSpeed(state, tf)) return { ok: false, reason: 'Nothing to move — add units first.' }
  if (tf.consolidating) return { ok: false, reason: 'Consolidating — needs full Organization and Stability ≥ 50.' }
  const region = state.regions[destination]
  if (!region) return { ok: false, reason: 'No such region.' }
  const problem = destination === tf.regionId ? null : enterProblem(state, tf, region)
  if (problem) return { ok: false, reason: problem }

  if (append && tf.movement && tf.movement.legs.length > 0) {
    const last = tf.movement.legs[tf.movement.legs.length - 1]
    const path = findPath(state, tf, last, destination)
    if (!path) return { ok: false, reason: `No route to ${region.name}.` }
    tf.movement.legs.push(...path)
    if (path.length > 0) log(state, 'military', `${tf.name} will continue to ${region.name}`)
    return { ok: true }
  }

  const path = findPath(state, tf, tf.regionId, destination)
  if (!path) return { ok: false, reason: `No route to ${region.name}.` }
  // Progress on an abandoned leg is owed back at Combat Speed; an order that never advanced is free.
  const backtrack = tf.movement ? tf.movement.backtrack + tf.movement.progress : 0
  if (path.length === 0 && backtrack === 0) {
    tf.movement = null
    return { ok: true }
  }
  // Keep walking back from wherever the walk-back already started; otherwise from the leg just dropped.
  const returnFrom = tf.movement?.returnFrom ?? tf.movement?.legs[0]
  tf.movement = { legs: path, progress: 0, backtrack, ...(backtrack > 0 && returnFrom ? { returnFrom } : {}) }
  log(
    state,
    'military',
    path.length === 0
      ? `${tf.name} halts, ${Math.round(backtrack)} mi from ${state.regions[tf.regionId].name}`
      : `${tf.name} ordered to ${region.name} via ${path.map((id) => state.regions[id].name).join(' → ')}${backtrack > 0 ? ` after ${Math.round(backtrack)} mi back` : ''}`,
  )
  return { ok: true }
}

/** Ticks until the whole order completes at current permissiveness, or null when idle. */
export function etaTicks(state: GameState, tf: TaskForce): number | null {
  const m = tf.movement
  const speed = taskForceSpeed(state, tf)
  if (!m || !speed) return null
  let ticks = m.backtrack / speed.combat
  let from = tf.regionId
  m.legs.forEach((to, i) => {
    const remaining = distanceBetween(state, from, to) - (i === 0 ? m.progress : 0)
    ticks += remaining / legRate(state, tf, state.regions[to], speed)
    from = to
  })
  return Math.ceil(ticks - 1e-9)
}

/** Per tick: walk back any redirect debt, else advance the current leg; arrive when it completes. */
export function moveTaskForces(state: GameState): void {
  for (const tf of state.taskForces) {
    const m = tf.movement
    if (!m) continue
    const speed = taskForceSpeed(state, tf)
    if (!speed) {
      tf.movement = null
      continue
    }
    if (m.backtrack > 0) {
      m.backtrack = Math.max(0, m.backtrack - speed.combat)
      if (m.backtrack === 0) {
        delete m.returnFrom
        if (m.legs.length === 0) tf.movement = null
      }
      continue
    }
    const dest = m.legs[0]
    const region = state.regions[dest]
    const distance = distanceBetween(state, tf.regionId, dest)
    const defender = hostileTaskForceIn(state, tf.faction, dest)
    if (defender) {
      // Invasion (§4.6): the transit clock runs alongside the fight and waits at the far end for it.
      m.progress = Math.min(distance, m.progress + legRate(state, tf, region, speed))
      if (!battleFor(state, tf.id) && !battleFor(state, defender.id)) startBattle(state, tf, defender)
      continue
    }
    m.progress += legRate(state, tf, region, speed)
    if (m.progress + 1e-9 >= distance) {
      arrive(state, tf, region)
      m.legs.shift()
      m.progress = 0
      if (m.legs.length === 0) tf.movement = null
    }
  }
}

/** Repositioning is a hard flip (§4.3). Undefended hostile land is captured on arrival (GDD §8.6.7). */
function arrive(state: GameState, tf: TaskForce, region: Region): void {
  tf.regionId = region.id
  if (isLand(region) && !isPermissive(state, tf.faction, region)) capture(state, tf, region)
  else log(state, 'military', `${tf.name} arrives in ${region.name}`)
}

function capture(state: GameState, tf: TaskForce, region: LandRegion): void {
  const previous = region.controller
  region.controller = tf.faction
  region.stability = Math.max(0, region.stability - CAPTURE_STABILITY_HIT)
  // Consolidation lock (GDD §8.6.7): no further orders until Organization is full and Stability ≥ 50.
  tf.consolidating = true
  if (tf.movement && tf.movement.legs.length > 1) tf.movement.legs = tf.movement.legs.slice(0, 1)
  log(
    state,
    'military',
    `${tf.name} takes ${region.name} from ${previous ?? 'no one'} — Stability −${CAPTURE_STABILITY_HIT} to ${region.stability.toFixed(1)}`,
  )
}

/** Devtools: put a Task Force somewhere instantly, cancelling any order. */
export function teleportTaskForce(state: GameState, tfId: number, regionId: RegionId): void {
  const tf = findTaskForce(state, tfId)
  if (!tf || !state.regions[regionId]) return
  tf.regionId = regionId
  tf.movement = null
  log(state, 'dev', `${tf.name} teleported to ${state.regions[regionId].name}`)
}
