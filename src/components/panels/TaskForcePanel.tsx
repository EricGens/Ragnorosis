import { FACTIONS } from '../../sim/data/factions'
import { formatInt } from '../../sim/format'
import { battleFor } from '../../sim/military/battle'
import { maxOrganization, organization } from '../../sim/military/combat'
import { etaTicks, taskForceSpeed } from '../../sim/military/movement'
import { findDesign, unitManpower } from '../../sim/military/taskForce'
import { pairKey } from '../../sim/relations'
import type { FactionId, TaskForce } from '../../sim/types'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { factionColor } from '../factionColors'
import { chevrons } from '../military/priority'
import { ENTITY_PANEL_ID, PANEL_WIDTH } from './gameArea'

/**
 * The Task Force entity panel (Epoch 2 skeleton §6): the same hover-preview/click-to-pin pattern as
 * regions. Everyone sees the stats; only the owner gets orders. A pinned own Task Force is "Active":
 * clicking a region on the map moves it there (shift-click adds a leg).
 */
export function TaskForcePanel({
  tf,
  perspective,
  pinned,
  onClose,
}: {
  tf: TaskForce
  perspective: FactionId
  pinned: boolean
  onClose: () => void
}) {
  const game = useGameStore((s) => s.game)
  const orderMove = useGameStore((s) => s.orderMove)
  const orderStandoff = useGameStore((s) => s.orderStandoff)
  const openEditor = useUIStore((s) => s.openTaskForceEditor)
  const openBattleLogs = useUIStore((s) => s.openBattleLogs)
  const own = tf.faction === perspective
  const region = game.regions[tf.regionId]
  const speed = taskForceSpeed(game, tf)
  const eta = etaTicks(game, tf)
  const m = tf.movement
  const battle = battleFor(game, tf.id)
  const orgMax = maxOrganization(game, tf)
  const org = organization(game, tf)
  const unitsTarget = tf.composition.reduce((s, l) => s + l.target, 0)
  const unitsFilled = tf.composition.reduce((s, l) => s + l.equipment, 0)

  return (
    <aside
      id={ENTITY_PANEL_ID}
      className="absolute top-4 left-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto rounded border border-ink-600 bg-ink-900/95 shadow-2xl"
      style={{ width: PANEL_WIDTH }}
      aria-label={`${tf.name} panel`}
    >
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg tracking-[0.15em] text-ink-100 uppercase">{tf.name}</h2>
            <div className="mt-1 text-xs">
              <span style={{ color: factionColor(tf.faction) }}>{FACTIONS[tf.faction].name}</span>
              <span className="text-ink-200"> · {region.name}</span>
            </div>
          </div>
          {pinned ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Unpin panel"
              className="text-ink-400 hover:text-ink-100"
            >
              ×
            </button>
          ) : (
            <span className="text-[10px] tracking-[0.15em] text-ink-400 uppercase">Preview</span>
          )}
        </div>

        {/* HOI4-style two-bar readout (GDD §8.6.6.1): green Organization, amber Strength. */}
        <div className="mb-3 text-xs">
          <Bar label="Organization" value={org} max={orgMax} color="var(--color-signal)" />
          <Bar label="Strength" value={unitsFilled} max={unitsTarget} color="var(--color-warn)" />
          <div className="mt-1 flex justify-between text-[10px] text-ink-400">
            <span>
              Shock:{' '}
              <span className={tf.shock === 'ready' ? 'text-signal' : 'text-ink-200'}>
                {tf.shock === 'ready' ? 'Ready' : 'Planning'}
              </span>
            </span>
            {tf.consolidating && <span className="text-warn">Consolidating — needs full Org & Stability ≥ 50</span>}
            {tf.retreating && <span className="text-alert">Retreating — regroups on arrival</span>}
          </div>
          {battle && (
            <button
              type="button"
              onClick={() => openBattleLogs(battle.id)}
              className="mt-1 w-full rounded border border-alert/60 px-2 py-1 text-left text-[11px] text-alert hover:bg-alert/10"
              data-battle-status
            >
              ⚔{' '}
              {battle.kind === 'standoff'
                ? 'Exchanging long-range fire over'
                : battle.attacker.taskForceId === tf.id
                  ? 'Attacking'
                  : 'Defending'}{' '}
              {game.regions[battle.regionId].name} vs{' '}
              {battle.attacker.taskForceId === tf.id ? battle.defender.name : battle.attacker.name} — open log
            </button>
          )}
          {tf.standoffTarget && (
            <p className="mt-1 text-[10px] text-warn" data-standoff-status>
              🚀 Standoff fire on {game.regions[tf.standoffTarget].name}
              {own && (
                <button type="button" onClick={() => orderStandoff(tf.id, null)} className="ml-2 text-alert underline">
                  cancel
                </button>
              )}
            </p>
          )}
        </div>

        <div className="mb-3 text-xs">
          <div className="text-[10px] tracking-[0.15em] text-ink-400 uppercase">Orders</div>
          {!m || m.legs.length === 0 ? (
            m && m.backtrack > 0 ? (
              <p className="text-ink-100">
                Returning to {region.name} — {formatInt(m.backtrack)} mi to go
              </p>
            ) : (
              <p className="text-ink-100">Holding in {region.name}</p>
            )
          ) : (
            <>
              {m.backtrack > 0 && (
                <p className="text-warn">
                  Returning to {region.name} first — {formatInt(m.backtrack)} mi at Combat Speed
                </p>
              )}
              <p className="text-ink-100">
                → {game.regions[m.legs[0]].name}{' '}
                <span className="text-ink-400">
                  {formatInt(m.progress)}/{formatInt(game.distances[pairKey(tf.regionId, m.legs[0])])} mi
                </span>
              </p>
              {m.legs.length > 1 && (
                <p className="text-ink-400">
                  then{' '}
                  {m.legs
                    .slice(1)
                    .map((id) => game.regions[id].name)
                    .join(' → ')}
                </p>
              )}
              {eta !== null && (
                <p className="text-ink-400">
                  ETA {eta} ticks (~{(eta / 24).toFixed(1)} days)
                </p>
              )}
            </>
          )}
          <p className="mt-1 text-ink-400">
            Speed <span className="text-ink-100">{speed ? `${speed.combat}(${speed.transit}) mph` : '—'}</span>
          </p>
        </div>

        <div className="mb-3 border-t border-ink-700 pt-2 text-xs">
          <div className="mb-1 text-[10px] tracking-[0.15em] text-ink-400 uppercase">Composition</div>
          {tf.composition.length === 0 && <p className="text-ink-400">No units.</p>}
          {tf.composition.map((line) => {
            const design = findDesign(game, tf.faction, line.designId)
            if (!design) return null
            return (
              <div key={line.designId} className="flex justify-between py-0.5">
                <span className="text-ink-100">
                  {design.name} <span className="font-mono text-signal">{chevrons(line.priority)}</span>
                </span>
                <span className="text-ink-200">
                  E {line.equipment}/{line.target} · M {formatInt(line.manpower)}/
                  {formatInt(line.target * unitManpower(design))}
                </span>
              </div>
            )
          })}
        </div>

        {own && (
          <div className="border-t border-ink-700 pt-2">
            {pinned ? (
              <p className="mb-2 text-[10px] text-signal">
                Active — click a region to move; shift-click adds a leg; the 🚀 by the icon aims standoff fire.
              </p>
            ) : (
              <p className="mb-2 text-[10px] text-ink-400">Click to make Active for orders.</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!m}
                onClick={() => orderMove(tf.id, tf.regionId, false)}
                className="rounded border border-ink-600 px-2 py-0.5 text-[10px] tracking-[0.15em] text-ink-200 uppercase hover:border-warn hover:text-warn disabled:opacity-40 disabled:hover:border-ink-600 disabled:hover:text-ink-200"
              >
                Halt
              </button>
              <button
                type="button"
                onClick={() => openEditor(tf.id)}
                className="rounded border border-signal-dim px-2 py-0.5 text-[10px] tracking-[0.15em] text-signal uppercase hover:bg-signal/10"
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="mb-1" title={`${label} ${Math.round(value)} / ${Math.round(max)}`}>
      <div className="flex justify-between text-[10px] tracking-[0.15em] text-ink-400 uppercase">
        <span>{label}</span>
        <span className="text-ink-200">
          {Math.round(value)}/{Math.round(max)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded bg-ink-800">
        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
