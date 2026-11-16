import { describe, expect, it } from 'vitest'
import { advancePulse } from '../advance'
import { MANPOWER_PER_PRODUCTION, manpowerPerPoint } from '../formulas/conversion'
import { manpowerCap } from '../formulas/manpower'
import { newGame, US } from '../testing'
import { computeAllocation } from './productionSteps'

describe('Manpower training (decisions doc: 5 people per Production point)', () => {
  it('trains 5 per point, times the Training Facility bonus — the US, with two levels, gets 7', () => {
    const s = newGame()
    expect(MANPOWER_PER_PRODUCTION).toBe(5)
    expect(manpowerPerPoint(s, US)).toBeCloseTo(5 * 1.4) // NW Land has Training Facility level 2: +20% each
    expect(manpowerPerPoint(s, 'mankind-united')).toBeCloseTo(5 * 2) // SW Land has level 5
    expect(manpowerPerPoint(s, 'hive')).toBe(5) // none
  })

  it('turns one pulse of Manpower-focused Production into that many people', () => {
    const s = newGame((d) => void (d.factions[US].focus = 'manpower'))
    const points = computeAllocation(s, US).manpower
    expect(points).toBeGreaterThan(0)
    const after = advancePulse(s)
    expect(after.factions[US].manpower).toBe(Math.floor(points * 7))
  })

  it('stops allocating once the points already cover the room under the cap', () => {
    // 70 people of room at 7 per point is 10 points; anything more would train people the pool can't hold.
    const s = newGame((d) => {
      d.factions[US].focus = 'manpower'
      d.factions[US].manpower = manpowerCap(d, US) - 70
    })
    expect(computeAllocation(s, US).manpower).toBe(10)
    expect(advancePulse(s).factions[US].manpower).toBe(manpowerCap(s, US))
  })
})
