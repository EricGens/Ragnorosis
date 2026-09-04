import { describe, expect, it } from 'vitest'
import { DUMMY_MAP } from '../data/dummyMap'
import { createInitialState } from '../state'
import type { LandRegion } from '../types'
import { driftStability, gdpStabilityInput, stabilityAnchor } from './stability'

const state = createInitialState(DUMMY_MAP)
const region = (id: string) => state.regions[id] as LandRegion

describe('per-capita GDP anchor input', () => {
  it('is 10 at or below $1,000 and 90 at or above $200,000', () => {
    expect(gdpStabilityInput(500)).toBe(10)
    expect(gdpStabilityInput(1000)).toBe(10)
    expect(gdpStabilityInput(200_000)).toBe(90)
    expect(gdpStabilityInput(1_000_000)).toBe(90)
  })

  it('hits the midpoint (50) at exactly $100,500', () => {
    expect(gdpStabilityInput(100_500)).toBeCloseTo(50)
  })
})

describe('stability anchor', () => {
  it('is mean(Popularity, GDP input) for controlled regions — SW Land 42.5, SE Land 82.5', () => {
    expect(stabilityAnchor(region('sw-land'))).toBeCloseTo(42.5)
    expect(stabilityAnchor(region('se-land'))).toBeCloseTo(82.5)
  })

  it('skips the Popularity input for Unaffiliated regions', () => {
    const ne = region('ne-land')
    expect(stabilityAnchor(ne)).toBeCloseTo(gdpStabilityInput(50_000))
  })
})

describe('stability drift', () => {
  it('moves 10% of the delta: 60 toward 50 → 59', () => {
    expect(driftStability(60, 50)).toBeCloseTo(59)
  })

  it('has a 0.1 floor: 39 toward 40 → 39.1', () => {
    expect(driftStability(39, 40)).toBeCloseTo(39.1)
  })

  it('never overshoots a small delta', () => {
    expect(driftStability(50, 50.05)).toBeCloseTo(50.05)
    expect(driftStability(50.05, 50)).toBeCloseTo(50)
  })

  it('is stationary at the anchor', () => {
    expect(driftStability(42.5, 42.5)).toBe(42.5)
  })
})
