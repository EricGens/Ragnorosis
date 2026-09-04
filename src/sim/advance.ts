import { produce } from 'immer'
import { formatDate, isPulseBoundary, pulseOf } from './clock'
import { log } from './log'
import type { GameState } from './types'

export interface TickResult {
  state: GameState
  /** True when this tick crossed into a new pulse — the run loop auto-pauses here. */
  pulseCompleted: boolean
}

/**
 * Advance the simulation by exactly one tick. Speed never changes what gets calculated —
 * only how fast the caller invokes this.
 */
export function advanceTick(state: GameState): TickResult {
  const next = produce(state, (draft) => {
    draft.tick += 1
    if (isPulseBoundary(draft.tick)) {
      log(draft, 'time', `Pulse ${pulseOf(draft.tick) + 1} begins — ${formatDate(draft.tick)}`)
    }
  })
  return { state: next, pulseCompleted: isPulseBoundary(next.tick) }
}
