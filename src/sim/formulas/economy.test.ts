import { describe, expect, it } from 'vitest'
import { DUMMY_MAP } from '../data/dummyMap'
import { createInitialState } from '../state'
import type { LandRegion } from '../types'
import {
  legitimacyPerPulse,
  moneyPerPulse,
  perCapitaGdp,
  popularityCut,
  populationGrowthPerPulse,
  researchPerTick,
} from './economy'

const state = createInitialState(DUMMY_MAP)
const region = (id: string) => state.regions[id] as LandRegion

describe('popularity cut', () => {
  it('is 0 at or below 50% and 0.7 at 100%', () => {
    expect(popularityCut(0)).toBe(0)
    expect(popularityCut(50)).toBe(0)
    expect(popularityCut(75)).toBeCloseTo(0.35)
    expect(popularityCut(100)).toBeCloseTo(0.7)
  })
})

describe('money per pulse', () => {
  it('is weekly GDP × Stability × popularity cut', () => {
    // S Land: $500B, Stability 50, China at 75% → 500B/52 × 0.5 × 0.35
    expect(moneyPerPulse(region('s-land'))).toBeCloseTo((500e9 / 52) * 0.5 * 0.35)
  })

  it('is 0 for Unaffiliated regions', () => {
    expect(moneyPerPulse(region('ne-land'))).toBe(0)
  })
})

describe('research per tick', () => {
  it('is GDP/1B × Stability/100 — 250 for a default region', () => {
    expect(researchPerTick(region('s-land'))).toBe(250)
  })
})

describe('legitimacy per pulse', () => {
  it('reproduces the worked example: 10%/10M + 50%/20M = 11', () => {
    const a = { ...region('s-land'), popularity: { ...region('s-land').popularity, gamer: 10 }, population: 10e6 }
    const b = { ...region('s-land'), popularity: { ...region('s-land').popularity, gamer: 50 }, population: 20e6 }
    expect(legitimacyPerPulse([a, b], 'gamer')).toBeCloseTo(11)
  })

  it('counts regions regardless of Control', () => {
    // NE Land is Unaffiliated but every faction has 75% there.
    expect(legitimacyPerPulse([region('ne-land')], 'widows')).toBeCloseTo(7.5)
  })
})

describe('population growth', () => {
  it('is 1% annual, applied weekly', () => {
    expect(populationGrowthPerPulse(10_000_000)).toBeCloseTo((10_000_000 * 0.01) / 52)
  })
})

describe('per-capita GDP', () => {
  it('is computed from GDP and Population', () => {
    expect(perCapitaGdp(region('sw-land'))).toBe(1000)
    expect(perCapitaGdp(region('se-land'))).toBe(200_000)
  })
})
