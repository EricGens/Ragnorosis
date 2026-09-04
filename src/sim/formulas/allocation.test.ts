import { describe, expect, it } from 'vitest'
import { allocateProduction } from './allocation'

const open = { manpowerCapRoom: 1e9, hasProjects: true }

describe('focus split', () => {
  it('splits balanced roughly evenly, flooring and discarding fractions', () => {
    const a = allocateProduction(1000, 'balanced', open)
    expect([a.equipment, a.manpower, a.construction]).toEqual([333, 333, 333])
    expect(a.warning).toBe(false)
  })

  it('gives a chosen focus 50% and the others 25% each', () => {
    const a = allocateProduction(1000, 'construction', open)
    expect([a.equipment, a.manpower, a.construction]).toEqual([250, 250, 500])
    expect(allocateProduction(1000, 'equipment', open).equipment).toBe(500)
    expect(allocateProduction(1000, 'manpower', open).manpower).toBe(500)
  })
})

describe('overflow', () => {
  it('reroutes an empty Construction share proportionally to the others', () => {
    // Equipment focus: 500/250/250 → construction's 250 splits 2:1 between equipment and manpower.
    const a = allocateProduction(1000, 'equipment', { ...open, hasProjects: false })
    expect(a.construction).toBe(0)
    expect(a.equipment).toBe(500 + 166)
    expect(a.manpower).toBe(250 + 83)
  })

  it('clamps Manpower to its cap room and reroutes the excess', () => {
    const a = allocateProduction(1000, 'manpower', { ...open, manpowerCapRoom: 100 })
    expect(a.manpower).toBe(100)
    // 400 excess split between equipment (250) and construction (250) evenly.
    expect(a.equipment).toBe(450)
    expect(a.construction).toBe(450)
  })

  it('sends everything to the one remaining category when two are out', () => {
    const a = allocateProduction(1000, 'balanced', { manpowerCapRoom: 0, hasProjects: false })
    expect(a.manpower).toBe(0)
    expect(a.construction).toBe(0)
    expect(a.equipment).toBeGreaterThanOrEqual(998) // 333 + 666, minus floor loss
    expect(a.warning).toBe(false)
  })

  it('re-clamps Manpower after it receives overflow', () => {
    // Construction empty → its 333 would push manpower past a 400 cap; the excess must move on.
    const a = allocateProduction(1000, 'balanced', { manpowerCapRoom: 400, hasProjects: false })
    expect(a.manpower).toBe(400)
    expect(a.construction).toBe(0)
    expect(a.equipment).toBeGreaterThanOrEqual(595)
  })

  it('handles zero Production without dividing by zero', () => {
    const a = allocateProduction(0, 'balanced', open)
    expect(a).toEqual({ total: 0, equipment: 0, manpower: 0, construction: 0, warning: false })
  })
})
