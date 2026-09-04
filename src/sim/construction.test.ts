import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { advancePulse, advanceTick } from './advance'
import { TICKS_PER_PULSE, tickInPulse } from './clock'
import { buildingCost } from './data/buildings'
import { DUMMY_MAP } from './data/dummyMap'
import { MAX_ACTIVE_PROJECTS, availableBuildings, canQueueBuild, queueBuild } from './construction'
import { manpowerCap } from './formulas/manpower'
import { createInitialState } from './state'
import { computeAllocation, factionProduction } from './steps/productionSteps'
import type { GameState, LandRegion } from './types'

const base = createInitialState(DUMMY_MAP)
const US = 'united-states'

function withQueued(state: GameState, regionId: string, building: Parameters<typeof queueBuild>[3], focus = state.factions[US].focus) {
  return produce(state, (d) => {
    d.factions[US].focus = focus
    const r = queueBuild(d, US, regionId, building)
    if (!r.ok) throw new Error(r.reason)
  })
}

describe('queue rules', () => {
  it('lists only buildings not already on the grid, only for controlled regions', () => {
    expect(availableBuildings(base, US, 'w-land').sort()).toEqual(['fortification', 'production-facility', 'training-facility'])
    expect(availableBuildings(base, US, 'c-land')).toEqual([])
    expect(availableBuildings(base, 'hive', 'c-land')).toEqual(['training-facility'])
  })

  it('prices a new level at the escalating cost', () => {
    const s = withQueued(base, 'w-land', 'fossil-fuel-plant')
    const p = s.factions[US].projects[0]
    expect(p.level).toBe(4)
    expect(p.cost).toBeCloseTo(buildingCost('fossil-fuel-plant', 4))
  })

  it('queues further levels on the same square without using another slot', () => {
    let s = withQueued(base, 'w-land', 'fortification')
    s = withQueued(s, 'w-land', 'fortification')
    expect(s.factions[US].projects).toHaveLength(1)
    expect(s.factions[US].projects[0].queuedLevels).toBe(1)
  })

  it('enforces the Fortification cap and the 4-project limit', () => {
    expect(canQueueBuild(base, 'hive', 'c-land', 'fortification')).toEqual({ ok: false, reason: 'Fortification is capped at level 10.' })
    let s = base
    for (const [region, type] of [
      ['nw-land', 'fortification'],
      ['n-land', 'training-facility'],
      ['w-land', 'fortification'],
      ['w-land', 'training-facility'],
    ] as const) {
      s = withQueued(s, region, type)
    }
    expect(s.factions[US].projects).toHaveLength(MAX_ACTIVE_PROJECTS)
    expect(canQueueBuild(s, US, 'w-land', 'production-facility').ok).toBe(false)
  })

  it('rejects regions the faction does not control', () => {
    expect(canQueueBuild(base, US, 'c-land', 'fortification').ok).toBe(false)
    expect(canQueueBuild(base, US, 'nw-maritime', 'fortification').ok).toBe(false)
  })
})

describe('production pool', () => {
  it('sums controlled regions — US 1,700', () => {
    expect(factionProduction(base, US)).toBe(1700)
    expect(factionProduction(base, 'gamer')).toBe(0)
  })

  it('reroutes Construction when nothing is queued', () => {
    const a = computeAllocation(base, US)
    expect(a.construction).toBe(0)
    expect(a.equipment + a.manpower).toBeGreaterThanOrEqual(1697)
  })
})

describe('construction streaming', () => {
  it('flows 1/168 of the pulse share per tick, split across projects', () => {
    let s = withQueued(base, 'w-land', 'fortification', 'construction')
    s = withQueued(s, 'nw-land', 'fortification')
    s = advanceTick(s).state // tick 1: allocation locked, first drop of progress
    const a = s.factions[US].allocation
    expect(a.construction).toBe(850)
    for (const p of s.factions[US].projects) expect(p.progress).toBeCloseTo(850 / TICKS_PER_PULSE / 2)
  })

  it('completes mid-pulse, fires an interrupt, and prices the queued level fresh', () => {
    let s = produce(withQueued(base, 'w-land', 'training-facility', 'construction'), (d) => {
      queueBuild(d, US, 'w-land', 'training-facility') // queue level 2 behind level 1
      d.factions[US].projects[0].cost = 30 // cheap enough to finish inside a pulse
    })
    let ticks = 0
    while (s.interrupts.length === 0 && ticks < TICKS_PER_PULSE) {
      s = advanceTick(s).state
      ticks++
    }
    expect(s.interrupts).toEqual([{ kind: 'construction-complete', faction: US, regionId: 'w-land', building: 'training-facility', level: 1 }])
    expect(tickInPulse(s.tick)).not.toBe(0)
    expect((s.regions['w-land'] as LandRegion).buildings['training-facility']).toBe(1)
    const p = s.factions[US].projects[0]
    expect(p.level).toBe(2)
    expect(p.queuedLevels).toBe(0)
    expect(p.cost).toBeCloseTo(buildingCost('training-facility', 2))
  })

  it('reroutes a stranded Construction stream to Equipment/Manpower at pulse end', () => {
    const s = produce(withQueued(base, 'w-land', 'training-facility', 'construction'), (d) => {
      d.factions[US].projects[0].cost = 1
    })
    const after = advancePulse(s)
    expect(after.factions[US].projects).toHaveLength(0)
    expect(after.factions[US].constructionLeftover).toBe(0)
    // Nearly the whole 850 construction share ended up converted alongside the 425/425 shares.
    expect(after.factions[US].equipment + after.factions[US].manpower).toBeGreaterThan(1500)
  })
})

describe('pulse-end conversions', () => {
  const after = advancePulse(base)
  const f = after.factions[US]

  it('credits Equipment through the summed Production Facility bonus', () => {
    // Balanced with no projects: 566 + 283 = 849 equipment points × facilityMultiplier(7) = 2.4.
    expect(f.equipment).toBeGreaterThan(1900)
    expect(f.equipment).toBeLessThan(2100)
  })

  it('credits Manpower under the 2% cap and draws it from Population', () => {
    expect(f.manpower).toBeGreaterThan(0)
    expect(f.manpower).toBeLessThanOrEqual(manpowerCap(after, US))
    const popBefore = ['nw-land', 'n-land', 'w-land'].reduce((s, id) => s + (base.regions[id] as LandRegion).population, 0)
    const popAfter = ['nw-land', 'n-land', 'w-land'].reduce((s, id) => s + (after.regions[id] as LandRegion).population, 0)
    // Growth adds ~5,769; training removes f.manpower; immigration adds a little from SW Land.
    expect(popAfter).toBeLessThan(popBefore + 5769 + 30_000 - f.manpower + 1)
  })

  it('gives zero-Control factions nothing', () => {
    expect(after.factions.gamer.equipment).toBe(0)
    expect(after.factions.gamer.manpower).toBe(0)
  })
})
