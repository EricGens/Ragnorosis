import { BUILDINGS, buildingCost } from '../../sim/data/buildings'
import { availableBuildings } from '../../sim/construction'
import { formatInt } from '../../sim/format'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'

/** Building-type picker for an empty grid square: only types this faction may build that aren't already on the grid. */
export function BuildingSelector() {
  const regionId = useUIStore((s) => s.selectorRegion)
  const closeSelector = useUIStore((s) => s.closeSelector)
  const game = useGameStore((s) => s.game)
  const perspective = useGameStore((s) => s.activeFaction)
  const queueBuild = useGameStore((s) => s.queueBuild)
  if (!regionId) return null

  const region = game.regions[regionId]
  const options = availableBuildings(game, perspective, regionId)

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink-950/60" onClick={closeSelector}>
      <div
        role="dialog"
        aria-label={`New building in ${region.name}`}
        className="w-96 rounded border border-ink-600 bg-ink-900 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs tracking-[0.2em] text-signal uppercase">New building — {region.name}</h3>
          <button type="button" onClick={closeSelector} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            ×
          </button>
        </div>
        {options.length === 0 ? (
          <p className="text-xs text-ink-400">Every building type is already on this grid.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {options.map((type) => {
              const def = BUILDINGS[type]
              return (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => {
                      if (queueBuild(regionId, type).ok) closeSelector()
                    }}
                    className="w-full rounded border border-ink-700 px-3 py-2 text-left hover:border-signal-dim hover:bg-signal/5"
                  >
                    <div className="flex justify-between text-sm text-ink-100">
                      <span>{def.name}</span>
                      <span className="text-ink-200">{formatInt(buildingCost(type, 1))} Production</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-ink-400">{def.description}</p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
