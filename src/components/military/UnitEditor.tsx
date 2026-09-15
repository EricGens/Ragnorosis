import { useEffect, useMemo, useState } from 'react'
import { formatInt } from '../../sim/format'
import { autoName, designProblems, designStats, findDuplicate } from '../../sim/military/design'
import {
  PLATFORMS,
  PLATFORM_IDS,
  VECTOR_COLUMNS,
  type ModuleDef,
  type ModuleId,
  type PlatformId,
  type SlotKind,
} from '../../sim/military/platforms'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'

const SLOT_LABEL: Record<SlotKind, string> = { weapon: 'Main Weapon', engine: 'Engine', misc: 'Misc' }
const SLOT_ORDER: SlotKind[] = ['weapon', 'engine', 'misc']

interface Draft {
  designId: number | null
  platform: PlatformId
  modules: ModuleId[]
  name: string
  nameEdited: boolean
}

/** Single-option required slots fill themselves; everything else starts empty (§6 auto-population). */
function initialModules(platform: PlatformId): ModuleId[] {
  const p = PLATFORMS[platform]
  const out: ModuleId[] = []
  for (const slot of SLOT_ORDER) {
    const options = p.modules.filter((m) => m.slot === slot)
    if (p.slots[slot].min >= 1 && options.length === 1) out.push(options[0].id)
  }
  return out
}

function draftFor(
  designId: number | null,
  designs: { id: number; name: string; platform: PlatformId; modules: string[] }[],
): Draft {
  const existing = designId === null ? undefined : designs.find((d) => d.id === designId)
  if (existing) {
    return {
      designId: existing.id,
      platform: existing.platform,
      modules: [...existing.modules],
      name: existing.name,
      nameEdited: existing.name !== autoName(existing.platform, existing.modules),
    }
  }
  const platform = PLATFORM_IDS[0]
  const modules = initialModules(platform)
  return { designId: null, platform, modules, name: autoName(platform, modules), nameEdited: false }
}

/**
 * The Unit Editor (Epoch 2 skeleton §6): pick a platform, fill its slots, watch the derived stats,
 * save to the faction's roster. Names auto-update until edited; duplicates (same module multiset)
 * offer a rename instead of a second copy.
 */
export function UnitEditor() {
  const { open, designId } = useUIStore((s) => s.unitEditor)
  const close = useUIStore((s) => s.closeUnitEditor)
  const openOn = useUIStore((s) => s.openUnitEditor)
  const designs = useGameStore((s) => s.game.factions[s.activeFaction].designs)
  const save = useGameStore((s) => s.saveDesign)
  const rename = useGameStore((s) => s.renameDesign)
  const remove = useGameStore((s) => s.deleteDesign)

  const [draft, setDraft] = useState<Draft>(() => draftFor(designId, designs))
  const [picker, setPicker] = useState<{ slot: SlotKind; index: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onOk: () => void } | null>(null)

  // Re-seed the draft whenever the editor is (re)opened on a different design.
  useEffect(() => {
    if (open) {
      setDraft(draftFor(designId, designs))
      setPicker(null)
      setNotice(null)
      setConfirm(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, designId])

  const platform = PLATFORMS[draft.platform]
  const stats = useMemo(() => designStats(draft.platform, draft.modules), [draft.platform, draft.modules])
  const problems = useMemo(() => designProblems(draft.platform, draft.modules), [draft.platform, draft.modules])
  const valid = problems.length === 0
  const saved = draft.designId === null ? undefined : designs.find((d) => d.id === draft.designId)
  const dirty = saved
    ? saved.name !== draft.name || saved.modules.join() !== draft.modules.join()
    : draft.modules.join() !== initialModules(draft.platform).join() || draft.nameEdited

  if (!open) return null

  const setModules = (modules: ModuleId[]) =>
    setDraft((d) => ({ ...d, modules, name: d.nameEdited ? d.name : autoName(d.platform, modules) }))

  /** Modules equipped in a given slot kind, in equip order. */
  const inSlot = (slot: SlotKind) =>
    draft.modules.filter((id) => platform.modules.find((m) => m.id === id)?.slot === slot)

  const optionsFor = (slot: SlotKind): ModuleDef[] =>
    platform.modules.filter(
      (m) => m.slot === slot && (platform.weaponDuplicates && slot === 'weapon' ? true : !draft.modules.includes(m.id)),
    )

  const equip = (id: ModuleId) => {
    setModules([...draft.modules, id])
    setPicker(null)
  }

  const unequip = (id: ModuleId) => {
    const idx = draft.modules.indexOf(id)
    if (idx >= 0) setModules([...draft.modules.slice(0, idx), ...draft.modules.slice(idx + 1)])
  }

  const switchTo = (next: number | null) => {
    const go = () => openOn(next)
    if (dirty) setConfirm({ message: `Discard changes to ${draft.name}?`, onOk: go })
    else go()
  }

  const onSave = () => {
    const duplicate = findDuplicate(designs, draft.platform, draft.modules, draft.designId ?? undefined)
    if (duplicate) {
      setConfirm({
        message: `Rename ${duplicate.name} to ${draft.name.trim()}?`,
        onOk: () => {
          const r = rename(duplicate.id, draft.name)
          if (!r.ok) setNotice(r.reason)
          else openOn(duplicate.id)
        },
      })
      return
    }
    const r = save({
      id: draft.designId ?? undefined,
      name: draft.name,
      platform: draft.platform,
      modules: draft.modules,
    })
    if (!r.ok) setNotice(r.reason)
    else openOn(r.id)
  }

  const onDelete = () => {
    if (draft.designId === null) return
    setConfirm({
      message:
        'Delete ALL units of this type from ALL task forces? Existing Equipment will be lost and manpower will be returned to the global pool. If you wish to remove units from a specific task force, use the Task Force editor.',
      onOk: () => {
        remove(draft.designId!)
        openOn(null)
      },
    })
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink-950/70" onClick={close}>
      <div
        className="flex w-[52rem] max-w-[calc(100%-2rem)] flex-col gap-4 rounded border border-ink-600 bg-ink-900 p-5 shadow-2xl"
        role="dialog"
        aria-label="Unit Editor"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xs tracking-[0.25em] text-signal uppercase">Unit Editor</h2>
          <button type="button" onClick={close} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            ×
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-4 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.15em] text-ink-400 uppercase">Active unit</span>
            <select
              className="rounded border border-ink-600 bg-ink-950 px-2 py-1 text-ink-100"
              value={draft.designId ?? 'new'}
              onChange={(e) => switchTo(e.target.value === 'new' ? null : Number(e.target.value))}
            >
              <option value="new">Create new unit</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.15em] text-ink-400 uppercase">Platform</span>
            <select
              className="rounded border border-ink-600 bg-ink-950 px-2 py-1 text-ink-100 disabled:opacity-50"
              value={draft.platform}
              disabled={draft.designId !== null}
              title={draft.designId !== null ? "A unit's platform is fixed once built" : undefined}
              onChange={(e) => {
                const p = e.target.value as PlatformId
                const modules = initialModules(p)
                setDraft({ designId: null, platform: p, modules, name: autoName(p, modules), nameEdited: false })
              }}
            >
              {PLATFORM_IDS.map((id) => (
                <option key={id} value={id}>
                  {PLATFORMS[id].name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
            <span className="text-[10px] tracking-[0.15em] text-ink-400 uppercase">Name</span>
            <input
              className="rounded border border-ink-600 bg-ink-950 px-2 py-1 text-ink-100 focus:border-signal focus:outline-none"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value, nameEdited: true }))}
            />
          </label>
        </div>

        <div className="grid grid-cols-[1fr_minmax(16rem,0.8fr)] gap-5">
          <div className="flex flex-col gap-3">
            {SLOT_ORDER.filter((slot) => platform.slots[slot].max > 0).map((slot) => {
              const equipped = inSlot(slot)
              const { min, max } = platform.slots[slot]
              return (
                <div key={slot}>
                  <div className="mb-1 text-[10px] tracking-[0.15em] text-ink-400 uppercase">
                    {SLOT_LABEL[slot]} <span className="text-ink-600">({min === max ? min : `${min}–${max}`})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: max }, (_, i) => {
                      const id = equipped[i]
                      const def = id ? platform.modules.find((m) => m.id === id) : undefined
                      const required = i < min && !def
                      const isPicking = picker?.slot === slot && picker.index === i
                      return (
                        <div key={i} className="relative">
                          <button
                            type="button"
                            onClick={() => (def ? unequip(def.id) : setPicker(isPicking ? null : { slot, index: i }))}
                            title={def ? 'Click to remove' : 'Click to choose'}
                            className={`flex h-14 w-36 flex-col items-center justify-center rounded border px-2 text-center text-[11px] ${
                              def
                                ? 'border-ink-600 bg-ink-800 text-ink-100 hover:border-alert'
                                : 'border-dashed border-ink-600 text-ink-400 hover:border-signal-dim'
                            }`}
                          >
                            {def ? def.name : 'Empty'}
                            {required && <span className="mt-0.5 text-[10px] text-warn">Required</span>}
                          </button>
                          {isPicking && (
                            <ul className="absolute top-full left-0 z-10 mt-1 w-56 rounded border border-ink-600 bg-ink-900 p-1 shadow-xl">
                              {optionsFor(slot).length === 0 && (
                                <li className="px-2 py-1 text-[11px] text-ink-400">Nothing available</li>
                              )}
                              {optionsFor(slot).map((m) => (
                                <li key={m.id}>
                                  <button
                                    type="button"
                                    onClick={() => equip(m.id)}
                                    className="w-full rounded px-2 py-1 text-left text-[11px] text-ink-100 hover:bg-ink-100/5"
                                  >
                                    {m.name} <span className="text-ink-400">· {m.cost} Prod</span>
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
              )
            })}
          </div>

          <StatsPanel stats={stats} />
        </div>

        {notice && <p className="text-xs text-warn">{notice}</p>}
        {confirm && (
          <div className="flex items-center justify-between gap-3 rounded border border-warn/60 bg-ink-950 px-3 py-2 text-xs text-ink-100">
            <span>{confirm.message}</span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded border border-ink-600 px-2 py-0.5 text-[10px] tracking-[0.15em] text-ink-200 uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { onOk } = confirm
                  setConfirm(null)
                  onOk()
                }}
                className="rounded border border-signal-dim px-2 py-0.5 text-[10px] tracking-[0.15em] text-signal uppercase"
              >
                OK
              </button>
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink-400">{problems[0] ?? (dirty ? 'Unsaved changes' : '')}</span>
          <span className="flex gap-2">
            {draft.designId !== null && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded border border-alert/60 px-3 py-1 text-[11px] tracking-[0.15em] text-alert uppercase hover:bg-alert/10"
              >
                Delete unit
              </button>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={!valid}
              className="rounded border border-signal-dim px-3 py-1 text-[11px] tracking-[0.15em] text-signal uppercase hover:bg-signal/10 disabled:cursor-not-allowed disabled:border-ink-700 disabled:text-ink-400"
            >
              Save unit
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}

function StatsPanel({ stats }: { stats: ReturnType<typeof designStats> }) {
  const vec = (i: number) => {
    const e = stats.vector[i]
    return e.long === null ? `${e.short}` : `${e.short}(${e.long})`
  }
  return (
    <div className="rounded border border-ink-700 bg-ink-950/60 p-3 text-xs">
      <div className="mb-2 text-[10px] tracking-[0.15em] text-ink-400 uppercase">Stats</div>
      <Row label="Production" value={formatInt(stats.cost)} />
      <Row label="Supply" value={stats.supply.toFixed(1)} />
      <div className="my-2 border-t border-ink-700 pt-2">
        <div className="mb-1 text-[10px] tracking-[0.15em] text-ink-400 uppercase">Combat vector</div>
        {VECTOR_COLUMNS.map((col, i) => (
          <Row key={col} label={`vs ${col}`} value={vec(i)} />
        ))}
        <p className="mt-1 text-[10px] text-ink-400">
          {stats.standoffCapable ? 'Standoff-capable — eligible for Deep Strike.' : 'No standoff capability.'}
        </p>
      </div>
      <Row label="Piercing" value={`${stats.piercing}`} />
      <Row label="Damage" value={`${stats.damage}`} />
      <Row label="Armor" value={`${stats.armor}`} />
      <Row label="Speed" value={`${stats.speed.combat}(${stats.speed.transit}) mph`} />
      <Row label="Organization" value={`${stats.organization}`} />
      <Row label="Health" value={`${stats.health}`} />
      <Row label="Manpower" value={`${stats.manpower}`} />
      <Row label="Weight" value={`${stats.weight}`} />
      {stats.radar > 0 && <Row label="Radar" value={`+${stats.radar}`} />}
      {stats.isr > 0 && <Row label="ISR" value={`+${stats.isr}`} />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-ink-400">{label}</span>
      <span className="text-ink-100">{value}</span>
    </div>
  )
}
