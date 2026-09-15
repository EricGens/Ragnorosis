import { useState } from 'react'
import { formatInt } from '../../sim/format'
import { designStats } from '../../sim/military/design'
import { slotOptions, unitManpower } from '../../sim/military/taskForce'
import type { LineRole } from '../../sim/types'
import { LINE_ROLES } from '../../sim/types'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { PRIORITY_LABEL, chevrons } from './priority'

const ROLE_LABEL: Record<LineRole, string> = { frontLine: 'Front Line', longRange: 'Long-Range Fires', cas: 'CAS' }

/**
 * The Task Force Editor (Epoch 2 skeleton §6): the composition grid (unit type × desired count,
 * with priority chevrons) below, the line-assignment layer (Front Line 12 / Long-Range 12 / CAS 6)
 * above. Edits apply immediately — resources move with them inside the sim.
 */
export function TaskForceEditor() {
  const { open, id } = useUIStore((s) => s.taskForceEditor)
  const close = useUIStore((s) => s.closeTaskForceEditor)
  const game = useGameStore((s) => s.game)
  const activeFaction = useGameStore((s) => s.activeFaction)
  const setTarget = useGameStore((s) => s.setTaskForceTarget)
  const cycle = useGameStore((s) => s.cycleTaskForcePriority)
  const assign = useGameStore((s) => s.assignTaskForceSlot)
  const rename = useGameStore((s) => s.renameTaskForce)
  const disband = useGameStore((s) => s.deleteTaskForce)

  const [picker, setPicker] = useState<{ role: LineRole; index: number } | null>(null)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [confirmDisband, setConfirmDisband] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const tf = game.taskForces.find((t) => t.id === id)
  if (!open || !tf) return null
  const faction = game.factions[tf.faction]
  const region = game.regions[tf.regionId]
  const own = tf.faction === activeFaction
  const designOf = (designId: number) => faction.designs.find((d) => d.id === designId)
  const unused = faction.designs.filter((d) => !tf.composition.some((l) => l.designId === d.id))

  const report = (r: { ok: boolean; reason?: string }) => setNotice(r.ok ? null : (r.reason ?? null))

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink-950/70" onClick={close}>
      <div
        className="flex w-[56rem] max-w-[calc(100%-2rem)] flex-col gap-4 rounded border border-ink-600 bg-ink-900 p-5 shadow-2xl"
        role="dialog"
        aria-label="Task Force Editor"
        onClick={(e) => {
          e.stopPropagation()
          setPicker(null)
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xs tracking-[0.25em] text-signal uppercase">Task Force</h2>
            <input
              className="rounded border border-ink-600 bg-ink-950 px-2 py-1 text-sm text-ink-100 focus:border-signal focus:outline-none disabled:border-transparent"
              value={nameDraft ?? tf.name}
              disabled={!own}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                if (nameDraft !== null) rename(tf.id, nameDraft)
                setNameDraft(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              aria-label="Task Force name"
            />
            <span className="text-xs text-ink-400">
              {region.name} · {faction.id}
            </span>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            ×
          </button>
        </div>

        {/* Line assignment layer */}
        <div className="flex flex-col gap-2">
          {LINE_ROLES.map((role) => (
            <div key={role} className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-[10px] tracking-[0.15em] text-ink-400 uppercase">
                {ROLE_LABEL[role]} <span className="text-ink-600">({tf.lines[role].length})</span>
              </span>
              <div className="flex flex-wrap gap-1">
                {tf.lines[role].map((designId, i) => {
                  const design = designId === null ? undefined : designOf(designId)
                  const isPicking = picker?.role === role && picker.index === i
                  return (
                    <div key={i} className="relative">
                      <button
                        type="button"
                        disabled={!own}
                        title={design ? `${design.name} — click to remove` : 'Empty slot — click to assign'}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (design) report(assign(tf.id, role, i, null))
                          else setPicker(isPicking ? null : { role, index: i })
                        }}
                        className={`h-8 w-14 truncate rounded border px-1 text-[9px] leading-tight ${
                          design
                            ? 'border-ink-600 bg-ink-800 text-ink-100 hover:border-alert'
                            : 'border-dashed border-ink-700 text-ink-600 hover:border-signal-dim'
                        } disabled:cursor-default disabled:hover:border-ink-700`}
                      >
                        {design?.name ?? ''}
                      </button>
                      {isPicking && (
                        <ul
                          className="absolute top-full left-0 z-10 mt-1 w-44 rounded border border-ink-600 bg-ink-900 p-1 shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {slotOptions(game, tf, role).length === 0 && (
                            <li className="px-2 py-1 text-[11px] text-ink-400">Nothing eligible</li>
                          )}
                          {slotOptions(game, tf, role).map((d) => (
                            <li key={d.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  report(assign(tf.id, role, i, d.id))
                                  setPicker(null)
                                }}
                                className="w-full rounded px-2 py-1 text-left text-[11px] text-ink-100 hover:bg-ink-100/5"
                              >
                                {d.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-ink-400">Anything not placed on a line is held in Reserves.</p>
        </div>

        {/* Composition grid */}
        <div className="border-t border-ink-700 pt-3">
          <div className="mb-1 grid grid-cols-[1fr_5rem_11rem_7rem] gap-2 text-[10px] tracking-[0.15em] text-ink-400 uppercase">
            <span>Unit type</span>
            <span>Priority</span>
            <span>Equipment · Manpower</span>
            <span className="text-right">Count</span>
          </div>
          {tf.composition.length === 0 && <p className="py-2 text-xs text-ink-400">No unit types yet.</p>}
          {tf.composition.map((line) => {
            const design = designOf(line.designId)
            if (!design) return null
            const stats = designStats(design.platform, design.modules)
            const needMp = line.target * unitManpower(design)
            return (
              <div key={line.designId} className="grid grid-cols-[1fr_5rem_11rem_7rem] items-center gap-2 py-1 text-xs">
                <span className="text-ink-100">
                  {design.name} <span className="text-ink-400">· {formatInt(stats.cost)} Prod</span>
                </span>
                <button
                  type="button"
                  disabled={!own}
                  onClick={() => cycle(tf.id, line.designId)}
                  title={`${PRIORITY_LABEL[line.priority]} priority — click to cycle`}
                  className="w-fit rounded border border-ink-600 px-2 py-0.5 font-mono text-sm leading-none text-signal hover:border-signal disabled:hover:border-ink-600"
                >
                  {chevrons(line.priority)}
                </button>
                <span className="text-ink-200">
                  <span title="Equipment on hand / needed">
                    E {line.equipment}/{line.target}
                  </span>
                  <span className="text-ink-600"> · </span>
                  <span title="Manpower assigned / needed">
                    M {formatInt(line.manpower)}/{formatInt(needMp)}
                  </span>
                </span>
                <span className="flex items-center justify-end gap-1">
                  <CountButton disabled={!own} onClick={() => report(setTarget(tf.id, line.designId, line.target - 1))}>
                    −
                  </CountButton>
                  <span className="w-8 text-center text-ink-100">{line.target}</span>
                  <CountButton disabled={!own} onClick={() => report(setTarget(tf.id, line.designId, line.target + 1))}>
                    +
                  </CountButton>
                </span>
              </div>
            )
          })}
          {own && unused.length > 0 && (
            <select
              className="mt-2 rounded border border-ink-600 bg-ink-950 px-2 py-1 text-xs text-ink-100"
              value=""
              onChange={(e) => {
                if (e.target.value) report(setTarget(tf.id, Number(e.target.value), 1))
              }}
            >
              <option value="">Add unit type…</option>
              {unused.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {own && faction.designs.length === 0 && (
            <p className="mt-2 text-[10px] text-ink-400">Design a unit in the Unit Editor first.</p>
          )}
        </div>

        {notice && <p className="text-xs text-warn">{notice}</p>}
        {confirmDisband && (
          <div className="flex items-center justify-between gap-3 rounded border border-warn/60 bg-ink-950 px-3 py-2 text-xs text-ink-100">
            <span>Disband {tf.name}? Its Equipment returns to the stockpile and its Manpower to the pool.</span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDisband(false)}
                className="rounded border border-ink-600 px-2 py-0.5 text-[10px] tracking-[0.15em] text-ink-200 uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  disband(tf.id)
                  close()
                }}
                className="rounded border border-alert/60 px-2 py-0.5 text-[10px] tracking-[0.15em] text-alert uppercase"
              >
                OK
              </button>
            </span>
          </div>
        )}
        {own && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setConfirmDisband(true)}
              className="rounded border border-alert/60 px-3 py-1 text-[11px] tracking-[0.15em] text-alert uppercase hover:bg-alert/10"
            >
              Disband
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CountButton({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-6 w-6 rounded border border-ink-600 text-sm leading-none text-ink-200 hover:border-signal hover:text-signal disabled:cursor-default disabled:hover:border-ink-600 disabled:hover:text-ink-200"
    >
      {children}
    </button>
  )
}
