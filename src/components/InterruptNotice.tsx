import { BUILDINGS } from '../sim/data/buildings'
import { useGameStore } from '../store/gameStore'
import { useUIStore } from '../store/uiStore'

/**
 * Construction-completion interrupt (skeleton §4.3): the game auto-pauses so the player can queue
 * a new project before resuming. Also surfaces the last rejected action.
 */
export function InterruptNotice() {
  const interrupts = useGameStore((s) => s.game.interrupts)
  const notice = useGameStore((s) => s.notice)
  const regions = useGameStore((s) => s.game.regions)
  const dismiss = useGameStore((s) => s.dismissInterrupts)
  const clearNotice = useGameStore((s) => s.clearNotice)
  const togglePin = useUIStore((s) => s.togglePin)
  const pinned = useUIStore((s) => s.pinned)

  if (interrupts.length === 0 && !notice) return null

  return (
    <div className="absolute bottom-4 left-1/2 z-30 flex w-[28rem] -translate-x-1/2 flex-col gap-2">
      {interrupts.length > 0 && (
        <div role="alert" className="rounded border border-signal bg-ink-900/95 p-3 shadow-2xl">
          <div className="mb-2 text-[11px] tracking-[0.2em] text-signal uppercase">Construction complete — paused</div>
          <ul className="mb-3 flex flex-col gap-1 text-sm text-ink-100">
            {interrupts.map((it, i) => (
              <li key={i}>
                {BUILDINGS[it.building].name} level {it.level} in{' '}
                <button
                  type="button"
                  className="underline decoration-ink-600 hover:text-signal"
                  onClick={() => {
                    if (!(pinned?.kind === 'region' && pinned.id === it.regionId)) togglePin({ kind: 'region', id: it.regionId })
                  }}
                >
                  {regions[it.regionId].name}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={dismiss}
            className="rounded border border-signal-dim px-3 py-1 text-xs tracking-[0.2em] text-signal uppercase hover:bg-signal/10"
          >
            Continue
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-center justify-between rounded border border-warn/60 bg-ink-900/95 px-3 py-2 text-xs text-warn">
          <span>{notice}</span>
          <button type="button" onClick={clearNotice} aria-label="Dismiss" className="ml-3 text-ink-400 hover:text-ink-100">
            ×
          </button>
        </div>
      )}
    </div>
  )
}
