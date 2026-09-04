import { tickInPulse } from '../sim/clock'
import { formatInt } from '../sim/format'
import { factionFacilityMultiplier } from '../sim/formulas/conversion'
import { manpowerCap } from '../sim/formulas/manpower'
import { computeAllocation } from '../sim/steps/productionSteps'
import { useGameStore } from '../store/gameStore'
import { useUIStore } from '../store/uiStore'

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
      className={`absolute top-1/2 right-0 z-10 -translate-y-1/2 rounded-l border border-r-0 px-1.5 py-4 text-[11px] tracking-[0.3em] uppercase [writing-mode:vertical-rl] ${
        open ? 'border-signal bg-signal/10 text-signal' : 'border-ink-600 bg-ink-900 text-ink-200 hover:text-signal'
      }`}
    >
      Military
    </button>
  )
}

export function MilitaryPanel() {
  const open = useUIStore((s) => s.militaryOpen)
  const game = useGameStore((s) => s.game)
  const faction = useGameStore((s) => s.game.factions[s.activeFaction])
  if (!open) return null

  const cap = manpowerCap(game, faction.id)
  // Same rule as the top bar: on a boundary the coming pulse isn't locked yet, so preview it.
  const allocation = tickInPulse(game.tick) === 0 ? computeAllocation(game, faction.id) : faction.allocation
  const equipmentIncoming = Math.floor(allocation.equipment * factionFacilityMultiplier(game, faction.id, 'production-facility'))
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
