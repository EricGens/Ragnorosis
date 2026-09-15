import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { DUMMY_MAP } from '../data/dummyMap'
import { createInitialState } from '../state'
import type { GameState } from '../types'
import { deleteDesign, renameDesign, saveDesign, type RosterResult } from './roster'

const base = createInitialState(DUMMY_MAP)
const SA = 'inf-small-arms-1'
const AT = 'inf-man-at'

function save(state: GameState, input: Parameters<typeof saveDesign>[2]): [GameState, RosterResult] {
  const out: { r: RosterResult } = { r: { ok: false, reason: '' } }
  const next = produce(state, (d) => {
    out.r = saveDesign(d, 'united-states', input)
  })
  return [next, out.r]
}

describe('saving designs', () => {
  it('adds a valid design with a sequential id', () => {
    const [s, r] = save(base, { name: 'AT Infantry', platform: 'infantry', modules: [SA, AT] })
    expect(r).toEqual({ ok: true, id: 1 })
    expect(s.factions['united-states'].designs).toEqual([{ id: 1, name: 'AT Infantry', platform: 'infantry', modules: [SA, AT] }])
    expect(s.factions.china.designs).toEqual([])
  })

  it('rejects invalid module sets and blank names', () => {
    expect(save(base, { name: 'x', platform: 'infantry', modules: [] })[1]).toEqual({ ok: false, reason: 'Infantry requires 1 weapon module' })
    expect(save(base, { name: '  ', platform: 'infantry', modules: [SA] })[1]).toEqual({ ok: false, reason: 'Give the unit a name.' })
  })

  it('enforces name uniqueness, case-insensitively, except against itself', () => {
    const [s] = save(base, { name: 'Light Infantry', platform: 'infantry', modules: [SA] })
    expect(save(s, { name: 'light infantry', platform: 'infantry', modules: [SA, AT] })[1]).toEqual({
      ok: false,
      reason: 'A unit named "light infantry" already exists.',
    })
    expect(save(s, { id: 1, name: 'Light Infantry', platform: 'infantry', modules: [SA, AT] })[1]).toEqual({ ok: true, id: 1 })
  })

  it('updates an existing design in place and locks its platform', () => {
    const [s1] = save(base, { name: 'Light Infantry', platform: 'infantry', modules: [SA] })
    const [s2, r] = save(s1, { id: 1, name: 'AT Infantry', platform: 'infantry', modules: [SA, AT] })
    expect(r).toEqual({ ok: true, id: 1 })
    expect(s2.factions['united-states'].designs[0]).toMatchObject({ id: 1, name: 'AT Infantry', modules: [SA, AT] })
  })
})

describe('rename and delete', () => {
  const [s] = save(base, { name: 'Light Infantry', platform: 'infantry', modules: [SA] })

  it('renames with the same uniqueness rule', () => {
    const [s2] = save(s, { name: 'AT Infantry', platform: 'infantry', modules: [SA, AT] })
    const out: { r: RosterResult } = { r: { ok: false, reason: '' } }
    produce(s2, (d) => {
      out.r = renameDesign(d, 'united-states', 2, 'Light Infantry')
    })
    expect(out.r).toEqual({ ok: false, reason: 'A unit named "Light Infantry" already exists.' })
    const s3 = produce(s2, (d) => {
      renameDesign(d, 'united-states', 2, 'Tank Killers')
    })
    expect(s3.factions['united-states'].designs[1].name).toBe('Tank Killers')
  })

  it('deletes by id', () => {
    const s2 = produce(s, (d) => deleteDesign(d, 'united-states', 1))
    expect(s2.factions['united-states'].designs).toEqual([])
  })
})
