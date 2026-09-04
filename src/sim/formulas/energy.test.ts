import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { DUMMY_MAP } from '../data/dummyMap'
import { createInitialState } from '../state'
import type { GameState, LandRegion } from '../types'
import { allocateEnergy, sourcePreferences } from './energy'

const base = createInitialState(DUMMY_MAP)
const land = (s: GameState, id: string) => s.regions[id] as LandRegion

/** Cut the Hive off from every neighbor of C Land by zeroing its Air Superiority there. */
function blockadeCLand(s: GameState): GameState {
  return produce(s, (d) => {
    for (const id of ['n-land', 'w-land', 'e-land', 's-land']) d.regions[id].superiority.hive.air = 0
  })
}

describe('source preferences', () => {
  it('prefers own region, then same-country, then others by distance', () => {
    // W Land (US): own reserve 100, then NW/N Land (US), then others.
    const prefs = sourcePreferences(base, land(base, 'w-land'))
    expect(prefs[0]).toBe('w-land')
    expect(prefs.slice(1, 3).sort()).toEqual(['n-land', 'nw-land'])
    expect(prefs).toContain('sw-maritime')
  })

  it('excludes regions without any reserve', () => {
    expect(sourcePreferences(base, land(base, 'c-land'))).not.toContain('nw-maritime')
  })

  it('only reaches regions along passable paths', () => {
    const blockaded = blockadeCLand(base)
    expect(sourcePreferences(blockaded, land(blockaded, 'c-land'))).toEqual(['c-land'])
  })
})

describe('energy allocation — fair share', () => {
  it('has 110 headroom on the dummy map, so everyone is fully served', () => {
    const a = allocateEnergy(base)
    expect(a.totalSupply).toBe(3210)
    expect(a.totalDemand).toBe(3100)
    expect(a.fairShare).toBe(1)
    for (const r of Object.values(a.results)) expect(r.fulfillment).toBeCloseTo(1)
  })

  it('gives every consumer the same share of its own demand under global shortage', () => {
    // Two more Fossil levels tip the map into shortage (3300 demand vs 3210 supply).
    const short = produce(base, (d) => {
      land(d, 's-land').buildings['fossil-fuel-plant'] = 5
    })
    const a = allocateEnergy(short)
    expect(a.fairShare).toBeCloseTo(3210 / 3300)
    for (const r of Object.values(a.results)) expect(r.fulfillment).toBeCloseTo(a.fairShare)
  })

  it('never delivers more than the entitlement', () => {
    for (const r of Object.values(allocateEnergy(base).results)) {
      expect(r.delivered).toBeLessThanOrEqual(r.entitlement + 1e-9)
    }
  })

  it('never delivers more in total than the map supplies', () => {
    const a = allocateEnergy(base)
    const totalDelivered = Object.values(a.results).reduce((s, r) => s + r.delivered, 0)
    expect(totalDelivered).toBeLessThanOrEqual(a.totalSupply + 1e-9)
  })

  it('serves Unaffiliated regions', () => {
    expect(allocateEnergy(base).results['ne-land'].fulfillment).toBeCloseTo(1)
  })
})

describe('energy allocation — blockade', () => {
  it('drops a cut-off region to its local reserve even with no global shortage', () => {
    const a = allocateEnergy(blockadeCLand(base))
    const c = a.results['c-land']
    expect(a.fairShare).toBe(1)
    expect(c.entitlement).toBe(400)
    expect(c.delivered).toBeCloseTo(10)
    expect(c.fulfillment).toBeCloseTo(0.025)
    expect(c.sources).toEqual(['c-land'])
  })

  it('does not affect other consumers', () => {
    const a = allocateEnergy(blockadeCLand(base))
    for (const [id, r] of Object.entries(a.results)) {
      if (id !== 'c-land') expect(r.fulfillment, id).toBeCloseTo(1)
    }
  })

  it('cannot lift a region above the fair-share baseline', () => {
    const short = produce(blockadeCLand(base), (d) => {
      land(d, 's-land').buildings['fossil-fuel-plant'] = 5
    })
    const a = allocateEnergy(short)
    for (const r of Object.values(a.results)) expect(r.fulfillment).toBeLessThanOrEqual(a.fairShare + 1e-9)
  })
})

describe('pulse snapshot', () => {
  it('is taken at game start and curtails Fossil production accordingly', () => {
    expect(base.pulse.fairShare).toBe(1)
    expect(base.pulse.energy['c-land'].fulfillment).toBeCloseTo(1)
    expect(base.pulse.weather['c-land']).toBe(false)
  })
})
