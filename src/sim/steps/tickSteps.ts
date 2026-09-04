// Per-Tick state mutations. Every function here operates on an Immer draft.

import { researchPerTick } from '../formulas/economy'
import { log } from '../log'
import { nextRandom } from '../rng'
import type { GameState } from '../types'
import { isLand } from '../types'

/** Research flows continuously: every controlled land region credits its controller each Tick. */
export function collectResearch(state: GameState): void {
  for (const id of state.regionOrder) {
    const r = state.regions[id]
    if (isLand(r) && r.controller) state.factions[r.controller].research += researchPerTick(r)
  }
}

/** Weather: active regions count down; inactive ones may activate with the configured per-tick chance. */
export function updateWeather(state: GameState): void {
  const { weatherChancePerTick, weatherDurationTicks } = state.settings
  for (const id of state.regionOrder) {
    const r = state.regions[id]
    if (r.weatherActive) {
      r.weatherTicksRemaining -= 1
      if (r.weatherTicksRemaining <= 0) {
        r.weatherActive = false
        r.weatherTicksRemaining = 0
        log(state, 'weather', `Weather clears over ${r.name}`)
      }
    } else if (weatherChancePerTick > 0 && nextRandom(state) < weatherChancePerTick) {
      r.weatherActive = true
      r.weatherTicksRemaining = weatherDurationTicks
      log(state, 'weather', `Weather sets in over ${r.name} (${weatherDurationTicks} ticks)`)
    }
  }
}
