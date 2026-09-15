import { describe, expect, it } from 'vitest'
import type { UnitDesign } from '../types'
import { autoName, designProblems, designStats, findDuplicate, sameModules } from './design'
import { INFANTRY, moduleDef } from './platforms'

const SA = 'inf-small-arms-1'
const AT = 'inf-man-at'
const AA = 'inf-man-aa'

describe('Infantry equipment types (skeleton §3.1 table)', () => {
  const cases: [string, string[], number, number, number[], number][] = [
    // name, modules, cost, supply, vector short values, piercing
    ['Light Infantry', [SA], 50, 1.0, [5, 3, 0, 0], 0],
    ['AT Infantry', [SA, AT], 60, 1.1, [6, 8, 5, 0], 5],
    ['AA Infantry', [SA, AA], 60, 1.1, [5, 3, 0, 5], 0],
    ['Heavy Infantry', [SA, AT, AA], 70, 1.2, [6, 8, 5, 5], 5],
  ]

  for (const [name, modules, cost, supply, vector, piercing] of cases) {
    it(`${name}: ${cost} Production, ${supply} Supply, ${vector.join('/')}, Piercing ${piercing}`, () => {
      const s = designStats('infantry', modules)
      expect(autoName('infantry', modules)).toBe(name)
      expect(s.cost).toBe(cost)
      expect(s.supply).toBeCloseTo(supply)
      expect(s.vector.map((e) => e.short)).toEqual(vector)
      expect(s.piercing).toBe(piercing)
      expect(s.weight).toBe(1)
      expect(s.damage).toBe(5)
      expect(s.armor).toBe(0)
      expect(s.organization).toBe(25)
      expect(s.health).toBe(10)
      expect(s.manpower).toBe(50)
      expect(s.speed).toEqual({ combat: 5, transit: 30 })
      expect(s.standoffCapable).toBe(false)
    })
  }

  it('takes damage only from the Main Weapon', () => {
    expect(moduleDef('infantry', AT).damage).toBe(0)
    expect(designStats('infantry', [SA, AT, AA]).damage).toBe(designStats('infantry', [SA]).damage)
  })
})

describe('validation', () => {
  it('requires exactly one Main Weapon and at most two Misc modules', () => {
    expect(designProblems('infantry', [SA])).toEqual([])
    expect(designProblems('infantry', [])).toEqual(['Infantry requires 1 weapon module'])
    expect(designProblems('infantry', [SA, AT, AA, AT])).toContain('Man-portable AT can only be equipped once')
  })

  it('rejects modules outside the platform catalog', () => {
    expect(designProblems('infantry', [SA, 'veh-reactive-armor'])).toContain('veh-reactive-armor is not available on Infantry')
    expect(INFANTRY.modules.map((m) => m.id)).toEqual([SA, AT, AA])
  })
})

describe('duplicate detection', () => {
  const roster: UnitDesign[] = [{ id: 1, name: 'Heavy Infantry', platform: 'infantry', modules: [SA, AT, AA] }]

  it('is multiset-based, not slot-order-based', () => {
    expect(sameModules([SA, AT, AA], [AA, SA, AT])).toBe(true)
    expect(sameModules([SA, AT], [SA, AT, AT])).toBe(false)
    expect(findDuplicate(roster, 'infantry', [AA, AT, SA])?.id).toBe(1)
    expect(findDuplicate(roster, 'infantry', [SA, AT])).toBeUndefined()
  })

  it('ignores the design being edited', () => {
    expect(findDuplicate(roster, 'infantry', [SA, AT, AA], 1)).toBeUndefined()
  })
})
