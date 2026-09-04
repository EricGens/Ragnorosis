import { useEffect, useRef, useState } from 'react'
import type { MapLayout } from '../sim/data/dummyMap'
import { DUMMY_MAP } from '../sim/data/dummyMap'
import type { Region, RegionId } from '../sim/types'
import { isLand } from '../sim/types'
import { useGameStore } from '../store/gameStore'
import { useUIStore } from '../store/uiStore'
import { factionColor } from './factionColors'

// Map space is a 1000×1000 square: a 3×3 land grid of 200-unit cells inset by 200 on each side,
// with the surrounding ring split into four ocean quadrants so each maritime region touches the
// right land regions (corners one, edge-middles two).
const CELL = 200
const INSET = 200
const SIZE = 1000

function shapeFor(layout: MapLayout): { points: string; cx: number; cy: number } {
  if (layout.kind === 'grid') {
    const x = INSET + layout.col * CELL
    const y = INSET + layout.row * CELL
    return {
      points: `${x},${y} ${x + CELL},${y} ${x + CELL},${y + CELL} ${x},${y + CELL}`,
      cx: x + CELL / 2,
      cy: y + CELL / 2,
    }
  }
  const half = SIZE / 2
  const far = SIZE - INSET
  switch (layout.corner) {
    case 'nw':
      return { points: `0,0 ${half},0 ${half},${INSET} ${INSET},${INSET} ${INSET},${half} 0,${half}`, cx: 100, cy: 100 }
    case 'ne':
      return { points: `${half},0 ${SIZE},0 ${SIZE},${half} ${far},${half} ${far},${INSET} ${half},${INSET}`, cx: 900, cy: 100 }
    case 'sw':
      return { points: `0,${half} ${INSET},${half} ${INSET},${far} ${half},${far} ${half},${SIZE} 0,${SIZE}`, cx: 100, cy: 900 }
    case 'se':
      return { points: `${half},${far} ${far},${far} ${far},${half} ${SIZE},${half} ${SIZE},${SIZE} ${half},${SIZE}`, cx: 900, cy: 900 }
  }
}

const PAN_STEP = 40
const ZOOM_STEP = 1.15
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4

export function MapView() {
  const regionOrder = useGameStore((s) => s.game.regionOrder)
  const regions = useGameStore((s) => s.game.regions)
  const hovered = useUIStore((s) => s.hovered)
  const pinned = useUIStore((s) => s.pinned)
  const setHovered = useUIStore((s) => s.setHovered)
  const togglePin = useUIStore((s) => s.togglePin)
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const svgRef = useRef<SVGSVGElement>(null)

  // WASD scroll, +/- zoom (skeleton §2.1).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const pan = (dx: number, dy: number) => setView((v) => ({ ...v, x: v.x + dx / v.zoom, y: v.y + dy / v.zoom }))
      const zoom = (f: number) => setView((v) => ({ ...v, zoom: clamp(v.zoom * f, MIN_ZOOM, MAX_ZOOM) }))
      switch (e.key) {
        case 'w': case 'W': pan(0, -PAN_STEP); break
        case 's': case 'S': pan(0, PAN_STEP); break
        case 'a': case 'A': pan(-PAN_STEP, 0); break
        case 'd': case 'D': pan(PAN_STEP, 0); break
        case '+': case '=': zoom(ZOOM_STEP); break
        case '-': case '_': zoom(1 / ZOOM_STEP); break
        default: return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Mouse-wheel zoom; native listener so we can preventDefault page scroll.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const f = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      setView((v) => ({ ...v, zoom: clamp(v.zoom * f, MIN_ZOOM, MAX_ZOOM) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const viewSize = SIZE / view.zoom
  const viewBox = `${view.x + (SIZE - viewSize) / 2} ${view.y + (SIZE - viewSize) / 2} ${viewSize} ${viewSize}`

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className="h-full w-full select-none bg-ink-950"
      role="img"
      aria-label="Region map"
    >
      {regionOrder.map((id) => (
        <RegionShape
          key={id}
          region={regions[id]}
          layout={DUMMY_MAP.layout[id]}
          hovered={hovered?.kind === 'region' && hovered.id === id}
          pinned={pinned?.kind === 'region' && pinned.id === id}
          onHover={(r) => setHovered(r ? { kind: 'region', id: r } : null)}
          onClick={(r) => togglePin({ kind: 'region', id: r })}
        />
      ))}
    </svg>
  )
}

function RegionShape({
  region,
  layout,
  hovered,
  pinned,
  onHover,
  onClick,
}: {
  region: Region
  layout: MapLayout
  hovered: boolean
  pinned: boolean
  onHover: (id: RegionId | null) => void
  onClick: (id: RegionId) => void
}) {
  const { points, cx, cy } = shapeFor(layout)
  const land = isLand(region)
  const lit = hovered || pinned
  const fill = land
    ? lit ? 'var(--color-land-hover)' : 'var(--color-land)'
    : lit ? 'var(--color-sea-hover)' : 'var(--color-sea)'
  const controller = land ? region.controller : null

  return (
    <g
      onMouseEnter={() => onHover(region.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(region.id)}
      className="cursor-pointer"
      data-region={region.id}
      data-pinned={pinned || undefined}
    >
      <polygon
        points={points}
        fill={fill}
        stroke={pinned ? 'var(--color-signal)' : 'var(--color-ink-950)'}
        strokeWidth={3}
      />
      {controller && (
        <polygon
          points={points}
          fill="none"
          stroke={factionColor(controller)}
          strokeWidth={5}
          strokeOpacity={0.85}
          pointerEvents="none"
          transform={`translate(${cx} ${cy}) scale(0.96) translate(${-cx} ${-cy})`}
        />
      )}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--color-ink-100)"
        fontSize={22}
        pointerEvents="none"
      >
        {region.name}
      </text>
      {land && (
        <text x={cx} y={cy + 28} textAnchor="middle" fill="var(--color-ink-200)" fontSize={14} pointerEvents="none">
          {region.country}
        </text>
      )}
    </g>
  )
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
