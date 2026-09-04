import { create } from 'zustand'
import { advanceTick } from '../sim/advance'
import { TICKS_PER_SECOND, type Speed } from '../sim/clock'
import { DUMMY_MAP } from '../sim/data/dummyMap'
import { createInitialState } from '../sim/state'
import type { FactionId, GameState } from '../sim/types'

export type Screen = 'title' | 'faction-select' | 'game'

interface GameStore {
  game: GameState
  screen: Screen
  /** The faction whose perspective every faction-scoped display is bound to. */
  activeFaction: FactionId
  speed: Speed
  running: boolean

  goToFactionSelect: () => void
  startSandbox: (faction: FactionId) => void
  setActiveFaction: (faction: FactionId) => void
  setSpeed: (speed: Speed) => void
  /** Run to the next pulse boundary, or pause if already running. */
  toggleRun: () => void
  pause: () => void
  stepTick: () => void
}

let timer: ReturnType<typeof setInterval> | null = null

function clearTimer() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

export const useGameStore = create<GameStore>()((set, get) => {
  function startTimer() {
    clearTimer()
    timer = setInterval(() => get().stepTick(), 1000 / TICKS_PER_SECOND[get().speed])
  }

  return {
    game: createInitialState(DUMMY_MAP),
    screen: 'title',
    activeFaction: 'united-states',
    speed: 1,
    running: false,

    goToFactionSelect: () => set({ screen: 'faction-select' }),

    startSandbox: (faction) => {
      clearTimer()
      set({ game: createInitialState(DUMMY_MAP), activeFaction: faction, screen: 'game', running: false })
    },

    setActiveFaction: (faction) => set({ activeFaction: faction }),

    setSpeed: (speed) => {
      set({ speed })
      if (get().running) startTimer()
    },

    toggleRun: () => {
      if (get().running) {
        get().pause()
      } else {
        set({ running: true })
        startTimer()
      }
    },

    pause: () => {
      clearTimer()
      set({ running: false })
    },

    stepTick: () => {
      const { state, pulseCompleted } = advanceTick(get().game)
      set({ game: state })
      if (pulseCompleted) get().pause()
    },
  }
})
