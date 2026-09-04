import { describe, expect, it } from 'vitest'
import { BUILDINGS, buildingCost } from './buildings'

describe('escalating stack cost', () => {
  it('follows the 1x / 1.05x / 1.1025x / 1.157625x schedule', () => {
    expect(buildingCost('fossil-fuel-plant', 1)).toBe(5000)
    expect(buildingCost('fossil-fuel-plant', 2)).toBeCloseTo(5250)
    expect(buildingCost('fossil-fuel-plant', 3)).toBeCloseTo(5512.5)
    expect(buildingCost('fossil-fuel-plant', 4)).toBeCloseTo(5788.125)
  })

  it('caps only Fortification', () => {
    expect(BUILDINGS.fortification.maxLevel).toBe(10)
    for (const def of Object.values(BUILDINGS)) {
      if (def.id !== 'fortification') expect(def.maxLevel, def.id).toBeUndefined()
    }
  })
})
