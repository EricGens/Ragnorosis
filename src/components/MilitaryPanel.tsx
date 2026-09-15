import { useState } from 'react'
import { tickInPulse } from '../sim/clock'
import { formatInt } from '../sim/format'
import { factionFacilityMultiplier } from '../sim/formulas/conversion'
import { manpowerCap } from '../sim/formulas/manpower'
import { allStandings, demandPools } from '../sim/military/pipeline'
import { factionTaskForces, unitManpower } from '../sim/military/taskForce'
import { computeAllocation } from '../sim/steps/productionSteps'
import { isLand } from '../sim/types'
import { useDisplayGame, useGameStore } from '../store/gameStore'
import { useUIStore } from '../store/uiStore'
import { PRIORITY_LABEL, chevrons } from './military/priority'
import { MilitaryIcon } from './panels/overlayIcons'

/** Persistent right-side button opening the Military interface (Epoch 1 skeleton §4.6, Epoch 2 §6). */
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

/**
 * The Military panel (Epoch 2 skeleton §6 "Military Button"): one line per Equipment SKU per
 * priority pool showing `filled/target` and the shared stockpile against its 3× cap, a single
 * Manpower row, the Task Force list, and routes into both editors.
 */
export function MilitaryPanel() {
  const open = useUIStore((s) => s.militaryOpen)
  const openUnitEditor = useUIStore((s) => s.openUnitEditor)
  const openTaskForceEditor = useUIStore((s) => s.openTaskForceEditor)
  const game = useDisplayGame()
  const activeFaction = useGameStore((s) => s.activeFaction)
  const createTaskForce = useGameStore((s) => s.createTaskForce)
  const [filter, setFilter] = useState('')
  const [newRegion, setNewRegion] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
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

  const standings = new Map(allStandings(game, faction.id).map((s) => [s.design.id, s]))
  const needle = filter.trim().toLowerCase()
  const rows = demandPools(game, faction.id)
    .filter((p) => !needle || p.design.name.toLowerCase().includes(needle))
    // Most under-filled relative to demand first, so real problems surface at the top.
    .sort((a, b) => a.equipped / a.target - b.equipped / b.target || a.design.name.localeCompare(b.design.name))
  const idle = [...standings.values()].filter(
    (s) => s.target === 0 && (!needle || s.design.name.toLowerCase().includes(needle)),
  )

  const taskForces = factionTaskForces(game, faction.id)
  let manpowerAssigned = 0
  let manpowerNeeded = 0
  for (const tf of taskForces) {
    for (const line of tf.composition) {
      const design = faction.designs.find((d) => d.id === line.designId)
      if (!design) continue
      manpowerAssigned += line.manpower
      manpowerNeeded += line.target * unitManpower(design)
    }
  }

  const controlled = game.regionOrder
    .map((id) => game.regions[id])
    .filter((r) => isLand(r) && r.controller === faction.id)
  const regionValue = controlled.some((r) => r.id === newRegion) ? newRegion : (controlled[0]?.id ?? '')

  return (
    <aside
      className="absolute top-4 right-10 z-10 flex max-h-[calc(100%-2rem)] w-96 flex-col rounded border border-ink-600 bg-ink-900/95 shadow-2xl"
      aria-label="Military panel"
    >
      <div className="flex items-center justify-between border-b border-ink-700 px-4 py-2">
        <h2 className="text-xs tracking-[0.2em] text-signal uppercase">Military</h2>
        <button
          type="button"
          onClick={() => openUnitEditor(null)}
          className="rounded border border-signal-dim px-2 py-0.5 text-[10px] tracking-[0.15em] text-signal uppercase hover:bg-signal/10"
        >
          Unit editor
        </button>
      </div>

      <div className="overflow-y-auto p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] tracking-[0.15em] text-ink-400 uppercase">
            Equipment{' '}
            {equipmentIncoming > 0 && <span className="text-signal">(+{formatInt(equipmentIncoming)} Prod)</span>}
          </span>
          <input
            className="w-28 rounded border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-[11px] text-ink-100 focus:border-signal focus:outline-none"
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter Equipment lines"
          />
        </div>
        {rows.length === 0 && idle.length === 0 && (
          <p className="text-[10px] text-ink-400">
            {faction.designs.length === 0 ? 'No unit designs yet — open the Unit Editor.' : 'No matching lines.'}
          </p>
        )}
        <ul className="text-xs">
          {rows.map((row) => {
            const s = standings.get(row.design.id)!
            const short = row.equipped < row.target
            return (
              <li key={`${row.design.id}|${row.priority}`}>
                <button
                  type="button"
                  onClick={() => openUnitEditor(row.design.id)}
                  title="Open in the Unit Editor"
                  className="w-full rounded px-1 py-1 text-left hover:bg-ink-100/5"
                >
                  <span className="flex justify-between">
                    <span className="text-ink-100">
                      {row.design.name} Equipment <span className="text-ink-400">({PRIORITY_LABEL[row.priority]})</span>{' '}
                      <span className="font-mono text-signal" title={`${PRIORITY_LABEL[row.priority]} priority`}>
                        {chevrons(row.priority)}
                      </span>
                    </span>
                    <span className={short ? 'text-warn' : 'text-ink-100'}>
                      {row.equipped}/{row.target}
                    </span>
                  </span>
                  <span className="flex justify-between text-[10px] text-ink-400">
                    <span>Stockpile</span>
                    <span>
                      {s.stockpile}/{s.stockpileCap}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
          {idle.map((s) => (
            <li key={`idle-${s.design.id}`}>
              <button
                type="button"
                onClick={() => openUnitEditor(s.design.id)}
                title="Open in the Unit Editor"
                className="flex w-full justify-between rounded px-1 py-1 text-left text-ink-400 hover:bg-ink-100/5"
              >
                <span>{s.design.name} Equipment — no demand</span>
                <span>Stockpile {s.stockpile}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 border-t border-ink-700 pt-2">
          <div className="flex items-baseline justify-between py-1">
            <span className="text-[11px] tracking-[0.15em] text-ink-400 uppercase">Manpower</span>
            <span className="text-sm text-ink-100">
              {formatInt(faction.manpower)} / {formatInt(cap)}
              {manpowerIncoming > 0 && (
                <span className="ml-1 text-xs text-signal">(+{formatInt(manpowerIncoming)})</span>
              )}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-ink-400">
            <span>In Task Forces</span>
            <span className={manpowerAssigned < manpowerNeeded ? 'text-warn' : ''}>
              {formatInt(manpowerAssigned)}/{formatInt(manpowerNeeded)}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-ink-400">
            Pool capped at 2% of controlled Population; Task Forces draw from it at pulse end.
          </p>
        </div>

        <div className="mt-3 border-t border-ink-700 pt-2">
          <div className="mb-1 text-[11px] tracking-[0.15em] text-ink-400 uppercase">Task Forces</div>
          {taskForces.length === 0 && <p className="text-[10px] text-ink-400">None raised yet.</p>}
          <ul className="text-xs">
            {taskForces.map((tf) => {
              const target = tf.composition.reduce((s, l) => s + l.target, 0)
              const equipped = tf.composition.reduce((s, l) => s + l.equipment, 0)
              return (
                <li key={tf.id}>
                  <button
                    type="button"
                    onClick={() => openTaskForceEditor(tf.id)}
                    className="flex w-full justify-between rounded px-1 py-0.5 text-left hover:bg-ink-100/5"
                  >
                    <span className="text-ink-100">
                      {tf.name} <span className="text-ink-400">· {game.regions[tf.regionId].name}</span>
                    </span>
                    <span className={equipped < target ? 'text-warn' : 'text-ink-400'}>
                      {equipped}/{target} units
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <select
              className="flex-1 rounded border border-ink-600 bg-ink-950 px-1 py-0.5 text-[11px] text-ink-100"
              value={regionValue}
              onChange={(e) => setNewRegion(e.target.value)}
              aria-label="Region to raise a Task Force in"
              disabled={controlled.length === 0}
            >
              {controlled.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!regionValue}
              onClick={() => {
                const r = createTaskForce(regionValue)
                if (r.ok) openTaskForceEditor(r.id)
                else setNotice(r.reason)
              }}
              className="rounded border border-signal-dim px-2 py-0.5 text-[10px] tracking-[0.15em] text-signal uppercase hover:bg-signal/10 disabled:border-ink-700 disabled:text-ink-400"
            >
              Raise Task Force
            </button>
          </div>
          {notice && <p className="mt-1 text-[10px] text-warn">{notice}</p>}
        </div>
      </div>
    </aside>
  )
}
