import { describe, expect, it } from 'vitest'
import { defensibility } from '../formulas/defensibility'
import { createInitialState } from '../state'
import type { LandRegion, RegionId } from '../types'
import { isLand } from '../types'
import { DUMMY_MAP } from './dummyMap'

const state = createInitialState(DUMMY_MAP)
const landRegions = state.regionOrder.map((id) => state.regions[id]).filter(isLand)

/** Skeleton §1.1 — the complete adjacency graph, verbatim. */
const EXPECTED_ADJACENCY: Record<RegionId, RegionId[]> = {
  'nw-land': ['n-land', 'w-land', 'nw-maritime'],
  'n-land': ['nw-land', 'ne-land', 'c-land', 'nw-maritime', 'ne-maritime'],
  'ne-land': ['n-land', 'e-land', 'ne-maritime'],
  'w-land': ['nw-land', 'c-land', 'sw-land', 'nw-maritime', 'sw-maritime'],
  'c-land': ['n-land', 'w-land', 'e-land', 's-land'],
  'e-land': ['ne-land', 'c-land', 'se-land', 'ne-maritime', 'se-maritime'],
  'sw-land': ['w-land', 's-land', 'sw-maritime'],
  's-land': ['sw-land', 'c-land', 'se-land', 'sw-maritime', 'se-maritime'],
  'se-land': ['e-land', 's-land', 'se-maritime'],
  'nw-maritime': ['ne-maritime', 'sw-maritime', 'nw-land', 'n-land', 'w-land'],
  'ne-maritime': ['nw-maritime', 'se-maritime', 'ne-land', 'n-land', 'e-land'],
  'sw-maritime': ['nw-maritime', 'se-maritime', 'sw-land', 'w-land', 's-land'],
  'se-maritime': ['ne-maritime', 'sw-maritime', 'se-land', 'e-land', 's-land'],
}

describe('dummy map topology', () => {
  it('has 9 land and 4 maritime regions', () => {
    expect(state.regionOrder).toHaveLength(13)
    expect(landRegions).toHaveLength(9)
  })

  it('matches the specified adjacency graph exactly', () => {
    for (const [id, expected] of Object.entries(EXPECTED_ADJACENCY)) {
      expect(new Set(state.adjacency[id]), id).toEqual(new Set(expected))
    }
  })

  it('is symmetric', () => {
    for (const [a, neighbors] of Object.entries(state.adjacency)) {
      for (const b of neighbors) expect(state.adjacency[b], `${b} ↔ ${a}`).toContain(a)
    }
  })

  it('leaves C Land landlocked', () => {
    expect(state.adjacency['c-land'].every((id) => isLand(state.regions[id]))).toBe(true)
  })

  it('gives corner land regions one maritime neighbor and edge-middles two', () => {
    const maritimeCount = (id: RegionId) => state.adjacency[id].filter((n) => !isLand(state.regions[n])).length
    for (const id of ['nw-land', 'ne-land', 'sw-land', 'se-land']) expect(maritimeCount(id), id).toBe(1)
    for (const id of ['n-land', 'w-land', 'e-land', 's-land']) expect(maritimeCount(id), id).toBe(2)
  })
})

describe('dummy map starting values', () => {
  const byId = (id: RegionId) => state.regions[id] as LandRegion

  it('applies defaults to an unmodified land region', () => {
    const s = byId('s-land')
    expect(s.population).toBe(10_000_000)
    expect(s.gdp).toBe(500e9)
    expect(s.stability).toBe(50)
    expect(s.energyReserve).toBe(100)
    expect(s.traits).toEqual([])
    expect(Object.values(s.popularity).every((p) => p === 75)).toBe(true)
  })

  it('authors SW Land as the immigration + popularity display test', () => {
    const sw = byId('sw-land')
    expect(sw.population).toBe(100_000_000)
    expect(sw.gdp / sw.population).toBe(1000)
    expect(sw.stability).toBe(25)
    expect(sw.popularity).toEqual({
      'mankind-united': 75,
      'red-queen': 0,
      laserward: 10,
      china: 20,
      hive: 30,
      widows: 40,
      'united-states': 50,
      gamer: 60,
    })
  })

  it('puts SE Land exactly at the per-capita ceiling', () => {
    const se = byId('se-land')
    expect(se.gdp / se.population).toBe(200_000)
    expect(se.stability).toBe(90)
  })

  it('leaves NE Land unaffiliated', () => {
    expect(byId('ne-land').controller).toBeNull()
    expect(byId('ne-land').country).toBe('France')
  })

  it('places offshore Energy only in SW Maritime', () => {
    expect(state.regions['sw-maritime'].energyReserve).toBe(1000)
    for (const id of ['nw-maritime', 'ne-maritime', 'se-maritime']) expect(state.regions[id].energyReserve).toBe(0)
  })

  it('totals 3,210 Energy supply against 3,100 Fossil demand', () => {
    const supply = state.regionOrder.reduce((sum, id) => sum + state.regions[id].energyReserve, 0)
    const demand = landRegions.reduce((sum, r) => sum + (r.buildings['fossil-fuel-plant'] ?? 0) * 100, 0)
    expect(supply).toBe(3210)
    expect(demand).toBe(3100)
  })

  it('reproduces the per-country Energy balance table', () => {
    const net: Record<string, number> = {}
    for (const r of landRegions) {
      net[r.country] = (net[r.country] ?? 0) + r.energyReserve - (r.buildings['fossil-fuel-plant'] ?? 0) * 100
    }
    expect(net).toEqual({ 'United States': 600, China: -700, Taiwan: -390, Mexico: -200, France: -200 })
  })

  it('computes Defensibility from traits and Fortifications', () => {
    expect(defensibility(byId('c-land'))).toBe(80)
    expect(defensibility(byId('n-land'))).toBe(55)
    expect(defensibility(byId('s-land'))).toBe(10)
  })

  it('starts every faction with empty pools and Balanced focus', () => {
    for (const f of Object.values(state.factions)) {
      expect([f.money, f.research, f.legitimacy, f.equipment, f.manpower]).toEqual([0, 0, 0, 0, 0])
      expect(f.focus).toBe('balanced')
    }
  })
})
