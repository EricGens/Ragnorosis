import { useState } from 'react'
import { BUILDINGS, BUILDING_TYPES } from '../../sim/data/buildings'
import { FACTIONS } from '../../sim/data/factions'
import { FOCUSES } from '../../sim/formulas/allocation'
import { createTaskForce, deleteTaskForce, fillTaskForce, setTaskForceFaction } from '../../sim/military/taskForce'
import {
  countries,
  countryRelation,
  factionRelation,
  setCountryRelation,
  setFactionRelation,
} from '../../sim/relations'
import type {
  CountryRelation,
  FactionId,
  FactionRelation,
  Focus,
  LandRegion,
  LogCategory,
  Region,
  TerrainTrait,
} from '../../sim/types'
import { FACTION_IDS, isLand } from '../../sim/types'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { NumberField, Section, SelectField, TextField, Toggle } from './fields'

const FACTION_OPTIONS = FACTION_IDS.map((id) => ({ value: id, label: FACTIONS[id].name }))
const CONTROLLER_OPTIONS = [{ value: 'none', label: 'Unaffiliated' }, ...FACTION_OPTIONS]
const TRAITS: TerrainTrait[] = ['rugged', 'mountainous']
const LOG_CATEGORIES: (LogCategory | 'all')[] = [
  'all',
  'time',
  'economy',
  'energy',
  'construction',
  'stability',
  'weather',
  'military',
  'dev',
]
const FACTION_RELATIONS: FactionRelation[] = ['friendly', 'neutral', 'hostile']
const COUNTRY_RELATIONS: CountryRelation[] = ['peace', 'war']

export function DevtoolsButton() {
  const open = useUIStore((s) => s.devtoolsOpen)
  const toggle = useUIStore((s) => s.toggleDevtools)
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={open}
      className={`absolute bottom-4 left-4 z-10 rounded border px-2 py-1 text-[10px] tracking-[0.3em] uppercase ${
        open ? 'border-warn bg-warn/10 text-warn' : 'border-ink-600 bg-ink-900 text-ink-400 hover:text-warn'
      }`}
    >
      Dev
    </button>
  )
}

/**
 * Devtools (skeleton §5). Only stored values are editable here; computed values (Production,
 * Research rate, Defensibility, the Stability anchor, delivered Energy…) are deliberately absent —
 * edit their inputs instead.
 */
export function DevtoolsPanel() {
  const open = useUIStore((s) => s.devtoolsOpen)
  if (!open) return null
  return (
    <aside
      className="absolute right-10 bottom-4 z-20 flex max-h-[calc(100%-2rem)] w-80 flex-col rounded border border-warn/60 bg-ink-900/95 shadow-2xl"
      aria-label="Devtools panel"
    >
      <div className="border-b border-ink-700 px-3 py-2 text-[10px] tracking-[0.3em] text-warn uppercase">Devtools</div>
      <div className="overflow-y-auto p-3">
        <TimeSection />
        <GlobalSection />
        <RelationsSection />
        <FactionSection />
        <TaskForceSection />
        <RegionSection />
        <LogSection />
      </div>
    </aside>
  )
}

function TimeSection() {
  const stepTick = useGameStore((s) => s.stepTick)
  const stepPulse = useGameStore((s) => s.stepPulse)
  const pause = useGameStore((s) => s.pause)
  return (
    <Section title="Time">
      <div className="flex gap-2">
        <DevButton
          onClick={() => {
            pause()
            stepTick()
          }}
        >
          Step tick
        </DevButton>
        <DevButton onClick={stepPulse}>Step pulse</DevButton>
      </div>
    </Section>
  )
}

function GlobalSection() {
  const game = useGameStore((s) => s.game)
  const mutate = useGameStore((s) => s.mutate)
  const activeFaction = useGameStore((s) => s.activeFaction)
  const setActiveFaction = useGameStore((s) => s.setActiveFaction)
  return (
    <Section title="Global">
      <NumberField
        label="Global Tension"
        value={game.globalTension}
        onCommit={(v) => mutate((d) => void (d.globalTension = v))}
        min={0}
      />
      <SelectField label="Perspective" value={activeFaction} options={FACTION_OPTIONS} onChange={setActiveFaction} />
      <NumberField
        label="Weather chance / tick"
        value={game.settings.weatherChancePerTick}
        onCommit={(v) => mutate((d) => void (d.settings.weatherChancePerTick = v))}
        min={0}
        max={1}
        step={0.001}
      />
      <NumberField
        label="Weather ticks"
        value={game.settings.weatherDurationTicks}
        onCommit={(v) => mutate((d) => void (d.settings.weatherDurationTicks = Math.round(v)))}
        min={1}
      />
      <NumberField
        label="Immigration rate"
        value={game.settings.immigrationRate}
        onCommit={(v) => mutate((d) => void (d.settings.immigrationRate = v))}
        min={0}
        step={0.0001}
      />
    </Section>
  )
}

/**
 * The Relationship Matrix (Epoch 2 skeleton §1.6). Pick a pair, set its state; War cascades to
 * Hostile and de-escalation cascades back to Peace inside the sim helpers, so order never matters.
 */
function RelationsSection() {
  const game = useGameStore((s) => s.game)
  const mutate = useGameStore((s) => s.mutate)
  const countryList = countries(game)
  const [fa, setFa] = useState<FactionId>('united-states')
  const [fb, setFb] = useState<FactionId>('china')
  const [ca, setCa] = useState(countryList[0] ?? '')
  const [cb, setCb] = useState(countryList[1] ?? countryList[0] ?? '')
  const countryOptions = countryList.map((c) => ({ value: c, label: c }))
  const factionEntries = Object.entries(game.relations.factions)
  const countryEntries = Object.entries(game.relations.countries)

  return (
    <Section title="Relations">
      <SelectField label="Faction A" value={fa} options={FACTION_OPTIONS} onChange={setFa} />
      <SelectField label="Faction B" value={fb} options={FACTION_OPTIONS} onChange={setFb} />
      <SelectField<FactionRelation>
        label="Relationship"
        value={factionRelation(game, fa, fb)}
        options={FACTION_RELATIONS.map((r) => ({ value: r, label: r }))}
        onChange={(v) => mutate((d) => setFactionRelation(d, fa, fb, v))}
      />
      <SelectField label="Country A" value={ca} options={countryOptions} onChange={setCa} />
      <SelectField label="Country B" value={cb} options={countryOptions} onChange={setCb} />
      <SelectField<CountryRelation>
        label="State"
        value={countryRelation(game, ca, cb)}
        options={COUNTRY_RELATIONS.map((r) => ({ value: r, label: r === 'war' ? 'at war' : 'at peace' }))}
        onChange={(v) => mutate((d) => setCountryRelation(d, ca, cb, v))}
      />
      <ul className="mt-1 text-[10px] leading-snug text-ink-400">
        {factionEntries.length === 0 && countryEntries.length === 0 && <li>All Neutral / At Peace.</li>}
        {factionEntries.map(([k, v]) => (
          <li key={k}>
            {k
              .split('|')
              .map((id) => FACTIONS[id as FactionId].name)
              .join(' ↔ ')}
            : <span className={v === 'hostile' ? 'text-alert' : 'text-ink-200'}>{v}</span>
          </li>
        ))}
        {countryEntries.map(([k, v]) => (
          <li key={k}>
            {k.replace('|', ' ↔ ')}:{' '}
            <span className={v === 'war' ? 'text-alert' : 'text-ink-200'}>{v === 'war' ? 'at war' : 'at peace'}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function FactionSection() {
  const activeFaction = useGameStore((s) => s.activeFaction)
  const faction = useGameStore((s) => s.game.factions[s.activeFaction])
  const mutate = useGameStore((s) => s.mutate)
  const edit = (fn: (f: typeof faction) => void) => mutate((d) => fn(d.factions[activeFaction]))
  return (
    <Section title={`Faction — ${FACTIONS[activeFaction].name}`}>
      <NumberField
        label="Money"
        value={faction.money}
        onCommit={(v) => edit((f) => void (f.money = v))}
        scale={1e9}
        suffix="B"
      />
      <NumberField
        label="Research"
        value={faction.research}
        onCommit={(v) => edit((f) => void (f.research = v))}
        min={0}
      />
      <NumberField
        label="Legitimacy"
        value={faction.legitimacy}
        onCommit={(v) => edit((f) => void (f.legitimacy = v))}
        min={0}
      />
      <NumberField
        label="Manpower"
        value={faction.manpower}
        onCommit={(v) => edit((f) => void (f.manpower = Math.round(v)))}
        min={0}
      />
      <SelectField<Focus>
        label="Focus"
        value={faction.focus}
        options={FOCUSES.map((f) => ({ value: f, label: f }))}
        onChange={(v) => edit((f) => void (f.focus = v))}
      />
    </Section>
  )
}

/** Task Force devtools (Epoch 2 skeleton §7): spawn, fill instantly, reassign, disband. */
function TaskForceSection() {
  const game = useGameStore((s) => s.game)
  const mutate = useGameStore((s) => s.mutate)
  const openTaskForceEditor = useUIStore((s) => s.openTaskForceEditor)
  const [spawnFaction, setSpawnFaction] = useState<FactionId>('united-states')
  const [spawnRegion, setSpawnRegion] = useState('')
  const [selected, setSelected] = useState<number | null>(null)

  const controlled = game.regionOrder
    .map((id) => game.regions[id])
    .filter((r): r is LandRegion => isLand(r) && r.controller === spawnFaction)
  const regionValue = controlled.some((r) => r.id === spawnRegion) ? spawnRegion : (controlled[0]?.id ?? '')
  const tf = game.taskForces.find((t) => t.id === selected) ?? game.taskForces[0]

  return (
    <Section title="Task Forces">
      <SelectField label="Spawn for" value={spawnFaction} options={FACTION_OPTIONS} onChange={setSpawnFaction} />
      <SelectField
        label="In region"
        value={regionValue}
        options={controlled.map((r) => ({ value: r.id, label: r.name }))}
        onChange={setSpawnRegion}
      />
      <div className="mt-1 flex gap-2">
        <DevButton
          onClick={() =>
            mutate((d) => {
              // Block body on purpose: a returned result would replace the state in Immer.
              createTaskForce(d, spawnFaction, regionValue)
            })
          }
        >
          Spawn Task Force
        </DevButton>
      </div>
      {tf && (
        <>
          <SelectField
            label="Task Force"
            value={String(tf.id)}
            options={game.taskForces.map((t) => ({
              value: String(t.id),
              label: `${t.name} (${FACTIONS[t.faction].name})`,
            }))}
            onChange={(v) => setSelected(Number(v))}
          />
          <SelectField
            label="Faction"
            value={tf.faction}
            options={FACTION_OPTIONS}
            onChange={(v) => mutate((d) => setTaskForceFaction(d, tf.id, v))}
          />
          <div className="mt-1 flex flex-wrap gap-2">
            <DevButton onClick={() => mutate((d) => fillTaskForce(d, tf.id))}>Fill to target</DevButton>
            <DevButton onClick={() => openTaskForceEditor(tf.id)}>Open editor</DevButton>
            <DevButton onClick={() => mutate((d) => deleteTaskForce(d, tf.id))}>Disband</DevButton>
          </div>
        </>
      )}
    </Section>
  )
}

function RegionSection() {
  const hovered = useUIStore((s) => s.hovered)
  const pinned = useUIStore((s) => s.pinned)
  const ref = pinned ?? hovered
  const region = useGameStore((s) => (ref?.kind === 'region' ? s.game.regions[ref.id] : undefined))
  if (!region) {
    return (
      <Section title="Region">
        <p className="text-[11px] text-ink-400">Click a region on the map to edit it.</p>
      </Section>
    )
  }
  return isLand(region) ? <LandRegionFields region={region} /> : <MaritimeRegionFields region={region} />
}

function MaritimeRegionFields({ region }: { region: Region }) {
  const mutate = useGameStore((s) => s.mutate)
  return (
    <Section title={`Region — ${region.name}`}>
      <NumberField
        label="Energy reserve"
        value={region.energyReserve}
        onCommit={(v) => mutate((d) => void (d.regions[region.id].energyReserve = v))}
        min={0}
      />
      <WeatherToggle region={region} />
    </Section>
  )
}

function WeatherToggle({ region }: { region: Region }) {
  const mutate = useGameStore((s) => s.mutate)
  return (
    <Toggle
      label="Weather active"
      value={region.weatherActive}
      onChange={(v) =>
        mutate((d) => {
          const r = d.regions[region.id]
          r.weatherActive = v
          r.weatherTicksRemaining = v ? d.settings.weatherDurationTicks : 0
        })
      }
    />
  )
}

function LandRegionFields({ region }: { region: LandRegion }) {
  const mutate = useGameStore((s) => s.mutate)
  const edit = (fn: (r: LandRegion) => void) => mutate((d) => fn(d.regions[region.id] as LandRegion))

  return (
    <Section title={`Region — ${region.name}`}>
      <SelectField
        label="Control"
        value={region.controller ?? 'none'}
        options={CONTROLLER_OPTIONS}
        onChange={(v) => edit((r) => void (r.controller = v === 'none' ? null : (v as FactionId)))}
      />
      <TextField label="Country" value={region.country} onCommit={(v) => edit((r) => void (r.country = v))} />
      <NumberField
        label="Population"
        value={region.population}
        onCommit={(v) => edit((r) => void (r.population = Math.round(v)))}
        min={0}
        scale={1e6}
        suffix="M"
      />
      <NumberField
        label="GDP"
        value={region.gdp}
        onCommit={(v) => edit((r) => void (r.gdp = v))}
        min={0}
        scale={1e9}
        suffix="B"
      />
      <NumberField
        label="Stability"
        value={region.stability}
        onCommit={(v) => edit((r) => void (r.stability = v))}
        min={0}
        max={100}
        step={0.1}
      />
      <NumberField
        label="Energy reserve"
        value={region.energyReserve}
        onCommit={(v) => edit((r) => void (r.energyReserve = v))}
        min={0}
      />
      <WeatherToggle region={region} />
      {TRAITS.map((t) => (
        <Toggle
          key={t}
          label={`Trait: ${t}`}
          value={region.traits.includes(t)}
          onChange={(v) =>
            edit((r) => void (r.traits = v ? [...r.traits.filter((x) => x !== t), t] : r.traits.filter((x) => x !== t)))
          }
        />
      ))}

      <p className="mt-2 text-[10px] tracking-[0.12em] text-ink-400 uppercase">Popularity</p>
      {FACTION_IDS.map((id) => (
        <NumberField
          key={id}
          label={FACTIONS[id].name}
          value={region.popularity[id]}
          onCommit={(v) => edit((r) => void (r.popularity[id] = v))}
          min={0}
          max={100}
          step={0.1}
          suffix="%"
        />
      ))}

      <p className="mt-2 text-[10px] tracking-[0.12em] text-ink-400 uppercase">Buildings (spawn directly)</p>
      {BUILDING_TYPES.map((type) => (
        <NumberField
          key={type}
          label={BUILDINGS[type].name}
          value={region.buildings[type] ?? 0}
          onCommit={(v) =>
            mutate((d) => {
              const r = d.regions[region.id] as LandRegion
              const level = Math.max(0, Math.min(BUILDINGS[type].maxLevel ?? Infinity, Math.round(v)))
              if (level > 0) r.buildings[type] = level
              else delete r.buildings[type]
              // A spawned level supersedes any project on that square.
              for (const f of Object.values(d.factions)) {
                f.projects = f.projects.filter((p) => !(p.regionId === region.id && p.building === type))
              }
            })
          }
          min={0}
          max={BUILDINGS[type].maxLevel}
        />
      ))}
    </Section>
  )
}

function LogSection() {
  const log = useGameStore((s) => s.game.log)
  const [category, setCategory] = useState<LogCategory | 'all'>('all')
  const entries = (category === 'all' ? log : log.filter((e) => e.category === category)).slice(-40).reverse()
  return (
    <Section title="Resolution log">
      <SelectField
        label="Category"
        value={category}
        options={LOG_CATEGORIES.map((c) => ({ value: c, label: c }))}
        onChange={setCategory}
      />
      <ol className="mt-1 max-h-48 overflow-y-auto font-mono text-[10px] leading-snug text-ink-200">
        {entries.length === 0 && <li className="text-ink-400">Nothing yet.</li>}
        {entries.map((e, i) => (
          <li key={i} className="border-b border-ink-800 py-0.5">
            <span className="text-ink-400">t{e.tick} </span>
            <span className="text-signal-dim">{e.category} </span>
            {e.message}
          </li>
        ))}
      </ol>
    </Section>
  )
}

function DevButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-ink-600 px-2 py-0.5 text-[10px] tracking-[0.15em] text-ink-200 uppercase hover:border-warn hover:text-warn"
    >
      {children}
    </button>
  )
}
