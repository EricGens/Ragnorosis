import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { advancePulse, advanceTick } from '../advance'
import { DUMMY_MAP } from '../data/dummyMap'
import { setFactionRelation } from '../relations'
import { createInitialState } from '../state'
import type { GameState, LandRegion } from '../types'
import { battleFor, defenderRetreatTarget } from './battle'
import {
  defenseMultiplier,
  destructionChance,
  engagementChances,
  inverseCostWeights,
  maxOrganization,
  organization,
  partisanBonus,
  pierceMultiplier,
  shockMultiplier,
} from './combat'
import { orderMove } from './movement'
import { saveDesign } from './roster'
import { assignSlot, createTaskForce, fillTaskForce, setTarget } from './taskForce'

const US = 'united-states'
const CN = 'china'
const SA = 'inf-small-arms-1'

describe('formulas (§5.1, §5.4, GDD §8.6)', () => {
  it('partitions the roll: 5 vs 10.8 → attacker 5%, defender 10.8%, the rest a push', () => {
    expect(engagementChances(5, 10.8)).toEqual({ attacker: 5, defender: 10.8 })
    expect(engagementChances(10.8, 5)).toEqual({ attacker: 10.8, defender: 5 })
    expect(engagementChances(5, 5)).toEqual({ attacker: 5, defender: 5 })
  })

  it('caps the advantaged side at 50% and excludes a side with no relevant value', () => {
    expect(engagementChances(100, 5)).toEqual({ attacker: 50, defender: 5 })
    // Hard exclusion for the side with nothing relevant; the other side's gap still counts (5 + 5).
    expect(engagementChances(0, 5)).toEqual({ attacker: 0, defender: 10 })
    expect(engagementChances(0, 0)).toEqual({ attacker: 0, defender: 0 })
  })

  it('runs the piercing curve with the Armor-0 guard: 10 dmg vs 5 Armor, 25 Health', () => {
    expect(pierceMultiplier(0, 0)).toBe(1)
    expect(destructionChance(10 * pierceMultiplier(0, 5), 25)).toBeCloseTo(2 / 27, 4) // 7.4%
    expect(destructionChance(10 * pierceMultiplier(10, 5), 25)).toBeCloseTo(8 / 33, 4) // 24.2%
    expect(destructionChance(5, 10)).toBeCloseTo(1 / 3, 4)
    expect(destructionChance(15, 10)).toBeCloseTo(0.6, 4)
    expect(destructionChance(0, 10)).toBe(0)
  })

  it('weights targets by inverse cost: a 50-cost unit is drawn twice as often as a 100-cost one', () => {
    const w = inverseCostWeights([50, 100])
    expect(w[0]).toBeCloseTo(2 / 3)
    expect(w[1]).toBeCloseTo(1 / 3)
  })

  it('gives the invader the partisan bonus below 50% Stability only', () => {
    expect([45, 25, 0, 50, 80].map(partisanBonus)).toEqual([1, 5, 10, 0, 0])
  })

  it('derives Shock from Front Line speed and Defensibility from the region', () => {
    expect(shockMultiplier(5)).toBeCloseTo(1.5)
    expect(shockMultiplier(10)).toBeCloseTo(3)
    const base = createInitialState(DUMMY_MAP)
    expect(defenseMultiplier(base.regions['c-land'] as LandRegion)).toBeCloseTo(1.8) // 30 + 50
    expect(defenseMultiplier(base.regions['w-land'] as LandRegion)).toBeCloseTo(1.1)
  })
})

/** US: `attackers` Light Infantry in W Land, filled. China: `defenders` Light Infantry in C Land (given to China). */
function scenario(defenders: number, attackers = 12): GameState {
  return produce(createInitialState(DUMMY_MAP), (d) => {
    ;(d.regions['c-land'] as LandRegion).controller = CN
    setFactionRelation(d, US, CN, 'hostile')
    for (const f of [US, CN] as const) saveDesign(d, f, { name: 'Light Infantry', platform: 'infantry', modules: [SA] })
    createTaskForce(d, US, 'w-land')
    setTarget(d, 1, 1, attackers)
    for (let i = 0; i < Math.min(12, attackers); i++) assignSlot(d, 1, 'frontLine', i, 1)
    fillTaskForce(d, 1)
    createTaskForce(d, CN, 'c-land')
    setTarget(d, 2, 1, defenders)
    for (let i = 0; i < Math.min(12, defenders); i++) assignSlot(d, 2, 'frontLine', i, 1)
    fillTaskForce(d, 2)
  })
}

const ticks = (s: GameState, n: number) => {
  for (let i = 0; i < n; i++) s = advanceTick(s).state
  return s
}
const us = (s: GameState) => s.taskForces.find((t) => t.id === 1)!
const cn = (s: GameState) => s.taskForces.find((t) => t.id === 2)
/** Units a side still accounts for: on the line, in Reserves, or destroyed. */
const accounted = (side: GameState['battles'][number]['attacker']) =>
  side.frontLine.filter((x) => x !== null).length +
  Object.values(side.reserves).reduce((a, b) => a + b, 0) +
  Object.values(side.unitsLost).reduce((a, b) => a + b, 0)

describe('Organization (GDD §8.6.6)', () => {
  it('sums 25 per filled unit, scaled by Manpower fill, and is full for a fresh force', () => {
    const s = scenario(2)
    expect(maxOrganization(s, us(s))).toBe(300)
    expect(organization(s, us(s))).toBe(300)
    const half = produce(s, (d) => void (d.taskForces[0].composition[0].manpower = 300))
    expect(maxOrganization(half, us(half))).toBe(150)
  })

  it('regenerates 0.5% of max per tick out of contact', () => {
    const s = produce(scenario(2), (d) => void (d.taskForces[0].organizationLost = 100))
    const s1 = ticks(s, 10)
    expect(us(s1).organizationLost).toBeCloseTo(100 - 10 * 1.5)
  })
})

describe('invasion battles (§4.6, §5.1)', () => {
  it('starts on the first tick toward the defender, with Shock for a Ready attacker, and puts it in Planning', () => {
    let s = produce(scenario(2), (d) => void orderMove(d, 1, 'c-land'))
    s = ticks(s, 1)
    const b = battleFor(s, 1)!
    expect(b).toMatchObject({ regionId: 'c-land', startedAt: 1, endedAt: null })
    expect(b.shock).toEqual({ multiplier: 1.5, until: 25 })
    // The first round resolves on the same tick, so count every unit the sides account for.
    expect(accounted(b.attacker)).toBe(12)
    expect(accounted(b.defender)).toBe(2)
    expect(us(s).shock).toBe('planning')
    expect(cn(s)!.shock).toBe('ready') // pure defenders never enter Planning
    expect(b.costs).toEqual({ 'united-states|1': 50, 'china|1': 50 })
  })

  it('gives an unplanned Front Line its Shock from the whole force, never a ×0 that mutes the attack', () => {
    let s = produce(scenario(2), (d) => {
      d.taskForces[0].lines.frontLine = d.taskForces[0].lines.frontLine.map(() => null)
      orderMove(d, 1, 'c-land')
    })
    s = ticks(s, 1)
    expect(battleFor(s, 1)!.shock).toEqual({ multiplier: 1.5, until: 25 })
  })

  it('12 vs 2: the defender breaks, retreats to friendly ground, and the attacker captures on arrival', () => {
    let s = produce(scenario(2), (d) => void orderMove(d, 1, 'c-land'))
    let guard = 0
    while (!s.battles[0]?.endedAt && guard++ < 400) s = ticks(s, 1)
    const b = s.battles[0]
    expect(b.outcome).toBe('attacker-won')
    expect(['e-land', 's-land']).toContain(cn(s)!.regionId) // China's own regions, adjacent to C Land
    expect(organization(s, cn(s)!)).toBe(0)
    expect(b.defender.hits.frontLine + b.attacker.hits.frontLine).toBeGreaterThan(0)
    // Transit clock: 300 mi at Combat Speed is 60 ticks; capture lands once both clocks are done.
    while (us(s).regionId !== 'c-land' && guard++ < 600) s = ticks(s, 1)
    const c = s.regions['c-land'] as LandRegion
    expect(c.controller).toBe(US)
    expect(us(s).consolidating).toBe(true)
    produce(s, (d) => {
      expect(orderMove(d, 1, 'w-land')).toMatchObject({ ok: false, reason: expect.stringContaining('Consolidating') })
    })
  })

  it('surrounded with nowhere to go, the defender surrenders and the victor seizes 25% of its Equipment', () => {
    // C Land's neighbours: N and W (US), E and S (China). Make the defender a Hive unit whose own
    // faction is hostile to everyone around it: no retreat → surrender. 36 attackers so it does break.
    let s = produce(scenario(12, 36), (d) => {
      const tf = d.taskForces[1]
      setFactionRelation(d, US, 'hive', 'hostile')
      setFactionRelation(d, CN, 'hive', 'hostile')
      d.factions.hive.designs = [{ id: 1, name: 'Light Infantry', platform: 'infantry', modules: [SA] }]
      d.factions.hive.nextDesignId = 2
      tf.faction = 'hive'
      orderMove(d, 1, 'c-land')
    })
    expect(defenderRetreatTarget(s, s.taskForces[1])).toBeNull()
    let guard = 0
    while (!s.battles[0]?.endedAt && guard++ < 400) s = ticks(s, 1)
    expect(s.battles[0].outcome).toBe('defender-surrendered')
    expect(s.taskForces.find((t) => t.id === 2)).toBeUndefined()
    // 25% of whatever survived to the surrender, matched into the US roster by module multiset.
    const survived = 12 - Object.values(s.battles[0].defender.unitsLost).reduce((a, b) => a + b, 0)
    expect(survived).toBeGreaterThanOrEqual(4)
    expect(s.factions[US].stockpile[1]).toBe(Math.floor(survived * 0.25))
  })

  it('2 vs 12 the other way: the attacker breaks and walks its transit progress back', () => {
    let s = produce(scenario(12), (d) => {
      d.taskForces[0].composition[0].target = 2
      d.taskForces[0].composition[0].equipment = 2
      d.taskForces[0].composition[0].manpower = 100
      orderMove(d, 1, 'c-land')
    })
    let guard = 0
    while (!s.battles[0]?.endedAt && guard++ < 400) s = ticks(s, 1)
    expect(s.battles[0].outcome).toBe('defender-won')
    expect(us(s).movement?.legs).toEqual([])
    expect(us(s).movement?.backtrack).toBeGreaterThan(0)
    expect((s.regions['c-land'] as LandRegion).controller).toBe(CN)
  })

  it('a plain redirect mid-fight is a voluntary withdrawal', () => {
    let s = produce(scenario(12), (d) => void orderMove(d, 1, 'c-land'))
    s = ticks(s, 3)
    s = produce(s, (d) => void orderMove(d, 1, 'nw-land'))
    s = ticks(s, 1)
    expect(s.battles[0].outcome).toBe('attacker-withdrew')
    expect(us(s).movement?.backtrack).toBe(10) // 15 mi of transit owed back, 5 already walked this tick
  })

  it('Planning clears after a full pulse with no invasion combat', () => {
    let s = produce(scenario(12), (d) => void orderMove(d, 1, 'c-land'))
    s = ticks(s, 2)
    s = produce(s, (d) => void orderMove(d, 1, 'w-land')) // break off
    s = advancePulse(s) // the pulse containing the fight doesn't count
    expect(us(s).shock).toBe('planning')
    s = advancePulse(s)
    expect(us(s).shock).toBe('ready')
  })
})
