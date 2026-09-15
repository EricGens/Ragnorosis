import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { DUMMY_MAP } from './data/dummyMap'
import {
  atWarWith,
  countries,
  countryController,
  countryRelation,
  factionCountries,
  factionRelation,
  pairKey,
  setCountryRelation,
  setFactionRelation,
} from './relations'
import { createInitialState } from './state'

const base = createInitialState(DUMMY_MAP)

describe('pair keys', () => {
  it('are order-independent', () => {
    expect(pairKey('china', 'united-states')).toBe(pairKey('united-states', 'china'))
  })
})

describe('defaults', () => {
  it('starts every faction pair Neutral and every country pair At Peace', () => {
    expect(factionRelation(base, 'china', 'united-states')).toBe('neutral')
    expect(countryRelation(base, 'China', 'United States')).toBe('peace')
  })

  it('treats a faction as Friendly with itself and a country At Peace with itself', () => {
    expect(factionRelation(base, 'hive', 'hive')).toBe('friendly')
    expect(countryRelation(base, 'Taiwan', 'Taiwan')).toBe('peace')
  })
})

describe('countries', () => {
  it('derives the five dummy-map countries and their controllers from regions', () => {
    expect(countries(base)).toEqual(['China', 'France', 'Mexico', 'Taiwan', 'United States'])
    expect(countryController(base, 'United States')).toBe('united-states')
    expect(countryController(base, 'Taiwan')).toBe('hive')
    expect(countryController(base, 'Mexico')).toBe('mankind-united')
    expect(countryController(base, 'France')).toBeNull()
    expect(factionCountries(base, 'china')).toEqual(['China'])
    expect(factionCountries(base, 'gamer')).toEqual([])
  })
})

describe('cascades', () => {
  it('declaring War between two faction-controlled countries makes their factions Hostile', () => {
    const s = produce(base, (d) => setCountryRelation(d, 'United States', 'China', 'war'))
    expect(countryRelation(s, 'China', 'United States')).toBe('war')
    expect(factionRelation(s, 'united-states', 'china')).toBe('hostile')
    expect(atWarWith(s, 'united-states', 'China')).toBe(true)
    expect(atWarWith(s, 'united-states', 'Mexico')).toBe(false)
  })

  it('war with an unaffiliated country needs no faction entry', () => {
    const s = produce(base, (d) => setCountryRelation(d, 'United States', 'France', 'war'))
    expect(atWarWith(s, 'united-states', 'France')).toBe(true)
    expect(Object.keys(s.relations.factions)).toHaveLength(0)
  })

  it('moving a faction pair off Hostile restores peace between their countries', () => {
    let s = produce(base, (d) => setCountryRelation(d, 'United States', 'China', 'war'))
    s = produce(s, (d) => setFactionRelation(d, 'united-states', 'china', 'neutral'))
    expect(countryRelation(s, 'United States', 'China')).toBe('peace')
  })

  it('records hostility between factions that hold no territory', () => {
    const s = produce(base, (d) => setFactionRelation(d, 'gamer', 'red-queen', 'hostile'))
    expect(factionRelation(s, 'red-queen', 'gamer')).toBe('hostile')
    expect(Object.keys(s.relations.countries)).toHaveLength(0)
  })

  it('logs every change', () => {
    const s = produce(base, (d) => setCountryRelation(d, 'United States', 'China', 'war'))
    expect(s.log.filter((e) => e.category === 'dev')).toHaveLength(2)
  })
})
