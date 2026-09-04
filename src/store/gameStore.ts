import { produce } from 'immer'
import { create } from 'zustand'
import { advanceTick } from '../sim/advance'
import { TICKS_PER_SECOND, type Speed } from '../sim/clock'
import { queueBuild, type QueueResult } from '../sim/construction'
import { DUMMY_MAP } from '../sim/data/dummyMap'
import { createInitialState } from '../sim/state'
import type { BuildingType, FactionId, Focus, GameState, RegionId } from '../sim/types'

export type Screen = 'title' | 'faction-select' | 'game'

interface GameStore {
  game: GameState
  screen: Screen
  /** The faction whose perspective every faction-scoped display is bound to. */
  activeFaction: FactionId
  speed: Speed
  running: boolean
  /** Short feedback for the last player action (e.g. a rejected build). */
  notice: string | null

  goToFactionSelect: () => void
  startSandbox: (faction: FactionId) => void
  setActiveFaction: (faction: FactionId) => void
  setSpeed: (speed: Speed) => void
  /** Run to the next pulse boundary, or pause if already running. */
  toggleRun: () => void
  pause: () => void
  stepTick: () => void

  setFocus: (focus: Focus) => void
  queueBuild: (regionId: RegionId, building: BuildingType) => QueueResult
  dismissInterrupts: () => void
  clearNotice: () => void
  /** Apply an arbitrary mutation to the sim (devtools). */
  mutate: (fn: (draft: GameState) => void) => void
}

let timer: ReturnType<typeof setInterval> | null = null
let lastFire = 0
/** Fractional ticks owed but not yet stepped. */
let owed = 0
/** Never let a stalled timer (background tab) catch up more than this in one burst. */
const MAX_TICKS_PER_FIRE = 30
const TIMER_MS = 25

function clearTimer() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

export const useGameStore = create<GameStore>()((set, get) => {
  // The run loop is time-based: each fire steps however many ticks the elapsed real time is
  // worth at the current speed, so throttled or jittery timers don't slow the sim.
  function startTimer() {
    clearTimer()
    lastFire = performance.now()
    owed = 0
    timer = setInterval(() => {
      const now = performance.now()
      owed += ((now - lastFire) / 1000) * TICKS_PER_SECOND[get().speed]
      lastFire = now
      let steps = Math.min(MAX_TICKS_PER_FIRE, Math.floor(owed))
      owed -= steps
      while (steps-- > 0 && get().running) get().stepTick()
    }, TIMER_MS)
  }

  return {
    game: createInitialState(DUMMY_MAP),
    screen: 'title',
    activeFaction: 'united-states',
    speed: 1,
    running: false,
    notice: null,

    goToFactionSelect: () => set({ screen: 'faction-select' }),

    startSandbox: (faction) => {
      clearTimer()
      set({ game: createInitialState(DUMMY_MAP), activeFaction: faction, screen: 'game', running: false, notice: null })
    },

    setActiveFaction: (faction) => set({ activeFaction: faction }),

    setSpeed: (speed) => set({ speed }),

    toggleRun: () => {
      if (get().running) {
        get().pause()
      } else {
        if (get().game.interrupts.length > 0) get().dismissInterrupts()
        set({ running: true })
        startTimer()
      }
    },

    pause: () => {
      clearTimer()
      set({ running: false })
    },

    stepTick: () => {
      const { state, pulseCompleted, interrupted } = advanceTick(get().game)
      set({ game: state })
      if (pulseCompleted || interrupted) get().pause()
    },

    setFocus: (focus) =>
      set({ game: produce(get().game, (d) => void (d.factions[get().activeFaction].focus = focus)) }),

    queueBuild: (regionId, building) => {
      // Captured through an object so TypeScript doesn't narrow away the callback's assignment.
      const out: { result: QueueResult } = { result: { ok: true } }
      const game = produce(get().game, (d) => {
        out.result = queueBuild(d, get().activeFaction, regionId, building)
      })
      set({ game, notice: out.result.ok ? null : out.result.reason })
      return out.result
    },

    dismissInterrupts: () => set({ game: produce(get().game, (d) => void (d.interrupts = [])) }),

    clearNotice: () => set({ notice: null }),

    mutate: (fn) => set({ game: produce(get().game, fn) }),
  }
})
