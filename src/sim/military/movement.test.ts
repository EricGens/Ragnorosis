import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { advanceTick } from '../advance'
import { DUMMY_MAP } from '../data/dummyMap'
import { setFactionRelation } from '../relations'
import { createInitialState } from '../state'
import type { GameState, LandRegion } from '../types'
import { distanceBetween, etaTicks, findPath, moveTaskForces, orderMove, taskForceSpeed } from './movement'
import { saveDesign } from './roster'
import { createTaskForce, fillTaskForce, setTarget } from './taskForce'

const US = 'united-states'

/** US Light Infantry Task Force (id 1) in NW Land, filled. */
const base = produce(createInitialState(DUMMY_MAP), (d) => {
  saveDesign(d, US, { name: 'Light Infantry', platform: 'infantry', modules: ['inf-small-arms-1'] })
  createTaskForce(d, US, 'nw-land')
  setTarget(d, 1, 1, 2)
  fillTaskForce(d, 1)
})

const tf = (s: GameState) => s.taskForces[0]
const ticks = (s: GameState, n: number) => {
  for (let i = 0; i < n; i++) s = advanceTick(s).state
  return s
}
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
    expect(taskForceSpeed(base, tf(base))).toEqual({ combat: 5, transit: 30 })
    const empty = produce(base, (d) => void setTarget(d, 1, 1, 0))
    expect(taskForceSpeed(empty, tf(empty))).toBeNull()
    expect(produce(empty, (d) => void expect(orderMove(d, 1, 'n-land')).toMatchObject({ ok: false }))).toBeDefined()
  })

  it('moves at Transit Speed into permissive territory: 300 mi in 10 ticks, a hard flip on arrival', () => {
    let s = produce(base, (d) => void orderMove(d, 1, 'n-land'))
    expect(etaTicks(s, tf(s))).toBe(10)
    s = ticks(s, 9)
    expect(tf(s).regionId).toBe('nw-land') // still fully "in" the origin (§4.3)
    expect(tf(s).movement?.progress).toBe(270)
    s = ticks(s, 1)
    expect(tf(s).regionId).toBe('n-land')
    expect(tf(s).movement).toBeNull()
  })

  it('moves at Combat Speed into hostile Control and captures an undefended region on arrival', () => {
    let s = produce(hostile(base, 'hive'), (d) => void orderMove(d, 1, 'w-land')) // stage next to C Land
    s = ticks(s, 10)
    s = produce(s, (d) => void orderMove(d, 1, 'c-land'))
    expect(etaTicks(s, tf(s))).toBe(60) // 300 mi at 5 mph
    s = ticks(s, 59)
    expect(tf(s).regionId).toBe('w-land')
    expect((s.regions['c-land'] as LandRegion).controller).toBe('hive')
    s = ticks(s, 1)
    const c = s.regions['c-land'] as LandRegion
    expect(tf(s).regionId).toBe('c-land')
    expect(c.controller).toBe(US)
    expect(c.stability).toBe(25) // 50 − the placeholder capture hit
  })
})

describe('pathing (§4.2)', () => {
  it('takes the shortest path by time, not hops, mixing rates per leg', () => {
    // NW → SE with Hive, China and MU hostile. Via unaffiliated France (N, NE at 30 mph; E, SE at 5 mph):
    // 10 + 10 + 60 + 60 = 140 ticks. Via the centre or the west: three hostile legs, 190.
    const s = hostile(base, 'china', 'hive', 'mankind-united')
    expect(findPath(s, tf(s), 'nw-land', 'se-land')).toEqual(['n-land', 'ne-land', 'e-land', 'se-land'])
    const s2 = produce(s, (d) => void orderMove(d, 1, 'se-land'))
    expect(etaTicks(s2, tf(s2))).toBe(140)
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
    s = ticks(s, 4) // 120 mi toward N Land
    s = produce(s, (d) => void orderMove(d, 1, 'w-land'))
    expect(tf(s).movement).toEqual({ legs: ['w-land'], progress: 0, backtrack: 120, returnFrom: 'n-land' })
    expect(etaTicks(s, tf(s))).toBe(24 + 10)
    s = ticks(s, 23)
    expect(tf(s).movement?.returnFrom).toBe('n-land')
    s = ticks(s, 1)
    expect(tf(s).movement).toEqual({ legs: ['w-land'], progress: 0, backtrack: 0 }) // home; walk-back forgotten
    s = ticks(s, 9)
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
    let s2 = ticks(s, 2)
    s2 = produce(s2, (d) => void orderMove(d, 1, 'nw-land'))
    expect(tf(s2).movement).toEqual({ legs: [], progress: 0, backtrack: 60, returnFrom: 'w-land' })
    // A second redirect mid-walk-back keeps walking back from the same place.
    const s3 = produce(s2, (d) => void orderMove(d, 1, 'n-land'))
    expect(tf(s3).movement).toEqual({ legs: ['n-land'], progress: 0, backtrack: 60, returnFrom: 'w-land' })
    s2 = ticks(s2, 12)
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
    expect(tf(s).movement?.progress).toBe(5) // an invasion leg runs at Combat Speed even into our own N Land
    expect(s.battles).toHaveLength(1)
    expect(s.battles[0]).toMatchObject({
      regionId: 'n-land',
      attacker: { taskForceId: 1 },
      defender: { taskForceId: 2 },
    })
  })
})
