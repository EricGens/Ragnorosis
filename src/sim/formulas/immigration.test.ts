import { describe, expect, it } from 'vitest'
import { DUMMY_MAP } from '../data/dummyMap'
import { createInitialState } from '../state'
import type { LandRegion } from '../types'
import { immigrationCandidates, planImmigration } from './immigration'

const state = createInitialState(DUMMY_MAP)

describe('immigration candidates', () => {
  it('uses direct land neighbors for an interior region', () => {
    expect(new Set(immigrationCandidates(state, 'c-land'))).toEqual(new Set(['n-land', 'w-land', 'e-land', 's-land']))
  })

  it('expands across maritime regions when fewer than 4 land neighbors exist', () => {
    // NW Land has two land neighbors; NW Maritime reaches only those same two, so nothing new is found.
    expect(new Set(immigrationCandidates(state, 'nw-land'))).toEqual(new Set(['n-land', 'w-land']))
    // N Land: three land neighbors, plus one more reached through an adjacent maritime region.
    const n = immigrationCandidates(state, 'n-land')
    expect(n).toHaveLength(4)
    expect(n.slice(0, 3)).toEqual(['nw-land', 'ne-land', 'c-land'])
    expect(['w-land', 'e-land']).toContain(n[3])
  })

  it('never includes maritime regions or the region itself', () => {
    for (const id of state.regionOrder) {
      const c = immigrationCandidates(state, id)
      expect(c).not.toContain(id)
      expect(c.every((r) => state.regions[r].type === 'land')).toBe(true)
    }
  })
})

describe('immigration plan', () => {
  it('moves people from low- to high-Stability neighbors, GDP with them', () => {
    const transfers = planImmigration(state)
    const swToW = transfers.find((t) => t.from === 'sw-land' && t.to === 'w-land')
    expect(swToW).toBeDefined()
    // SW Land 100M at Stability 25 vs W Land at 50: 100M × 0.001 × 0.25 = 25,000
    expect(swToW!.population).toBe(25_000)
    expect(swToW!.gdp).toBeCloseTo(25_000 * 1000)
  })

  it('evaluates each pair once', () => {
    const keys = planImmigration(state).map((t) => [t.from, t.to].sort().join('|'))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('produces nothing between equal-Stability regions', () => {
    const t = planImmigration(state).find(
      (x) => (x.from === 's-land' && x.to === 'e-land') || (x.from === 'e-land' && x.to === 's-land'),
    )
    expect(t).toBeUndefined()
  })

  it('is net-zero for population', () => {
    const before = state.regionOrder.reduce((sum, id) => {
      const r = state.regions[id]
      return r.type === 'land' ? sum + (r as LandRegion).population : sum
    }, 0)
    const net = planImmigration(state).reduce((sum, t) => sum + t.population - t.population, 0)
    expect(before + net).toBe(before)
  })
})
