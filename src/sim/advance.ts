import { produce } from 'immer'
import { formatDate, isPulseBoundary, pulseOf } from './clock'
import { log } from './log'
import { resolvePulseEnd } from './steps/pulseSteps'
import { collectResearch, updateWeather } from './steps/tickSteps'
import type { GameState } from './types'

export interface TickResult {
  state: GameState
  /** True when this tick completed a pulse — the run loop auto-pauses here. */
  pulseCompleted: boolean
}

/**
 * Advance the simulation by exactly one tick. Speed never changes what gets calculated —
 * only how fast the caller invokes this.
 */
export function advanceTick(state: GameState): TickResult {
  const next = produce(state, (draft) => {
    draft.tick += 1
    collectResearch(draft)
    updateWeather(draft)
    if (isPulseBoundary(draft.tick)) {
      log(draft, 'time', `Pulse ${pulseOf(draft.tick)} complete — ${formatDate(draft.tick)}`)
      resolvePulseEnd(draft)
    }
  })
  return { state: next, pulseCompleted: isPulseBoundary(next.tick) }
}

/** Advance a whole pulse at once (tests and devtools). */
export function advancePulse(state: GameState): GameState {
  let current = state
  do {
    current = advanceTick(current).state
  } while (!isPulseBoundary(current.tick))
  return current
}
