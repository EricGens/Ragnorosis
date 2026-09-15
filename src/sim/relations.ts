// The Faction & Country Relationship Matrix (Epoch 2 skeleton §1.6): the single source of truth every
// combat and domain-control rule reads its "friendly / hostile / at war" checks from.

import { FACTIONS } from './data/factions'
import { log } from './log'
import type { CountryRelation, FactionId, FactionRelation, GameState } from './types'
import { isLand } from './types'

/** Order-independent key for a symmetric pair. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function factionRelation(state: GameState, a: FactionId, b: FactionId): FactionRelation {
  if (a === b) return 'friendly'
  return state.relations.factions[pairKey(a, b)] ?? 'neutral'
}

export function countryRelation(state: GameState, a: string, b: string): CountryRelation {
  if (a === b) return 'peace'
  return state.relations.countries[pairKey(a, b)] ?? 'peace'
}

/** Every distinct country on the map, derived from land regions. */
export function countries(state: GameState): string[] {
  const set = new Set<string>()
  for (const id of state.regionOrder) {
    const r = state.regions[id]
    if (isLand(r)) set.add(r.country)
  }
  return [...set].sort()
}

/** A country's controlling faction — uniform across its regions by invariant — or null if unaffiliated. */
export function countryController(state: GameState, country: string): FactionId | null {
  for (const id of state.regionOrder) {
    const r = state.regions[id]
    if (isLand(r) && r.country === country) return r.controller
  }
  return null
}

/** Countries a faction controls. */
export function factionCountries(state: GameState, faction: FactionId): string[] {
  return countries(state).filter((c) => countryController(state, c) === faction)
}

/** True if any country the faction controls is At War with `country`. */
export function atWarWith(state: GameState, faction: FactionId, country: string): boolean {
  return factionCountries(state, faction).some((c) => countryRelation(state, c, country) === 'war')
}

/**
 * Set a Faction pair's relationship. Moving away from Hostile also sets any At-War pair between
 * countries the two factions control back to At Peace, so "War without Hostile" stays unreachable
 * from either direction. Call on an Immer draft.
 */
export function setFactionRelation(state: GameState, a: FactionId, b: FactionId, relation: FactionRelation): void {
  if (a === b) return
  const key = pairKey(a, b)
  if ((state.relations.factions[key] ?? 'neutral') === relation) return
  state.relations.factions[key] = relation
  log(state, 'dev', `${FACTIONS[a].name} and ${FACTIONS[b].name} are now ${relation}`)
  if (relation !== 'hostile') {
    for (const ca of factionCountries(state, a)) {
      for (const cb of factionCountries(state, b)) {
        if (countryRelation(state, ca, cb) === 'war') {
          state.relations.countries[pairKey(ca, cb)] = 'peace'
          log(state, 'dev', `${ca} and ${cb} are at peace (cascade from faction relationship)`)
        }
      }
    }
  }
}

/**
 * Set a Country pair's state. Declaring War between two countries controlled by different factions
 * automatically makes those factions Hostile — a cascade, not a precondition. Call on an Immer draft.
 */
export function setCountryRelation(state: GameState, a: string, b: string, relation: CountryRelation): void {
  if (a === b) return
  const key = pairKey(a, b)
  if ((state.relations.countries[key] ?? 'peace') === relation) return
  state.relations.countries[key] = relation
  log(state, 'dev', `${a} and ${b} are now at ${relation}`)
  if (relation === 'war') {
    const fa = countryController(state, a)
    const fb = countryController(state, b)
    if (fa && fb && fa !== fb && factionRelation(state, fa, fb) !== 'hostile') {
      state.relations.factions[pairKey(fa, fb)] = 'hostile'
      log(state, 'dev', `${FACTIONS[fa].name} and ${FACTIONS[fb].name} are now hostile (cascade from war)`)
    }
  }
}
