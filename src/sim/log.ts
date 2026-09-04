import type { GameState, LogCategory } from './types'

/** Keep the resolution log bounded so long sessions don't grow without limit. */
export const MAX_LOG_ENTRIES = 5000

/** Append a resolution-log entry. Call on an Immer draft. */
export function log(state: GameState, category: LogCategory, message: string): void {
  state.log.push({ tick: state.tick, category, message })
  if (state.log.length > MAX_LOG_ENTRIES) state.log.splice(0, state.log.length - MAX_LOG_ENTRIES)
}
