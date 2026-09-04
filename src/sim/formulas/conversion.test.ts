import { describe, expect, it } from 'vitest'
import { DUMMY_MAP } from '../data/dummyMap'
import { createInitialState } from '../state'
import { convertWithRemainder, facilityMultiplier, factionFacilityMultiplier } from './conversion'

describe('facility multiplier', () => {
  it('is linear: L5 Training Facility → 2.0, L1 Production Facility → 1.2', () => {
    expect(facilityMultiplier(5)).toBeCloseTo(2.0)
    expect(facilityMultiplier(1)).toBeCloseTo(1.2)
    expect(facilityMultiplier(0)).toBe(1)
  })

  it('weights each region by its share of the faction pool', () => {
    // US: NW Land 600 (PF L2 → 1.4), N Land 600 (PF L5 → 2.0), W Land 500 (none → 1.0)
    const state = createInitialState(DUMMY_MAP)
    const expected = (600 * 1.4 + 600 * 2.0 + 500 * 1.0) / 1700
    expect(factionFacilityMultiplier(state, 'united-states', 'production-facility')).toBeCloseTo(expected)
    // No controlled regions → neutral multiplier.
    expect(factionFacilityMultiplier(state, 'gamer', 'training-facility')).toBe(1)
  })
})

describe('convert with remainder', () => {
  it('floors and banks the fraction', () => {
    const first = convertWithRemainder(10, 1.25, 0) // 12.5
    expect(first).toEqual({ units: 12, remainder: 0.5 })
    const second = convertWithRemainder(10, 1.25, first.remainder) // 13.0
    expect(second.units).toBe(13)
    expect(second.remainder).toBeCloseTo(0)
  })
})
