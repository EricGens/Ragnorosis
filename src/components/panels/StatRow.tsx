import { useState } from 'react'
import { useUIStore, type TooltipContent } from '../../store/uiStore'
import { gameArea, PANEL_RESERVED } from './gameArea'
import type { StatDescriptor, Tone } from './regionStats'

const toneClass: Record<Tone, string> = {
  neutral: 'text-ink-100',
  good: 'text-signal',
  warn: 'text-warn',
  bad: 'text-alert',
}

/**
 * One stat line. Hovering shows an explanatory tooltip; left-clicking pins that tooltip as an
 * independent floating window (skeleton §2.2).
 */
export function StatRow({ stat }: { stat: StatDescriptor }) {
  const [hover, setHover] = useState(false)
  const openWindow = useUIStore((s) => s.openWindow)

  return (
    <div
      className="relative flex cursor-help items-baseline justify-between gap-4 rounded px-2 py-1 hover:bg-ink-100/5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => openWindow(stat.tooltip, gameArea(), PANEL_RESERVED)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') openWindow(stat.tooltip, gameArea(), PANEL_RESERVED)
      }}
    >
      <span className="text-[11px] tracking-[0.15em] text-ink-400 uppercase">{stat.label}</span>
      <span className={`text-sm ${toneClass[stat.tone ?? 'neutral']}`}>
        {stat.value}
        {stat.trend && <Trend {...stat.trend} />}
      </span>
      {hover && <Tooltip content={stat.tooltip} />}
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

function Tooltip({ content }: { content: TooltipContent }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute top-0 left-full z-20 ml-2 w-72 rounded border border-ink-600 bg-ink-800/95 p-3 text-left shadow-xl"
    >
      <div className="mb-1 text-[11px] tracking-[0.15em] text-signal uppercase">{content.title}</div>
      {content.lines.map((line, i) => (
        <p key={i} className="mb-1 text-xs leading-snug text-ink-200 last:mb-0">
          {line}
        </p>
      ))}
      <p className="mt-2 text-[10px] text-ink-400">Click to pin</p>
    </div>
  )
}
