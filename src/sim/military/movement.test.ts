import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { setFactionRelation } from '../relations'
import { LIGHT_INFANTRY, newGame, raiseTaskForce, ticks, US } from '../testing'
import type { GameState, LandRegion } from '../types'
import { distanceBetween, etaTicks, findPath, moveTaskForces, orderMove, taskForceSpeed } from './movement'
import { saveDesign } from './roster'
import { createTaskForce, setTarget } from './taskForce'

/** US Light Infantry Task Force (id 1) in NW Land, filled. */
const base = newGame((d) => {
  saveDesign(d, US, LIGHT_INFANTRY)
  raiseTaskForce(d, US, 'nw-land', [[1, 2]])
})

const tf = (s: GameState) => s.taskForces[0]
const hostile = (s: GameState, ...factions: ('china' | 'hive' | 'mankind-united')[]) =>
  produce(s, (d) => {
    for (const f of factions) setFactionRelation(d, US, f, 'hostile')
  })

describe('distance geometry (§4.1)', () => {
  it('is 300 between land neighbors and 300/400/500 from each ocean', () => {
    expect(distanceBetween(base, 'nw-land', 'n-land')).toBe(300)
    expect(distanceBetween(base, 'nw-maritime', 'nw-land')).toBe(300)
    expect(distanceBetween(base, 'n-land', 'nw-maritime')).toBe(400)
    expect(distanceBetween(base, 'nw-maritime', 'sw-maritime')).toBe(500)
    expect(() => distanceBetween(base, 'nw-land', 'se-land')).toThrow()
  })
})

describe('speed (§4.5)', () => {
  it('is the slowest ground component, Combat(Transit), and null with nothing to move', () => {
    expect(taskForceSpeed(base, tf(base))).toEqual({ combat: 5 / 3, transit: 10 })
    const empty = produce(base, (d) => void setTarget(d, 1, 1, 0))
    expect(taskForceSpeed(empty, tf(empty))).toBeNull()
    expect(produce(empty, (d) => void expect(orderMove(d, 1, 'n-land')).toMatchObject({ ok: false }))).toBeDefined()
  })

  it('moves at Transit Speed into permissive territory: 300 mi in 30 ticks, a hard flip on arrival', () => {
    let s = produce(base, (d) => void orderMove(d, 1, 'n-land'))
    expect(etaTicks(s, tf(s))).toBe(30)
    s = ticks(s, 29)
    expect(tf(s).regionId).toBe('nw-land') // still fully "in" the origin (§4.3)
    expect(tf(s).movement?.progress).toBe(290)
    s = ticks(s, 1)
    expect(tf(s).regionId).toBe('n-land')
    expect(tf(s).movement).toBeNull()
  })

  it('moves at Combat Speed into hostile Control and captures an undefended region on arrival', () => {
    let s = produce(hostile(base, 'hive'), (d) => void orderMove(d, 1, 'w-land')) // stage next to C Land
    s = ticks(s, 30)
    s = produce(s, (d) => void orderMove(d, 1, 'c-land'))
    expect(etaTicks(s, tf(s))).toBe(180) // 300 mi at 5/3 mph
    s = ticks(s, 179)
    expect(tf(s).regionId).toBe('w-land')
    expect((s.regions['c-land'] as LandRegion).controller).toBe('hive')
    s = ticks(s, 1)
    const c = s.regions['c-land'] as LandRegion
    expect(tf(s).regionId).toBe('c-land')
    expect(c.controller).toBe(US)
    expect(c.stability).toBeGreaterThanOrEqual(25) // 50 − the placeholder capture hit, plus a little drift while we walked
    expect(c.stability).toBeLessThan(26)
  })
})

describe('pathing (§4.2)', () => {
  it('takes the shortest path by time, not hops, mixing rates per leg', () => {
    // NW → SE with Hive, China and MU hostile. Via unaffiliated France (N, NE at 10 mph; E, SE at 5/3 mph):
    // 30 + 30 + 180 + 180 = 420 ticks. Via the centre or the west: three hostile legs, 570.
    const s = hostile(base, 'china', 'hive', 'mankind-united')
    expect(findPath(s, tf(s), 'nw-land', 'se-land')).toEqual(['n-land', 'ne-land', 'e-land', 'se-land'])
    const s2 = produce(s, (d) => void orderMove(d, 1, 'se-land'))
    expect(etaTicks(s2, tf(s2))).toBe(420)
  })

  it('refuses the sea, routes around a defended region, and appends shift-click legs from the last leg', () => {
    const withDefender = produce(hostile(base, 'china'), (d) => {
      saveDesign(d, 'china', { name: 'Light Infantry', platform: 'infantry', modules: ['inf-small-arms-1'] })
      createTaskForce(d, 'china', 'e-land')
      setTarget(d, 2, 1, 1)
    })
    produce(withDefender, (d) => {
      expect(orderMove(d, 1, 'nw-maritime')).toEqual({ ok: false, reason: "Land forces can't put to sea yet." })
      expect(orderMove(d, 1, 'n-land')).toEqual({ ok: true })
      expect(orderMove(d, 1, 'ne-land', true)).toEqual({ ok: true })
      expect(d.taskForces[0].movement?.legs).toEqual(['n-land', 'ne-land'])
      // Non-adjacent append paths from the last leg; E Land is defended so the router goes around it.
      expect(orderMove(d, 1, 'se-land', true)).toEqual({ ok: true })
      expect(d.taskForces[0].movement?.legs.slice(0, 2)).toEqual(['n-land', 'ne-land'])
      expect(d.taskForces[0].movement?.legs).not.toContain('e-land')
      // Ordering *into* the defended region itself is an invasion, and allowed.
      expect(orderMove(d, 1, 'e-land')).toEqual({ ok: true })
    })
  })
})

describe('redirect cost (§4.4)', () => {
  it('walks progress back at Combat Speed before the new leg starts', () => {
    let s = produce(base, (d) => void orderMove(d, 1, 'n-land'))
    s = ticks(s, 12) // 120 mi toward N Land
    s = produce(s, (d) => void orderMove(d, 1, 'w-land'))
    expect(tf(s).movement).toEqual({ legs: ['w-land'], progress: 0, backtrack: 120, returnFrom: 'n-land' })
    expect(etaTicks(s, tf(s))).toBe(72 + 30)
    s = ticks(s, 71)
    expect(tf(s).movement?.returnFrom).toBe('n-land')
    s = ticks(s, 1)
    expect(tf(s).movement).toEqual({ legs: ['w-land'], progress: 0, backtrack: 0 }) // home; walk-back forgotten
    s = ticks(s, 29)
    expect(tf(s).regionId).toBe('nw-land')
    s = ticks(s, 1)
    expect(tf(s).regionId).toBe('w-land')
  })

  it('is free before time advances, and halting is an order back to the occupied region', () => {
    const s = produce(base, (d) => {
      orderMove(d, 1, 'n-land')
      orderMove(d, 1, 'w-land')
    })
    expect(tf(s).movement).toEqual({ legs: ['w-land'], progress: 0, backtrack: 0 })
    let s2 = ticks(s, 6)
    s2 = produce(s2, (d) => void orderMove(d, 1, 'nw-land'))
    expect(tf(s2).movement).toEqual({ legs: [], progress: 0, backtrack: 60, returnFrom: 'w-land' })
    // A second redirect mid-walk-back keeps walking back from the same place.
    const s3 = produce(s2, (d) => void orderMove(d, 1, 'n-land'))
    expect(tf(s3).movement).toEqual({ legs: ['n-land'], progress: 0, backtrack: 60, returnFrom: 'w-land' })
    s2 = ticks(s2, 36)
    expect(tf(s2).movement).toBeNull()
    expect(tf(s2).regionId).toBe('nw-land')
  })
})

describe('tick step', () => {
  it('starts an invasion when the leg advances toward a defended region, transit clock still running', () => {
    const s = produce(hostile(base, 'china'), (d) => {
      saveDesign(d, 'china', { name: 'Light Infantry', platform: 'infantry', modules: ['inf-small-arms-1'] })
      createTaskForce(d, 'china', 'e-land')
      setTarget(d, 2, 1, 1)
      orderMove(d, 1, 'n-land')
      d.taskForces[1].regionId = 'n-land' // teleported in ahead of us
      moveTaskForces(d)
    })
    expect(tf(s).movement?.progress).toBeCloseTo(5 / 3) // an invasion leg runs at Combat Speed even into our own N Land
    expect(s.battles).toHaveLength(1)
    expect(s.battles[0]).toMatchObject({
      regionId: 'n-land',
      attacker: { taskForceId: 1 },
      defender: { taskForceId: 2 },
    })
  })
})
