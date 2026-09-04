import { produce } from 'immer'
import { formatDate, isPulseBoundary, pulseOf, tickInPulse } from './clock'
import { log } from './log'
import { allocateAllFactions, streamConstruction } from './steps/productionSteps'
import { beginPulse, resolvePulseEnd } from './steps/pulseSteps'
import { collectResearch, updateWeather } from './steps/tickSteps'
import type { GameState } from './types'

export interface TickResult {
  state: GameState
  /** True when this tick completed a pulse — the run loop auto-pauses here. */
  pulseCompleted: boolean
  /** True when something happened that needs the player's attention (auto-pause). */
  interrupted: boolean
}

/**
 * Advance the simulation by exactly one tick. Speed never changes what gets calculated —
 * only how fast the caller invokes this.
 */
export function advanceTick(state: GameState): TickResult {
  const before = state.interrupts.length
  const next = produce(state, (draft) => {
    draft.tick += 1
    // First tick of a pulse: take the Energy/Weather snapshot and lock in each faction's Production
    // allocation as of now, so edits or a focus change made while paused at the boundary apply to
    // the pulse about to run rather than the one after.
    if (tickInPulse(draft.tick) === 1) {
      beginPulse(draft)
      allocateAllFactions(draft)
    }
    collectResearch(draft)
    updateWeather(draft)
    streamConstruction(draft)
    if (isPulseBoundary(draft.tick)) {
      log(draft, 'time', `Pulse ${pulseOf(draft.tick)} complete — ${formatDate(draft.tick)}`)
      resolvePulseEnd(draft)
    }
  })
  return { state: next, pulseCompleted: isPulseBoundary(next.tick), interrupted: next.interrupts.length > before }
}

/** Advance a whole pulse at once (tests and devtools). Interrupts are collected, not honored. */
export function advancePulse(state: GameState): GameState {
  let current = state
  do {
    current = advanceTick(current).state
  } while (!isPulseBoundary(current.tick))
  return current
}
