import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { DUMMY_MAP } from '../data/dummyMap'
import { setCountryRelation, setFactionRelation } from '../relations'
import { createInitialState } from '../state'
import { domainControl } from './domainControl'

const base = createInitialState(DUMMY_MAP)
const at = (s: typeof base, faction: Parameters<typeof domainControl>[1], id: string) =>
  domainControl(s, faction, s.regions[id])

describe('ambient access', () => {
  it('is 100% over your own region and over a Neutral controller', () => {
    expect(at(base, 'united-states', 'nw-land')).toBe(100)
    expect(at(base, 'china', 'nw-land')).toBe(100)
  })

  it('is 100% over an unaffiliated region at peace, and for landless factions everywhere', () => {
    expect(at(base, 'united-states', 'ne-land')).toBe(100)
    expect(at(base, 'gamer', 'e-land')).toBe(100)
  })

  it('is 100% over every maritime region while no Task Forces exist', () => {
    const hostile = produce(base, (d) => setFactionRelation(d, 'hive', 'united-states', 'hostile'))
    expect(at(hostile, 'hive', 'nw-maritime')).toBe(100)
  })
})

describe('denial by hostility', () => {
  const s = produce(base, (d) => setCountryRelation(d, 'United States', 'China', 'war'))

  it('blocks a Hostile faction from a controlled land region, complementary to the controller', () => {
    expect(at(s, 'united-states', 'e-land')).toBe(0)
    expect(at(s, 'china', 'e-land')).toBe(100)
    expect(at(s, 'united-states', 'e-land') + at(s, 'china', 'e-land')).toBe(100)
  })

  it('is bilateral — a third party keeps full access to both belligerents', () => {
    expect(at(s, 'hive', 'e-land')).toBe(100)
    expect(at(s, 'hive', 'nw-land')).toBe(100)
  })

  it('blocks an unaffiliated region only via a country-level war', () => {
    const war = produce(base, (d) => setCountryRelation(d, 'United States', 'France', 'war'))
    expect(at(war, 'united-states', 'ne-land')).toBe(0)
    expect(at(war, 'china', 'ne-land')).toBe(100)
  })
})
