import { tickInPulse } from '../sim/clock'
import { formatInt } from '../sim/format'
import { factionFacilityMultiplier } from '../sim/formulas/conversion'
import { manpowerCap } from '../sim/formulas/manpower'
import { designStats } from '../sim/military/design'
import { computeAllocation } from '../sim/steps/productionSteps'
import { useDisplayGame, useGameStore } from '../store/gameStore'
import { useUIStore } from '../store/uiStore'
import { MilitaryIcon } from './panels/overlayIcons'

/**
 * Persistent right-side button opening the Military interface (skeleton §4.6). Epoch 1 shows the
 * Equipment and Manpower pools only; the Unit and Task Force editors attach here later.
 */
export function MilitaryButton() {
  const open = useUIStore((s) => s.militaryOpen)
  const toggle = useUIStore((s) => s.toggleMilitary)
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={open}
      aria-label="Military"
      title="Military"
      className={`absolute top-1/2 right-0 z-10 -translate-y-1/2 rounded-l border border-r-0 p-2 ${
        open ? 'border-signal bg-signal/10 text-signal' : 'border-ink-600 bg-ink-900 text-ink-200 hover:text-signal'
      }`}
    >
      <MilitaryIcon className="h-6 w-6" />
    </button>
  )
}

export function MilitaryPanel() {
  const open = useUIStore((s) => s.militaryOpen)
  const openUnitEditor = useUIStore((s) => s.openUnitEditor)
  const game = useDisplayGame()
  const activeFaction = useGameStore((s) => s.activeFaction)
  const faction = game.factions[activeFaction]
  if (!open) return null

  const cap = manpowerCap(game, faction.id)
  // Same rule as the top bar: on a boundary the coming pulse isn't locked yet, so preview it.
  const allocation = tickInPulse(game.tick) === 0 ? computeAllocation(game, faction.id) : faction.allocation
  const equipmentIncoming = Math.floor(
    allocation.equipment * factionFacilityMultiplier(game, faction.id, 'production-facility'),
  )
  const manpowerIncoming = Math.min(
    Math.floor(allocation.manpower * factionFacilityMultiplier(game, faction.id, 'training-facility')),
    Math.max(0, cap - faction.manpower),
  )

  return (
    <aside
      className="absolute top-4 right-10 z-10 w-72 rounded border border-ink-600 bg-ink-900/95 p-4 shadow-2xl"
      aria-label="Military panel"
    >
      <h2 className="mb-3 text-xs tracking-[0.2em] text-signal uppercase">Military</h2>
      <Row label="Equipment · Small Arms" value={formatInt(faction.equipment)} incoming={equipmentIncoming} />
      <Row label="Manpower" value={`${formatInt(faction.manpower)} / ${formatInt(cap)}`} incoming={manpowerIncoming} />
      <p className="mt-3 text-[10px] leading-snug text-ink-400">
        Incoming amounts land at the end of the pulse. Manpower is capped at 2% of controlled Population.
      </p>

      <div className="mt-4 border-t border-ink-700 pt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] tracking-[0.15em] text-ink-400 uppercase">Unit roster</span>
          <button
            type="button"
            onClick={() => openUnitEditor(null)}
            className="rounded border border-signal-dim px-2 py-0.5 text-[10px] tracking-[0.15em] text-signal uppercase hover:bg-signal/10"
          >
            Unit editor
          </button>
        </div>
        {faction.designs.length === 0 ? (
          <p className="text-[10px] text-ink-400">No unit designs yet.</p>
        ) : (
          <ul className="text-xs">
            {faction.designs.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => openUnitEditor(d.id)}
                  className="flex w-full justify-between rounded px-1 py-0.5 text-left hover:bg-ink-100/5"
                >
                  <span className="text-ink-100">{d.name}</span>
                  <span className="text-ink-400">{formatInt(designStats(d.platform, d.modules).cost)} Prod</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

function Row({ label, value, incoming }: { label: string; value: string; incoming: number }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-[11px] tracking-[0.15em] text-ink-400 uppercase">{label}</span>
      <span className="text-sm text-ink-100">
        {value}
        {incoming > 0 && <span className="ml-1 text-xs text-signal">(+{formatInt(incoming)})</span>}
      </span>
    </div>
  )
}
