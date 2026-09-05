import { useRef } from 'react'
import { useUIStore } from '../../store/uiStore'
import { gameArea, relativeRect, reservedRects } from './gameArea'
import type { StatDescriptor, Tone } from './regionStats'

const toneClass: Record<Tone, string> = {
  neutral: 'text-ink-100',
  good: 'text-signal',
  warn: 'text-warn',
  bad: 'text-alert',
}

/**
 * One stat line. Hovering previews its tooltip in a floating window beside the row — never inline,
 * since the Region panel scrolls and an inline tooltip would just push it into scrollbar territory.
 * Moving to a different row swaps the preview; left-clicking pins the tooltip as its own
 * independent window that persists until closed (skeleton §2.2).
 */
export function StatRow({ stat }: { stat: StatDescriptor }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const openWindow = useUIStore((s) => s.openWindow)
  const showHoverTooltip = useUIStore((s) => s.showHoverTooltip)
  const hideHoverTooltip = useUIStore((s) => s.hideHoverTooltip)

  const preview = () => {
    if (rowRef.current) showHoverTooltip(stat.tooltip, relativeRect(rowRef.current))
  }
  const pin = () => openWindow(stat.tooltip, gameArea(), reservedRects())

  return (
    <div
      ref={rowRef}
      className="flex cursor-help items-baseline justify-between gap-4 rounded px-2 py-1 hover:bg-ink-100/5"
      onMouseEnter={preview}
      onMouseLeave={hideHoverTooltip}
      onClick={pin}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') pin()
      }}
    >
      <span className="text-[11px] tracking-[0.15em] text-ink-400 uppercase">{stat.label}</span>
      <span className={`text-sm ${toneClass[stat.tone ?? 'neutral']}`}>
        {stat.value}
        {stat.trend && <Trend {...stat.trend} />}
      </span>
    </div>
  )
}

function Trend({ target, direction }: NonNullable<StatDescriptor['trend']>) {
  const color = direction === 'up' ? 'text-signal' : direction === 'down' ? 'text-alert' : 'text-ink-400'
  return (
    <>
      <span className={`mx-1 ${color}`}>→</span>
      <span className="text-ink-200">{target}</span>
    </>
  )
}
