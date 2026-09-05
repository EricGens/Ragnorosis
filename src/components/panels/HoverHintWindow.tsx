import { useLayoutEffect, useRef, useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { gameArea } from './gameArea'
import { MARGIN } from './placement'

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * A small, single-line hover hint (e.g. a building grid square's "New Building" or
 * "Upgrade Building — L5 costs 1,050"), anchored above whatever it describes. Rendered at the
 * game-area level, the same fix already applied to stat tooltips, so a hint near the edge of a
 * scrollable panel can never push it into scrollbars — it's positioned in open space instead.
 */
export function HoverHintWindow() {
  const hint = useUIStore((s) => s.hoverHint)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    if (!hint || !ref.current) {
      setPos(null)
      return
    }
    const area = gameArea()
    const width = ref.current.offsetWidth
    const height = ref.current.offsetHeight
    const x = clamp(hint.anchor.x + hint.anchor.width / 2 - width / 2, MARGIN, Math.max(MARGIN, area.width - width - MARGIN))
    const above = hint.anchor.y - height - 8
    const y = above >= MARGIN ? above : hint.anchor.y + hint.anchor.height + 8
    setPos({ x, y })
  }, [hint])

  if (!hint) return null

  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none absolute z-[35] rounded border border-ink-600 bg-ink-800 px-2 py-0.5 text-[10px] whitespace-nowrap text-ink-100"
      style={pos ? { left: pos.x, top: pos.y } : { left: hint.anchor.x, top: hint.anchor.y, visibility: 'hidden' }}
    >
      {hint.text}
    </div>
  )
}
