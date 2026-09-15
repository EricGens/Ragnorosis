import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { advanceTick } from './advance'
import { DUMMY_MAP } from './data/dummyMap'
import { setFactionRelation } from './relations'
import { saveDesign } from './military/roster'
import { createTaskForce, fillTaskForce, setTarget } from './military/taskForce'
import { orderMove } from './military/movement'
import { parseSave, restoreGame, serializeSave } from './save'
import { createInitialState } from './state'
import type { LandRegion } from './types'

const US = 'united-states'

/** A busy sandbox: designs, a Task Force mid-transit, a standing standoff flag, relations, a captured region. */
const busy = produce(createInitialState(DUMMY_MAP), (d) => {
  saveDesign(d, US, { name: 'Light Infantry', platform: 'infantry', modules: ['inf-small-arms-1'] })
  setFactionRelation(d, US, 'china', 'hostile')
  ;(d.regions['c-land'] as LandRegion).controller = US
  createTaskForce(d, US, 'nw-land')
  setTarget(d, 1, 1, 3)
  fillTaskForce(d, 1)
  orderMove(d, 1, 'n-land')
})

describe('save & load (§8)', () => {
  it('round-trips an at-rest game, including a Task Force peacefully mid-transit', () => {
    let s = busy
    for (let i = 0; i < 4; i++) s = advanceTick(s).state
    const r = serializeSave(s, US, new Date('2026-09-15T12:00:00Z'))
    if (!r.ok) throw new Error(r.reason)
    expect(r.filename).toBe('ragnorosis-sandbox-2026-09-15T12-00-00.json')
    const p = parseSave(r.json)
    if (!p.ok) throw new Error(p.reason)
    expect(p.save.mode).toBe('sandbox')
    expect(p.save.perspective).toBe(US)
    const restored = restoreGame(p.save, 42)
    expect(restored.rngSeed).toBe(42) // fresh randomness, not the saved seed
    expect({ ...restored, rngSeed: s.rngSeed }).toEqual({ ...s, interrupts: [] })
    expect(restored.taskForces[0].movement).toEqual({ legs: ['n-land'], progress: 120, backtrack: 0 })
    // It keeps running from where it was.
    const later = advanceTick(restored).state
    expect(later.taskForces[0].movement?.progress).toBe(150)
  })

  it('refuses to save while a battle is live', () => {
    const s = produce(busy, (d) => {
      saveDesign(d, 'china', { name: 'Light Infantry', platform: 'infantry', modules: ['inf-small-arms-1'] })
      createTaskForce(d, 'china', 'e-land')
      setTarget(d, 2, 1, 2)
      fillTaskForce(d, 2)
      d.taskForces[1].regionId = 'n-land' // sitting in our path
    })
    const fighting = advanceTick(s).state
    expect(fighting.battles).toHaveLength(1)
    expect(serializeSave(fighting, US)).toEqual({
      ok: false,
      reason: 'Save is available only at rest — a battle is in progress.',
    })
  })

  it('rejects files that are not saves, are from another epoch, or name a mode that does not exist yet', () => {
    expect(parseSave('not json')).toEqual({ ok: false, reason: 'That file is not valid JSON.' })
    expect(parseSave('{"hello":1}')).toEqual({ ok: false, reason: 'That file is not a Ragnorosis save.' })
    const r = serializeSave(busy, US)
    if (!r.ok) throw new Error(r.reason)
    const old = { ...JSON.parse(r.json), epoch: 1 }
    expect(parseSave(JSON.stringify(old))).toMatchObject({ ok: false, reason: expect.stringContaining('Epoch 1') })
    const campaign = { ...JSON.parse(r.json), mode: 'campaign' }
    expect(parseSave(JSON.stringify(campaign))).toEqual({
      ok: false,
      reason: '"campaign" saves aren\'t supported yet.',
    })
    const broken = { ...JSON.parse(r.json), game: { tick: 1 } }
    expect(parseSave(JSON.stringify(broken))).toEqual({ ok: false, reason: 'That save file is incomplete.' })
  })
})
