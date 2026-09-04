import { SPEEDS, TICKS_PER_PULSE, formatDate, pulseOf, tickInPulse } from '../sim/clock'
import { FACTIONS } from '../sim/data/factions'
import { formatInt, formatMoney } from '../sim/format'
import { FOCUSES } from '../sim/formulas/allocation'
import { computeAllocation } from '../sim/steps/productionSteps'
import { useDisplayGame, useGameStore } from '../store/gameStore'

const FOCUS_LABEL: Record<(typeof FOCUSES)[number], string> = {
  balanced: 'Balanced',
  equipment: 'Equipment',
  manpower: 'Manpower',
  construction: 'Construction',
}

export function TopBar() {
  const game = useDisplayGame()
  const tick = game.tick
  const globalTension = game.globalTension
  const activeFaction = useGameStore((s) => s.activeFaction)
  const faction = game.factions[activeFaction]
  const speed = useGameStore((s) => s.speed)
  const running = useGameStore((s) => s.running)
  const setSpeed = useGameStore((s) => s.setSpeed)
  const toggleRun = useGameStore((s) => s.toggleRun)
  const setFocus = useGameStore((s) => s.setFocus)

  // While paused on a boundary the coming pulse hasn't locked its allocation yet — preview it.
  const allocation = tickInPulse(tick) === 0 ? computeAllocation(game, activeFaction) : faction.allocation
  const cycleFocus = () => setFocus(FOCUSES[(FOCUSES.indexOf(faction.focus) + 1) % FOCUSES.length])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink-700 bg-ink-900 px-4">
      <div className="flex items-center gap-6 text-sm">
        <span className="tracking-[0.2em] text-ink-200 uppercase">{FACTIONS[activeFaction].name}</span>
        <Stat label="Money" value={formatMoney(faction.money)} />
        <Stat label="Research" value={formatInt(faction.research)} />
        <Stat label="Legitimacy" value={faction.legitimacy.toFixed(1)} />
        <div className="flex items-end gap-2">
          <Stat label="Production" value={formatInt(allocation.total)} />
          <button
            type="button"
            onClick={cycleFocus}
            title={`Equipment ${formatInt(allocation.equipment)} · Manpower ${formatInt(allocation.manpower)} · Construction ${formatInt(allocation.construction)}. Click to change focus.`}
            className={`rounded border px-2 py-0.5 text-[11px] tracking-[0.15em] uppercase ${
              allocation.warning ? 'border-warn text-warn' : 'border-ink-600 text-ink-200 hover:border-signal-dim hover:text-signal'
            }`}
          >
            {FOCUS_LABEL[faction.focus]}
            {allocation.warning && ' !'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <Stat label="Global Tension" value={globalTension.toFixed(0)} />

        <div className="flex flex-col items-end leading-tight">
          <span className="text-sm text-ink-100">{formatDate(tick)}</span>
          <span className="text-[11px] text-ink-400">
            Pulse {pulseOf(tick) + 1} · Tick {tickInPulse(tick)}/{TICKS_PER_PULSE}
          </span>
        </div>

        <button
          type="button"
          onClick={toggleRun}
          aria-label={running ? 'Pause' : 'Run to next pulse'}
          title={running ? 'Pause' : 'Run to next pulse'}
          className="flex h-10 w-10 items-center justify-center rounded border border-signal-dim text-signal hover:bg-signal/10"
        >
          {running ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`rounded px-2 py-1 text-[11px] ${
                s === speed ? 'bg-signal/15 text-signal' : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-[10px] tracking-[0.2em] text-ink-400 uppercase">{label}</span>
      <span className="text-sm text-ink-100">{value}</span>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M3 2l11 6-11 6z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3" y="2" width="4" height="12" />
      <rect x="9" y="2" width="4" height="12" />
    </svg>
  )
}
