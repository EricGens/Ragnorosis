import { useRef, useState } from 'react'
import { BUILDINGS, BUILDING_TYPES, buildingCost } from '../../sim/data/buildings'
import { findProject } from '../../sim/construction'
import { formatInt } from '../../sim/format'
import type { BuildingType, ConstructionProject, FactionId, LandRegion } from '../../sim/types'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { BuildingIcon } from './buildingIcons'
import { relativeRect } from './gameArea'

/** 4×4, square cells — future-proofed for more building types than the current five. */
const GRID_SQUARES = 16

interface Square {
  type: BuildingType
  level: number
  project?: ConstructionProject
}

/**
 * Building grid (skeleton §4.7): squares fill top-left → right → down; only the next empty square
 * is buildable. Hover shows a translucent "+" reading "New Building" or "Upgrade Building".
 */
export function BuildingGrid({ region, perspective }: { region: LandRegion; perspective: FactionId }) {
  const game = useGameStore((s) => s.game)
  const queueBuild = useGameStore((s) => s.queueBuild)
  const openSelector = useUIStore((s) => s.openSelector)
  const canBuild = region.controller === perspective

  // Present buildings in placement order, then squares whose first level is still under construction.
  const squares: Square[] = []
  for (const type of Object.keys(region.buildings) as BuildingType[]) {
    const level = region.buildings[type] ?? 0
    if (level > 0) squares.push({ type, level, project: findProject(game, perspective, region.id, type) })
  }
  for (const type of BUILDING_TYPES) {
    if (squares.some((s) => s.type === type)) continue
    const project = findProject(game, perspective, region.id, type)
    if (project) squares.push({ type, level: 0, project })
  }
  const nextEmpty = squares.length

  return (
    <div className="mt-3 border-t border-ink-700 pt-2">
      <div className="mb-1 text-[11px] tracking-[0.15em] text-ink-400 uppercase">Buildings</div>
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: GRID_SQUARES }, (_, i) => {
          const square = squares[i]
          if (square) {
            return (
              <OccupiedSquare
                key={square.type}
                square={square}
                canBuild={canBuild}
                onUpgrade={() => queueBuild(region.id, square.type)}
              />
            )
          }
          const buildable = canBuild && i === nextEmpty
          return <EmptySquare key={i} buildable={buildable} onClick={() => buildable && openSelector(region.id)} />
        })}
      </div>
    </div>
  )
}

function OccupiedSquare({ square, canBuild, onUpgrade }: { square: Square; canBuild: boolean; onUpgrade: () => void }) {
  const [hover, setHover] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const showHint = useUIStore((s) => s.showHoverHint)
  const hideHint = useUIStore((s) => s.hideHoverHint)
  const def = BUILDINGS[square.type]
  const p = square.project
  const atCap = def.maxLevel !== undefined && (p ? p.level + p.queuedLevels : square.level) >= def.maxLevel
  const upgradable = canBuild && !atCap
  const nextCost = buildingCost(square.type, (p ? p.level + p.queuedLevels : square.level) + 1)
  const hintText = upgradable
    ? `Upgrade Building — L${(p ? p.level + p.queuedLevels : square.level) + 1} costs ${formatInt(nextCost)}`
    : atCap
      ? `${def.name} is at its level cap`
      : null

  return (
    <button
      ref={ref}
      type="button"
      onMouseEnter={() => {
        setHover(true)
        if (hintText && ref.current) showHint(hintText, relativeRect(ref.current))
      }}
      onMouseLeave={() => {
        setHover(false)
        hideHint()
      }}
      onClick={upgradable ? onUpgrade : undefined}
      disabled={!upgradable}
      className={`relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded border border-ink-600 bg-ink-900/70 ${
        upgradable ? 'cursor-pointer hover:border-signal-dim' : 'cursor-default'
      }`}
      title={def.name}
      aria-label={`${def.name} level ${square.level}`}
    >
      <BuildingIcon type={square.type} className="h-1/2 w-1/2 text-ink-100" />
      <span className="text-[11px] text-ink-200">L{square.level}</span>
      {p && (
        <div className="absolute inset-x-1 bottom-1 h-1 rounded bg-ink-700" aria-label="construction progress">
          <div className="h-full rounded bg-signal" style={{ width: `${Math.min(100, (p.progress / p.cost) * 100)}%` }} />
        </div>
      )}
      {p && p.queuedLevels > 0 && (
        <span className="absolute top-0.5 right-1 text-[9px] text-ink-400">+{p.queuedLevels}</span>
      )}
      {hover && upgradable && (
        <span className="absolute inset-0 flex items-center justify-center rounded bg-signal/15 text-2xl text-signal/80">+</span>
      )}
    </button>
  )
}

function EmptySquare({ buildable, onClick }: { buildable: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const showHint = useUIStore((s) => s.showHoverHint)
  const hideHint = useUIStore((s) => s.hideHoverHint)

  return (
    <button
      ref={ref}
      type="button"
      onMouseEnter={() => {
        setHover(true)
        if (buildable && ref.current) showHint('New Building', relativeRect(ref.current))
      }}
      onMouseLeave={() => {
        setHover(false)
        hideHint()
      }}
      onClick={onClick}
      disabled={!buildable}
      className={`relative aspect-square rounded border border-dashed ${
        buildable ? 'cursor-pointer border-ink-600 hover:border-signal-dim' : 'cursor-default border-ink-700/60'
      }`}
      aria-label={buildable ? 'New Building' : 'Empty square'}
    >
      {hover && buildable && (
        <span className="absolute inset-0 flex items-center justify-center rounded bg-signal/15 text-2xl text-signal/80">+</span>
      )}
    </button>
  )
}
