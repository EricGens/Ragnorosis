import { useRef } from 'react'
import { useUIStore, type PinnedWindow } from '../../store/uiStore'
import { WINDOW_SIZE } from './placement'

/** Floating tooltip windows pinned by the player. Draggable by the title bar, closed only via ×. */
export function PinnedWindows() {
  const windows = useUIStore((s) => s.windows)
  return (
    <>
      {windows.map((w) => (
        <Window key={w.id} window={w} />
      ))}
    </>
  )
}

function Window({ window: w }: { window: PinnedWindow }) {
  const closeWindow = useUIStore((s) => s.closeWindow)
  const moveWindow = useUIStore((s) => s.moveWindow)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  return (
    <div
      className="absolute z-30 rounded border border-ink-600 bg-ink-800/95 shadow-xl"
      style={{ left: w.x, top: w.y, width: WINDOW_SIZE.width }}
      role="dialog"
      aria-label={w.title}
    >
      <div
        className="flex cursor-move items-center justify-between border-b border-ink-700 px-3 py-1.5"
        onPointerDown={(e) => {
          drag.current = { dx: e.clientX - w.x, dy: e.clientY - w.y }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (drag.current) moveWindow(w.id, e.clientX - drag.current.dx, e.clientY - drag.current.dy)
        }}
        onPointerUp={() => {
          drag.current = null
        }}
      >
        <span className="text-[11px] tracking-[0.15em] text-signal uppercase">{w.title}</span>
        <button
          type="button"
          onClick={() => closeWindow(w.id)}
          aria-label={`Close ${w.title}`}
          className="ml-3 text-ink-400 hover:text-ink-100"
        >
          ×
        </button>
      </div>
      <div className="p-3">
        {w.lines.map((line, i) => (
          <p key={i} className="mb-1 text-xs leading-snug text-ink-200 last:mb-0">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}
