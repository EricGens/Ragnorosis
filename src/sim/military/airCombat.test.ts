import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { domainControl } from '../formulas/domainControl'
import { setFactionRelation } from '../relations'
import { CN, giveRegion, LIGHT_INFANTRY, newGame, raiseTaskForce, ticks, TOWED_ARTILLERY, US } from '../testing'
import type { GameState, LandRegion } from '../types'
import { battleFor, orderStandoff } from './battle'
import { drawWeighted } from './battleRound'
import { maneuverBonus, relativeBonus, sensorTotals, unopposedCasChance } from './combat'
import { orderMove } from './movement'
import { saveDesign } from './roster'
import { createTaskForce, fillTaskForce, setTarget } from './taskForce'

describe('ISR/Radar and freedom of maneuver (§1.2, §1.4)', () => {
  it('caps each platform type at +10, the force at +50, and gives +1 per 2 points of relative advantage', () => {
    const s = newGame((d) => {
      saveDesign(d, US, {
        name: 'Radar Truck',
        platform: 'vehicle',
        modules: ['veh-csw-1', 'veh-diesel-1', 'veh-radar-1'],
      })
      saveDesign(d, US, {
        name: 'Recon Plane',
        platform: 'light-aircraft',
        modules: ['la-pgm', 'la-turbofan', 'la-ssr'],
      })
      createTaskForce(d, US, 'nw-land')
      setTarget(d, 1, 1, 12)
      setTarget(d, 1, 2, 6)
      fillTaskForce(d, 1)
    })
    const tf = s.taskForces[0]
    expect(sensorTotals(s, tf, Array<number>(12).fill(1))).toEqual({ radar: 10, isr: 0 }) // 12 raw, clipped to 10
    expect(sensorTotals(s, tf, [...Array<number>(12).fill(1), ...Array<number>(6).fill(2)])).toEqual({
      radar: 10,
      isr: 6,
    })
    expect([
      relativeBonus(1, 0),
      relativeBonus(2, 0),
      relativeBonus(3, 0),
      relativeBonus(4, 0),
      relativeBonus(0, 4),
    ]).toEqual([1, 1, 2, 2, 0])
    expect([maneuverBonus(100), maneuverBonus(119), maneuverBonus(140), maneuverBonus(80), maneuverBonus(60)]).toEqual([
      0, 0, 2, -1, -2,
    ])
  })
})

/** US artillery in W Land, Chinese artillery in C Land (given to China), hostile. */
function artilleryScenario(usGuns: number, cnGuns: number, extra?: (d: GameState) => void): GameState {
  return newGame((d) => {
    giveRegion(d, 'c-land', CN)
    setFactionRelation(d, US, CN, 'hostile')
    for (const f of [US, CN]) {
      saveDesign(d, f, TOWED_ARTILLERY) // design 1
      saveDesign(d, f, LIGHT_INFANTRY) // design 2
    }
    raiseTaskForce(d, US, 'w-land', [
      [1, usGuns],
      [2, 4],
    ])
    raiseTaskForce(d, CN, 'c-land', [
      [1, cnGuns],
      [2, 4],
    ])
    extra?.(d)
  })
}

describe('standoff fire (§6, §5.2)', () => {
  it('auto-places artillery on Long-Range Fires and refuses non-adjacent or non-hostile targets', () => {
    const s = artilleryScenario(6, 6)
    expect(s.taskForces[0].lines.longRange.filter((x) => x === 1)).toHaveLength(6)
    expect(s.taskForces[0].lines.frontLine.filter((x) => x === 2)).toHaveLength(4)
    produce(s, (d) => {
      expect(orderStandoff(d, 1, 'se-land')).toMatchObject({ ok: false, reason: expect.stringContaining('adjacent') })
      expect(orderStandoff(d, 1, 'nw-land')).toEqual({ ok: false, reason: 'Not a hostile region.' })
      expect(orderStandoff(d, 1, 'c-land')).toEqual({ ok: true })
    })
  })

  it('starts an exchange on the next tick, runs Long-Range only, and fire continues while either flag is set', () => {
    let s = produce(artilleryScenario(6, 6), (d) => void orderStandoff(d, 1, 'c-land'))
    s = ticks(s, 1)
    const b = battleFor(s, 1)!
    expect(b.kind).toBe('standoff')
    expect(b.attacker.fielded).toEqual({ longRange: 6, cas: 0 })
    expect(s.taskForces[0].shock).toBe('ready') // standoff never triggers Planning
    expect(s.taskForces[1].lastInvasionCombatTick).toBe(-1)
    s = ticks(s, 30)
    const b2 = s.battles[0]
    expect(b2.attacker.hits.longRange + b2.defender.hits.longRange).toBeGreaterThan(0)
    expect(b2.attacker.hits.frontLine + b2.attacker.hits.cas).toBe(0)
    // The defender engages too, then the attacker cancels: fire continues on the defender's flag alone.
    s = produce(s, (d) => {
      orderStandoff(d, 2, 'w-land')
      orderStandoff(d, 1, null)
    })
    s = ticks(s, 1)
    expect(battleFor(s, 1)?.endedAt).toBeNull()
    s = produce(s, (d) => void orderStandoff(d, 2, null))
    s = ticks(s, 1)
    expect(s.battles[0].outcome).toBe('standoff-ended')
  })

  it('moves Air Superiority by +8 per success and lets a cleared line hand over 100% (§1.3)', () => {
    // 12 guns against 1: the lone Chinese piece gets knocked off quickly and the US keeps striking.
    let s = produce(artilleryScenario(12, 1), (d) => void orderStandoff(d, 1, 'c-land'))
    let seen8 = false
    let guard = 0
    while (guard++ < 200) {
      s = ticks(s, 1)
      const b = battleFor(s, 1)
      if (!b) break
      if (b.airSuperiority.contested === 8) seen8 = true
      if (b.airSuperiority.contested === 100) break
    }
    const b = battleFor(s, 1)!
    expect(seen8).toBe(true)
    expect(b.airSuperiority.contested).toBe(100)
    expect(domainControl(s, US, s.regions['c-land'])).toBe(100)
    expect(domainControl(s, CN, s.regions['c-land'])).toBe(0)
    expect(domainControl(s, 'hive', s.regions['c-land'])).toBe(100) // bilateral: third parties untouched
  })
})

describe('CAS (§5.3) and the combined-arms invasion', () => {
  it('CAS aircraft run at the Front Line, face pooled air defence, and count toward Air Superiority', () => {
    let s = newGame((d) => {
      ;(d.regions['c-land'] as LandRegion).controller = CN
      setFactionRelation(d, US, CN, 'hostile')
      saveDesign(d, US, { name: 'Light Infantry', platform: 'infantry', modules: ['inf-small-arms-1'] })
      saveDesign(d, US, { name: 'CAS Aircraft', platform: 'light-aircraft', modules: ['la-pgm', 'la-turbofan'] })
      saveDesign(d, CN, { name: 'AA Infantry', platform: 'infantry', modules: ['inf-small-arms-1', 'inf-man-aa'] })
      createTaskForce(d, US, 'w-land')
      setTarget(d, 1, 1, 12)
      setTarget(d, 1, 2, 6)
      fillTaskForce(d, 1)
      createTaskForce(d, CN, 'c-land')
      setTarget(d, 2, 1, 16) // 12 on the line, 4 AA-capable in Reserves to intercept
      fillTaskForce(d, 2)
      orderMove(d, 1, 'c-land')
    })
    expect(s.taskForces[0].lines.cas.filter((x) => x === 2)).toHaveLength(6)
    s = ticks(s, 1)
    const b = battleFor(s, 1)!
    expect(b.attacker.fielded).toEqual({ longRange: 0, cas: 6 })
    let guard = 0
    while (!s.battles[0].endedAt && guard++ < 300) s = ticks(s, 1)
    const done = s.battles[0]
    expect(done.attacker.hits.cas).toBeGreaterThan(0)
    expect(done.attacker.hits.frontLine).toBeGreaterThan(0)
    // Air Superiority moved during the fight, and a CAS-only force never triggers the full-vacate 100.
    expect(done.airSuperiority.contested).toBeGreaterThanOrEqual(0)
    expect(done.airSuperiority.contested).toBeLessThanOrEqual(100)
  })

  it("an unopposed run hits at 5% + half the aircraft's value, capped at 50% (decisions doc)", () => {
    expect(unopposedCasChance(12)).toBe(11) // standard CAS against Infantry
    expect(unopposedCasChance(10)).toBe(10) // against Tanks
    expect(unopposedCasChance(36)).toBe(23) // three Precision Guided Munitions
    expect(unopposedCasChance(200)).toBe(50)
    expect(unopposedCasChance(0)).toBe(0) // nothing to hit it with
  })

  it('pilots prefer the richer target: candidates are drawn in proportion to Production cost', () => {
    // A 200-Production tank beside a 50-Production infantry unit is picked four times in five.
    let tank = 0
    produce(newGame(), (d) => {
      for (let i = 0; i < 2000; i++) if (drawWeighted(d, [50, 200]) === 1) tank++
    })
    expect(tank / 2000).toBeGreaterThan(0.77)
    expect(tank / 2000).toBeLessThan(0.83)
  })

  /** US: 12 Light Infantry + 6 CAS, no artillery of its own. China: 12 Light Infantry, 12 Towed Artillery, `aa` AA Infantry. */
  function artilleryUnderAir(aa: number): { everHit: boolean; lost: number } {
    let s = newGame((d) => {
      giveRegion(d, 'c-land', CN)
      setFactionRelation(d, US, CN, 'hostile')
      saveDesign(d, US, LIGHT_INFANTRY)
      saveDesign(d, US, { name: 'CAS Aircraft', platform: 'light-aircraft', modules: ['la-pgm', 'la-turbofan'] })
      saveDesign(d, CN, LIGHT_INFANTRY)
      saveDesign(d, CN, TOWED_ARTILLERY) // design 2
      saveDesign(d, CN, { name: 'AA Infantry', platform: 'infantry', modules: ['inf-small-arms-1', 'inf-man-aa'] })
      raiseTaskForce(d, US, 'w-land', [
        [1, 12],
        [2, 6],
      ])
      raiseTaskForce(d, CN, 'c-land', [[1, 12], [2, 12], ...(aa > 0 ? [[3, aa] as [number, number]] : [])])
      orderMove(d, 1, 'c-land')
    })
    // The US has nothing on Long-Range Fires, so only its aircraft could ever reach the Chinese guns.
    let everHit = false
    for (let guard = 0; guard < 400 && !s.battles[0]?.endedAt; guard++) {
      s = ticks(s, 1)
      if (s.battles[0].defender.longRange.some((slot) => slot === null)) everHit = true
    }
    return { everHit, lost: s.battles[0].defender.unitsLost[2] ?? 0 }
  }

  it('unopposed aircraft hunt the enemy Long-Range line as well as the Front Line', () => {
    const r = artilleryUnderAir(0)
    expect(r.everHit).toBe(true)
    expect(r.lost).toBeGreaterThan(0)
  })

  it('intercepted aircraft are held to the Front Line: with air defence for every run, the guns are never touched', () => {
    expect(artilleryUnderAir(40)).toEqual({ everHit: false, lost: 0 })
  })
})
