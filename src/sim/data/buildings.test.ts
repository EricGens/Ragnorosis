import { describe, expect, it } from 'vitest'
import { BUILDINGS, buildingCost } from './buildings'

describe('escalating stack cost', () => {
  it('follows the 1x / 1.05x / 1.1025x / 1.157625x schedule', () => {
    expect(buildingCost('fossil-fuel-plant', 1)).toBe(1000)
    expect(buildingCost('fossil-fuel-plant', 2)).toBeCloseTo(1050)
    expect(buildingCost('fossil-fuel-plant', 3)).toBeCloseTo(1102.5)
    expect(buildingCost('fossil-fuel-plant', 4)).toBeCloseTo(1157.625)
  })

  it('caps only Fortification', () => {
    expect(BUILDINGS.fortification.maxLevel).toBe(10)
    for (const def of Object.values(BUILDINGS)) {
      if (def.id !== 'fortification') expect(def.maxLevel, def.id).toBeUndefined()
    }
  })
})
