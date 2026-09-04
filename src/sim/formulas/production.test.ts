import { describe, expect, it } from 'vitest'
import { DUMMY_MAP } from '../data/dummyMap'
import { createInitialState } from '../state'
import type { LandRegion } from '../types'
import { fossilEnergyDemand, regionProduction, regionSupply } from './production'

const state = createInitialState(DUMMY_MAP)
const region = (id: string) => state.regions[id] as LandRegion

describe('region production', () => {
  it('sums population and plant contributions — default region with L3 Fossil + L1 Renewable = 500', () => {
    const p = regionProduction(region('w-land'))
    expect(p).toEqual({ population: 100, fossil: 300, renewable: 100, total: 500 })
  })

  it('gives 540 from population alone at 54M', () => {
    const p = regionProduction({ ...region('s-land'), population: 54_000_000, buildings: {} })
    expect(p.total).toBe(540)
  })

  it('curtails Fossil output 1:1 with Energy shortfall', () => {
    expect(regionProduction(region('w-land'), 0.9).fossil).toBeCloseTo(270)
  })

  it('halves Renewable output while Weather is active', () => {
    expect(regionProduction(region('c-land'), 1, true).renewable).toBe(250)
    expect(regionProduction(region('c-land'), 1, false).renewable).toBe(500)
  })

  it('demands 100 Energy per Fossil level', () => {
    expect(fossilEnergyDemand(region('c-land'))).toBe(400)
    expect(fossilEnergyDemand({ ...region('c-land'), buildings: {} })).toBe(0)
  })

  it('derives Supply 1:1 from Production', () => {
    expect(regionSupply(500)).toBe(500)
  })
})
