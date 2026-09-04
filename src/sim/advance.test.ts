import { describe, expect, it } from 'vitest'
import { advancePulse, advanceTick } from './advance'
import { TICKS_PER_PULSE } from './clock'
import { DUMMY_MAP } from './data/dummyMap'
import { moneyPerPulse, researchPerTick } from './formulas/economy'
import { createInitialState } from './state'
import type { LandRegion } from './types'

describe('advanceTick', () => {
  it('advances exactly one tick and reports pulse completion only at the boundary', () => {
    let s = createInitialState(DUMMY_MAP)
    for (let i = 1; i < TICKS_PER_PULSE; i++) {
      const r = advanceTick(s)
      s = r.state
      expect(s.tick).toBe(i)
      expect(r.pulseCompleted).toBe(false)
    }
    const r = advanceTick(s)
    expect(r.state.tick).toBe(TICKS_PER_PULSE)
    expect(r.pulseCompleted).toBe(true)
  })

  it('does not mutate the previous state', () => {
    const s0 = createInitialState(DUMMY_MAP)
    const s1 = advanceTick(s0).state
    expect(s0.tick).toBe(0)
    expect(s1).not.toBe(s0)
  })

  it('credits Research to the controller every tick', () => {
    const s0 = createInitialState(DUMMY_MAP)
    const s1 = advanceTick(s0).state
    const expected = ['e-land', 's-land', 'se-land']
      .map((id) => researchPerTick(s0.regions[id] as LandRegion))
      .reduce((a, b) => a + b, 0)
    expect(s1.factions.china.research).toBeCloseTo(expected)
    expect(s1.factions.gamer.research).toBe(0)
  })
})

describe('advancePulse', () => {
  const s0 = createInitialState(DUMMY_MAP)
  const s1 = advancePulse(s0)

  it('lands on the next pulse boundary', () => {
    expect(s1.tick).toBe(TICKS_PER_PULSE)
  })

  it('credits Money once per pulse to controllers', () => {
    const expected = ['nw-land', 'n-land', 'w-land']
      .map((id) => moneyPerPulse(s0.regions[id] as LandRegion))
      .reduce((a, b) => a + b, 0)
    expect(s1.factions['united-states'].money).toBeCloseTo(expected, -3)
  })

  it('gives zero-Control factions Legitimacy income only', () => {
    const gamer = s1.factions.gamer
    expect(gamer.money).toBe(0)
    expect(gamer.research).toBe(0)
    expect(gamer.legitimacy).toBeGreaterThan(0)
  })

  it('grows population and holds per-capita GDP steady', () => {
    const before = s0.regions['s-land'] as LandRegion
    const after = s1.regions['s-land'] as LandRegion
    expect(after.population).toBeGreaterThan(before.population)
    // S Land has equal-Stability neighbors on most sides but does receive immigration from SW Land,
    // so check per-capita on a region with no immigration partners: E Land vs its C/NE/SE neighbors
    // all differ — use the aggregate instead.
    const totalPop = (s: typeof s0) =>
      s.regionOrder.reduce((sum, id) => (s.regions[id].type === 'land' ? sum + (s.regions[id] as LandRegion).population : sum), 0)
    const totalGdp = (s: typeof s0) =>
      s.regionOrder.reduce((sum, id) => (s.regions[id].type === 'land' ? sum + (s.regions[id] as LandRegion).gdp : sum), 0)
    expect(totalGdp(s1) / totalPop(s1)).toBeCloseTo(totalGdp(s0) / totalPop(s0), 0)
  })

  it('drifts Stability toward the anchor', () => {
    const sw = s1.regions['sw-land'] as LandRegion
    const se = s1.regions['se-land'] as LandRegion
    expect(sw.stability).toBeGreaterThan(25) // anchor 42.5
    expect(se.stability).toBeLessThan(90) // anchor 82.5
  })

  it('writes to the resolution log', () => {
    expect(s1.log.some((e) => e.category === 'time')).toBe(true)
    expect(s1.log.some((e) => e.category === 'stability')).toBe(true)
    expect(s1.log.some((e) => e.category === 'economy')).toBe(true)
  })
})
