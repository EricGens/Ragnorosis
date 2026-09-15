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

describe('Vehicle (§3.2)', () => {
  it("names and prices the skeleton's worked builds", () => {
    // Air-defense build: Autocannon + Diesel, Crew-Served AA + Targeting Computer + Radar.
    const ad = ['veh-autocannon-1', 'veh-diesel-1', 'veh-cs-aa', 'veh-targeting-1', 'veh-radar-1']
    expect(autoName('vehicle', ad)).toBe('Recon Vehicle (SHORAD/AFCS/Radar)')
    expect(designStats('vehicle', ad).vector.map((e) => e.short)).toEqual([10, 10, 5, 18])
    expect(designStats('vehicle', ad).radar).toBe(1)
    expect(autoName('vehicle', ['veh-csw-1', 'veh-diesel-1', 'veh-reactive-armor'])).toBe('Light APC')
    expect(autoName('vehicle', ['veh-autocannon-1', 'veh-diesel-1', 'veh-cs-at', 'veh-targeting-1'])).toBe(
      'Recon Vehicle (AT/AFCS)',
    )
    expect(autoName('vehicle', ['veh-autocannon-1', 'veh-diesel-1', 'veh-reactive-armor'])).toBe('APC')
  })

  it('costs 100 for a base build and trades speed for Reactive Armor', () => {
    const base = designStats('vehicle', ['veh-csw-1', 'veh-diesel-1'])
    expect(base).toMatchObject({
      cost: 100,
      supply: 3.5,
      organization: 10,
      health: 15,
      manpower: 20,
      weight: 5,
      armor: 0,
    })
    expect(base.speed).toEqual({ combat: 10, transit: 30 })
    const apc = designStats('vehicle', ['veh-csw-1', 'veh-diesel-1', 'veh-reactive-armor'])
    expect(apc.armor).toBe(5)
    expect(apc.speed).toEqual({ combat: 8, transit: 25 })
    expect(designProblems('vehicle', ['veh-csw-1'])).toEqual(['Vehicle requires 1 engine module'])
  })
})

describe('Artillery (§3.3)', () => {
  it('is towed at 5(30), self-propelled at 10(30), and reads long-range values in X(Y) form', () => {
    expect(autoName('artillery', ['art-tube'])).toBe('Towed Artillery')
    expect(autoName('artillery', ['art-tube', 'art-diesel-1'])).toBe('Self-Propelled Gun')
    expect(autoName('artillery', ['art-rocket'])).toBe('MLRS')
    expect(autoName('artillery', ['art-rocket', 'art-diesel-1', 'art-targeting-1'])).toBe(
      'Transporter Erector Launcher (TEL/AFCS)',
    )
    const towed = designStats('artillery', ['art-tube'])
    expect(towed).toMatchObject({ cost: 100, organization: 5, health: 15, manpower: 15, standoffCapable: true })
    expect(towed.speed).toEqual({ combat: 5, transit: 30 })
    expect(designStats('artillery', ['art-tube', 'art-diesel-1']).speed).toEqual({ combat: 10, transit: 30 })
    const mlrs = designStats('artillery', ['art-rocket'])
    expect(mlrs.vector).toEqual([
      { short: 5, long: 10 },
      { short: 5, long: 10 },
      { short: 3, long: 8 },
      { short: 0, long: null },
    ])
    expect(mlrs.piercing).toBe(8)
    expect(mlrs.damage).toBe(15)
  })
})

describe('Tank (§3.4)', () => {
  it('a Main Battle Tank is 200 Production with Armor 5, and Gas Turbine is the first real speed bonus', () => {
    const mbt = designStats('tank', ['tank-cannon-1', 'tank-diesel-1'])
    expect(autoName('tank', ['tank-cannon-1', 'tank-diesel-1'])).toBe('Main Battle Tank')
    expect(mbt).toMatchObject({ cost: 200, armor: 5, health: 25, manpower: 16, weight: 10, piercing: 10, damage: 15 })
    expect(mbt.vector.map((e) => e.short)).toEqual([10, 10, 8, 0])
    expect(mbt.speed).toEqual({ combat: 8, transit: 30 })
    expect(designStats('tank', ['tank-autocannon-1', 'tank-turbine-1']).speed).toEqual({ combat: 10, transit: 30 })
    expect(autoName('tank', ['tank-autocannon-1', 'tank-turbine-1', 'tank-cs-aa', 'tank-targeting-1'])).toBe(
      'Infantry Fighting Vehicle (SHORAD/AFCS)',
    )
    expect(autoName('tank', ['tank-cannon-1', 'tank-diesel-1', 'tank-reactive-armor'])).toBe('Main Battle Tank (AOA)')
    // Tank's Targeting Computer carries 0 Anti-Air, unlike Vehicle's +5 — a deliberate lever.
    expect(moduleDef('tank', 'tank-targeting-1').vector[3].short).toBe(0)
    expect(moduleDef('vehicle', 'veh-targeting-1').vector[3].short).toBe(5)
  })
})

describe('Light Aircraft (§3.5)', () => {
  it('allows 1–3 weapons with duplicates, names by weapon category, and only AGM has standoff reach', () => {
    const cas = ['la-pgm', 'la-turbofan']
    expect(autoName('light-aircraft', cas)).toBe('CAS Aircraft')
    expect(designStats('light-aircraft', cas)).toMatchObject({ cost: 200, manpower: 5, health: 20, armor: 0 })
    expect(designProblems('light-aircraft', ['la-pgm', 'la-pgm', 'la-autocannon', 'la-turbofan'])).toEqual([])
    expect(designProblems('light-aircraft', ['la-pgm', 'la-pgm', 'la-pgm', 'la-pgm', 'la-turbofan'])).toEqual([
      'Light Aircraft allows at most 3 weapon modules',
    ])
    expect(designStats('light-aircraft', ['la-pgm', 'la-pgm', 'la-turbofan']).damage).toBe(30) // both weapons count
    expect(designStats('light-aircraft', cas).standoffCapable).toBe(false)
    expect(designStats('light-aircraft', ['la-agm', 'la-turbofan']).standoffCapable).toBe(true)
    expect(autoName('light-aircraft', ['la-agm', 'la-turbofan', 'la-targeting-pod', 'la-ssr'])).toBe(
      'CAS Aircraft (Targeting Pod/SAR)',
    )
    expect(designStats('light-aircraft', ['la-agm', 'la-turbofan', 'la-ssr']).isr).toBe(1)
  })
})

describe('validation', () => {
  it('requires exactly one Main Weapon and at most two Misc modules', () => {
    expect(designProblems('infantry', [SA])).toEqual([])
    expect(designProblems('infantry', [])).toEqual(['Infantry requires 1 weapon module'])
    expect(designProblems('infantry', [SA, AT, AA, AT])).toContain('Man-portable AT can only be equipped once')
  })

  it('rejects modules outside the platform catalog', () => {
    expect(designProblems('infantry', [SA, 'veh-reactive-armor'])).toContain(
      'veh-reactive-armor is not available on Infantry',
    )
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
