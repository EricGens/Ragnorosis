import { useLayoutEffect, useRef, useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { gameArea } from './gameArea'
import { MARGIN } from './placement'

/** Matches the fixed width below (Tailwind w-72), so the x position can be decided without measuring. */
const TOOLTIP_WIDTH = 288

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * The transient tooltip preview for whatever stat row is currently hovered. Rendered at the game-
 * area level (not inside the scrollable Region panel) so it can never push that panel into
 * scrollbars, and repositioned once its actual height is known so it stays on screen.
 */
export function HoverTooltipWindow() {
  const tooltip = useUIStore((s) => s.hoverTooltip)
  const ref = useRef<HTMLDivElement>(null)
  const [y, setY] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!tooltip || !ref.current) {
      setY(null)
      return
    }
    const area = gameArea()
    const height = ref.current.offsetHeight
    setY(clamp(tooltip.anchor.y, MARGIN, Math.max(MARGIN, area.height - height - MARGIN)))
  }, [tooltip])

  if (!tooltip) return null

  const area = gameArea()
  const rightOfAnchor = tooltip.anchor.x + tooltip.anchor.width + 8
  const x =
    rightOfAnchor + TOOLTIP_WIDTH + MARGIN <= area.width
      ? rightOfAnchor
      : Math.max(MARGIN, tooltip.anchor.x - TOOLTIP_WIDTH - 8)

  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none absolute z-20 w-72 rounded border border-ink-600 bg-ink-800/95 p-3 shadow-xl"
      style={{ left: x, top: y ?? tooltip.anchor.y }}
    >
      <div className="mb-1 text-[11px] tracking-[0.15em] text-signal uppercase">{tooltip.content.title}</div>
      {tooltip.content.lines.map((line, i) => (
        <p key={i} className="mb-1 text-xs leading-snug text-ink-200 last:mb-0">
          {line}
        </p>
      ))}
      <p className="mt-2 text-[10px] text-ink-400">Click to pin</p>
    </div>
  )
}
