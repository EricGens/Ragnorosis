import { useEffect, useMemo, useRef, useState } from 'react'
import type { MapLayout } from '../sim/data/dummyMap'
import { DUMMY_MAP } from '../sim/data/dummyMap'
import { pairKey } from '../sim/relations'
import type { FactionId, Region, RegionId, TaskForce } from '../sim/types'
import { FACTION_IDS, isLand } from '../sim/types'
import { useGameStore } from '../store/gameStore'
import { useUIStore, type EntityRef } from '../store/uiStore'
import { factionColor } from './factionColors'
import { OilPlatformIcon, WeatherIcon } from './panels/overlayIcons'

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
      return {
        points: `${half},0 ${SIZE},0 ${SIZE},${half} ${far},${half} ${far},${INSET} ${half},${INSET}`,
        cx: 900,
        cy: 100,
      }
    case 'sw':
      return {
        points: `0,${half} ${INSET},${half} ${INSET},${far} ${half},${far} ${half},${SIZE} 0,${SIZE}`,
        cx: 100,
        cy: 900,
      }
    case 'se':
      return {
        points: `${half},${far} ${far},${far} ${far},${half} ${SIZE},${half} ${SIZE},${SIZE} ${half},${SIZE}`,
        cx: 900,
        cy: 900,
      }
  }
}

const PAN_STEP = 40
const ZOOM_STEP = 1.15
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
/** How long the red X for a rejected order stays on the map. */
const FLASH_MS = 1100

export function MapView() {
  const regionOrder = useGameStore((s) => s.game.regionOrder)
  const regions = useGameStore((s) => s.game.regions)
  const taskForces = useGameStore((s) => s.game.taskForces)
  const distances = useGameStore((s) => s.game.distances)
  const activeFaction = useGameStore((s) => s.activeFaction)
  const orderMove = useGameStore((s) => s.orderMove)
  const hovered = useUIStore((s) => s.hovered)
  const pinned = useUIStore((s) => s.pinned)
  const setHovered = useUIStore((s) => s.setHovered)
  const togglePin = useUIStore((s) => s.togglePin)
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const [flash, setFlash] = useState<{ x: number; y: number; reason: string; key: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // WASD scroll, +/- zoom (skeleton §2.1).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const pan = (dx: number, dy: number) => setView((v) => ({ ...v, x: v.x + dx / v.zoom, y: v.y + dy / v.zoom }))
      const zoom = (f: number) => setView((v) => ({ ...v, zoom: clamp(v.zoom * f, MIN_ZOOM, MAX_ZOOM) }))
      switch (e.key) {
        case 'w':
        case 'W':
          pan(0, -PAN_STEP)
          break
        case 's':
        case 'S':
          pan(0, PAN_STEP)
          break
        case 'a':
        case 'A':
          pan(-PAN_STEP, 0)
          break
        case 'd':
        case 'D':
          pan(PAN_STEP, 0)
          break
        case '+':
        case '=':
          zoom(ZOOM_STEP)
          break
        case '-':
        case '_':
          zoom(1 / ZOOM_STEP)
          break
        default:
          return
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

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), FLASH_MS)
    return () => clearTimeout(t)
  }, [flash])

  const centers = useMemo(() => {
    const out: Record<RegionId, { cx: number; cy: number }> = {}
    for (const id of regionOrder) {
      const { cx, cy } = shapeFor(DUMMY_MAP.layout[id])
      out[id] = { cx, cy }
    }
    return out
  }, [regionOrder])

  /** The pinned Task Force, if it's one the player commands — it's "Active" for orders (§6). */
  const activeTaskForce =
    pinned?.kind === 'taskForce'
      ? taskForces.find((t) => String(t.id) === pinned.id && t.faction === activeFaction)
      : undefined

  function onRegionClick(regionId: RegionId, e: React.MouseEvent) {
    if (!activeTaskForce) {
      togglePin({ kind: 'region', id: regionId })
      return
    }
    const result = orderMove(activeTaskForce.id, regionId, e.shiftKey)
    if (!result.ok) {
      const svg = svgRef.current
      if (!svg) return
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse())
      setFlash({ x: pt.x, y: pt.y, reason: result.reason, key: Date.now() })
    }
  }

  const viewSize = SIZE / view.zoom
  const viewBox = `${view.x + (SIZE - viewSize) / 2} ${view.y + (SIZE - viewSize) / 2} ${viewSize} ${viewSize}`

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className={`h-full w-full select-none bg-ink-950 ${activeTaskForce ? 'cursor-crosshair' : ''}`}
      role="img"
      aria-label="Region map"
      data-active-task-force={activeTaskForce?.id}
    >
      <defs>
        {FACTION_IDS.map((id) => (
          <marker
            key={id}
            id={`arrow-${id}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={factionColor(id)} />
          </marker>
        ))}
      </defs>
      {regionOrder.map((id) => (
        <RegionShape
          key={id}
          region={regions[id]}
          layout={DUMMY_MAP.layout[id]}
          hovered={hovered?.kind === 'region' && hovered.id === id}
          pinned={pinned?.kind === 'region' && pinned.id === id}
          onHover={(r) => setHovered(r ? { kind: 'region', id: r } : null)}
          onClick={onRegionClick}
        />
      ))}
      {taskForces.map((tf) =>
        tf.movement && tf.movement.legs.length > 0 ? (
          <OrderArrow
            key={`arrow-${tf.id}`}
            tf={tf}
            centers={centers}
            legDistance={distances[pairKey(tf.regionId, tf.movement.legs[0])] ?? 1}
          />
        ) : null,
      )}
      {regionOrder.map((id) => (
        <TaskForceMarkers
          key={`tfs-${id}`}
          taskForces={taskForces.filter((t) => t.regionId === id)}
          center={centers[id]}
          hovered={hovered}
          pinned={pinned}
          activeFaction={activeFaction}
          onHover={setHovered}
          onClick={(ref) => togglePin(ref)}
        />
      ))}
      {flash && (
        <g key={flash.key} pointerEvents="none" className="animate-pulse" data-order-flash={flash.reason}>
          <line
            x1={flash.x - 14}
            y1={flash.y - 14}
            x2={flash.x + 14}
            y2={flash.y + 14}
            stroke="var(--color-alert)"
            strokeWidth={5}
            strokeLinecap="round"
          />
          <line
            x1={flash.x - 14}
            y1={flash.y + 14}
            x2={flash.x + 14}
            y2={flash.y - 14}
            stroke="var(--color-alert)"
            strokeWidth={5}
            strokeLinecap="round"
          />
          <text x={flash.x} y={flash.y + 34} textAnchor="middle" fill="var(--color-alert)" fontSize={13}>
            {flash.reason}
          </text>
        </g>
      )}
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
  onClick: (id: RegionId, e: React.MouseEvent) => void
}) {
  const { points, cx, cy } = shapeFor(layout)
  const land = isLand(region)
  const lit = hovered || pinned
  const fill = land
    ? lit
      ? 'var(--color-land-hover)'
      : 'var(--color-land)'
    : lit
      ? 'var(--color-sea-hover)'
      : 'var(--color-sea)'
  const controller = land ? region.controller : null

  return (
    <g
      onMouseEnter={() => onHover(region.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => onClick(region.id, e)}
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
      {region.weatherActive && (
        <WeatherIcon x={cx - 16} y={cy - 58} width={32} height={32} className="text-warn" pointerEvents="none" />
      )}
      {!land && region.energyReserve > 0 && (
        <OilPlatformIcon x={cx - 20} y={cy + 20} width={40} height={40} className="text-ink-200" pointerEvents="none" />
      )}
    </g>
  )
}

const MARKER_W = 60
const MARKER_H = 24
const MARKER_GAP = 6
/** Markers sit in the lower part of the region, clear of the name and country labels. */
const MARKER_DY = 58

/** Board-game-piece Task Force icons, colour-coded by faction (§6), laid out in a row per region. */
function TaskForceMarkers({
  taskForces,
  center,
  hovered,
  pinned,
  activeFaction,
  onHover,
  onClick,
}: {
  taskForces: TaskForce[]
  center: { cx: number; cy: number }
  hovered: EntityRef | null
  pinned: EntityRef | null
  activeFaction: FactionId
  onHover: (ref: EntityRef | null) => void
  onClick: (ref: EntityRef) => void
}) {
  if (taskForces.length === 0) return null
  const total = taskForces.length * MARKER_W + (taskForces.length - 1) * MARKER_GAP
  const x0 = center.cx - total / 2
  return (
    <>
      {taskForces.map((tf, i) => {
        const ref: EntityRef = { kind: 'taskForce', id: String(tf.id) }
        const isPinned = pinned?.kind === 'taskForce' && pinned.id === ref.id
        const isHovered = hovered?.kind === 'taskForce' && hovered.id === ref.id
        const x = x0 + i * (MARKER_W + MARKER_GAP)
        const y = center.cy + MARKER_DY
        const own = tf.faction === activeFaction
        return (
          <g
            key={tf.id}
            className="cursor-pointer"
            data-task-force={tf.id}
            onMouseEnter={() => onHover(ref)}
            onMouseLeave={() => onHover(null)}
            onClick={(e) => {
              e.stopPropagation()
              onClick(ref)
            }}
          >
            <rect
              x={x}
              y={y}
              width={MARKER_W}
              height={MARKER_H}
              rx={4}
              fill={factionColor(tf.faction)}
              fillOpacity={isHovered || isPinned ? 1 : 0.85}
              stroke={isPinned ? 'var(--color-signal)' : 'var(--color-ink-950)'}
              strokeWidth={isPinned ? 3 : 2}
            />
            <text
              x={x + MARKER_W / 2}
              y={y + MARKER_H / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#0b0f14"
              fontSize={11}
              fontWeight={own ? 700 : 400}
              pointerEvents="none"
            >
              {tf.name.length > 10 ? `${tf.name.slice(0, 9)}…` : tf.name}
            </text>
          </g>
        )
      })}
    </>
  )
}

/** The order arrow: solid for the progress made on the current leg, dashed for what remains (§4.2). */
function OrderArrow({
  tf,
  centers,
  legDistance,
}: {
  tf: TaskForce
  centers: Record<RegionId, { cx: number; cy: number }>
  legDistance: number
}) {
  const m = tf.movement!
  const color = factionColor(tf.faction)
  const from = centers[tf.regionId]
  const chain = [from, ...m.legs.map((id) => centers[id])]
  const points = chain.map((c) => `${c.cx},${c.cy}`).join(' ')
  const next = chain[1]
  const f = m.backtrack > 0 ? 0 : Math.min(1, m.progress / legDistance)
  return (
    <g pointerEvents="none" data-order-arrow={tf.id}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeOpacity={0.9}
        strokeDasharray="12 8"
        markerEnd={`url(#arrow-${tf.faction})`}
      />
      {f > 0 && (
        <line
          x1={from.cx}
          y1={from.cy}
          x2={from.cx + (next.cx - from.cx) * f}
          y2={from.cy + (next.cy - from.cy) * f}
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
        />
      )}
    </g>
  )
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
