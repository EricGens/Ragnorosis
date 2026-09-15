import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { DUMMY_MAP } from '../data/dummyMap'
import { createInitialState } from '../state'
import { deleteDesign, saveDesign } from './roster'
import {
  assignSlot,
  createTaskForce,
  deleteTaskForce,
  fillTaskForce,
  setTarget,
  setTaskForceFaction,
  slotOptions,
} from './taskForce'

const US = 'united-states'
const SA = 'inf-small-arms-1'
const AT = 'inf-man-at'

/** US roster: 1 = Light Infantry, 2 = AT Infantry. One Task Force wanting 3 Light, 1 AT. */
const base = produce(createInitialState(DUMMY_MAP), (d) => {
  saveDesign(d, US, { name: 'Light Infantry', platform: 'infantry', modules: [SA] })
  saveDesign(d, US, { name: 'AT Infantry', platform: 'infantry', modules: [SA, AT] })
  const r = createTaskForce(d, US, 'w-land', '  1st Expeditionary ')
  if (!r.ok) throw new Error(r.reason)
  setTarget(d, r.id, 1, 3)
  setTarget(d, r.id, 2, 1)
})

describe('raising and composing', () => {
  it('creates a named Task Force in a controlled land region only', () => {
    expect(base.taskForces[0]).toMatchObject({ id: 1, name: '1st Expeditionary', faction: US, regionId: 'w-land' })
    expect(base.taskForces[0].composition).toEqual([
      { designId: 1, target: 3, priority: 'normal', equipment: 0, manpower: 0 },
      { designId: 2, target: 1, priority: 'normal', equipment: 0, manpower: 0 },
    ])
    produce(base, (d) => {
      expect(createTaskForce(d, US, 'c-land').ok).toBe(false) // unaffiliated
      expect(createTaskForce(d, US, 'nw-maritime').ok).toBe(false)
      expect(createTaskForce(d, US, 'nw-land')).toEqual({ ok: true, id: 2 })
      expect(d.taskForces[1].name).toBe('Task Force 2')
    })
  })

  it('lowering a target returns Equipment to the stockpile and Manpower to the pool at once', () => {
    const filled = produce(base, (d) => fillTaskForce(d, 1))
    expect(filled.taskForces[0].composition[0]).toMatchObject({ equipment: 3, manpower: 150 })
    const s = produce(filled, (d) => void setTarget(d, 1, 1, 1))
    expect(s.taskForces[0].composition[0]).toMatchObject({ target: 1, equipment: 1, manpower: 50 })
    expect(s.factions[US].stockpile[1]).toBe(2)
    expect(s.factions[US].manpower).toBe(100)
    const gone = produce(s, (d) => void setTarget(d, 1, 1, 0))
    expect(gone.taskForces[0].composition.map((l) => l.designId)).toEqual([2])
    expect(gone.factions[US].stockpile[1]).toBe(3)
  })

  it('disbanding returns everything', () => {
    const s = produce(base, (d) => {
      fillTaskForce(d, 1)
      deleteTaskForce(d, 1)
    })
    expect(s.taskForces).toEqual([])
    expect(s.factions[US].stockpile).toEqual({ 1: 3, 2: 1 })
    expect(s.factions[US].manpower).toBe(200)
  })
})

describe('line assignment (§6)', () => {
  it('places new units on the Front Line automatically, until the 12 slots are full', () => {
    // 3 Light + 1 AT were added to an empty Task Force: slots 0–2 and 3, nothing in Reserves.
    expect(base.taskForces[0].lines.frontLine.slice(0, 5)).toEqual([1, 1, 1, 2, null])
    const s = produce(base, (d) => void setTarget(d, 1, 1, 20))
    expect(s.taskForces[0].lines.frontLine.filter((x) => x === 1)).toHaveLength(11) // 12 slots minus the AT
    expect(s.taskForces[0].lines.frontLine.every((x) => x !== null)).toBe(true)
  })

  it('offers only eligible, not-yet-fully-placed types', () => {
    const tf = base.taskForces[0]
    expect(slotOptions(base, tf, 'frontLine')).toEqual([]) // everything auto-placed already
    expect(slotOptions(base, tf, 'longRange')).toEqual([]) // no standoff weapons on Infantry
    expect(slotOptions(base, tf, 'cas')).toEqual([])
    const s = produce(base, (d) => {
      assignSlot(d, 1, 'frontLine', 3, null) // take the AT off the line
    })
    expect(slotOptions(s, s.taskForces[0], 'frontLine').map((d) => d.name)).toEqual(['AT Infantry'])
    produce(s, (d) => {
      expect(assignSlot(d, 1, 'frontLine', 4, 1)).toMatchObject({ ok: false }) // every Light Infantry is placed
      expect(assignSlot(d, 1, 'longRange', 0, 1)).toMatchObject({ ok: false }) // not eligible
      expect(assignSlot(d, 1, 'frontLine', 7, 2)).toEqual({ ok: true, id: 1 }) // anywhere the player likes
    })
  })

  it('vacates slots the count no longer covers and when the design is deleted', () => {
    const s = produce(base, (d) => {
      setTarget(d, 1, 1, 2)
    })
    expect(s.taskForces[0].lines.frontLine.filter((x) => x === 1)).toHaveLength(2)
    expect(s.taskForces[0].lines.frontLine[2]).toBeNull()
    const s2 = produce(s, (d) => {
      fillTaskForce(d, 1)
      deleteDesign(d, US, 1)
    })
    expect(s2.taskForces[0].composition.map((l) => l.designId)).toEqual([2])
    expect(s2.taskForces[0].lines.frontLine.filter((x) => x === 1)).toHaveLength(0)
    expect(s2.taskForces[0].lines.frontLine[3]).toBe(2) // the AT keeps its auto-placed slot
    expect(s2.factions[US].manpower).toBe(100) // Light's 2 × 50 returned; its Equipment is gone
    expect(s2.factions[US].stockpile[1]).toBeUndefined()
  })
})

describe('devtools reassignment (§7)', () => {
  it('moves a Task Force to another faction, adopting its designs by module multiset', () => {
    const s = produce(base, (d) => {
      saveDesign(d, 'china', { name: 'Light Infantry', platform: 'infantry', modules: [SA] }) // same loadout
      saveDesign(d, 'china', { name: 'AT Infantry', platform: 'infantry', modules: [SA, 'inf-man-aa'] }) // name clash, different loadout
      setTaskForceFaction(d, 1, 'china')
    })
    const tf = s.taskForces[0]
    expect(tf.faction).toBe('china')
    expect(s.factions.china.designs.map((d) => d.name)).toEqual(['Light Infantry', 'AT Infantry', 'AT Infantry (2)'])
    expect(tf.composition.map((l) => l.designId)).toEqual([1, 3])
    expect(tf.lines.frontLine.slice(0, 4)).toEqual([1, 1, 1, 3]) // slots remapped along with the composition
  })
})
