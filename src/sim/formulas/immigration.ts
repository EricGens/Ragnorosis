import type { GameState, LandRegion, RegionId } from '../types'
import { isLand } from '../types'
import { perCapitaGdp } from './economy'

/** Expand beyond direct land neighbors (across maritime regions) until this many candidates are found. */
export const MIN_CANDIDATES = 4

/**
 * Land regions a region exchanges population with: direct land neighbors first; if fewer than
 * MIN_CANDIDATES, add land regions one maritime hop away, so islands still see immigration.
 */
export function immigrationCandidates(state: GameState, id: RegionId): RegionId[] {
  const out: RegionId[] = []
  const seen = new Set<RegionId>([id])
  const add = (r: RegionId) => {
    if (!seen.has(r) && isLand(state.regions[r])) {
      seen.add(r)
      out.push(r)
    }
  }
  for (const n of state.adjacency[id]) add(n)
  if (out.length < MIN_CANDIDATES) {
    for (const n of state.adjacency[id]) {
      if (isLand(state.regions[n])) continue
      for (const m of state.adjacency[n]) {
        add(m)
        if (out.length >= MIN_CANDIDATES) return out
      }
    }
  }
  return out
}

export interface Transfer {
  from: RegionId
  to: RegionId
  population: number
  gdp: number
}

/**
 * Plan this Pulse's transfers from a snapshot. Each unordered pair is evaluated once; people move
 * from the lower- to the higher-Stability region, and GDP moves with them at the source's per-capita.
 */
export function planImmigration(state: GameState): Transfer[] {
  const transfers: Transfer[] = []
  const done = new Set<string>()
  for (const id of state.regionOrder) {
    const a = state.regions[id]
    if (!isLand(a)) continue
    for (const otherId of immigrationCandidates(state, id)) {
      const key = [id, otherId].sort().join('|')
      if (done.has(key)) continue
      done.add(key)
      const b = state.regions[otherId] as LandRegion
      const delta = a.stability - b.stability
      if (delta === 0) continue
      const [from, to] = delta < 0 ? [a, b] : [b, a]
      const population = Math.floor(from.population * state.settings.immigrationRate * (Math.abs(delta) / 100))
      if (population <= 0) continue
      transfers.push({ from: from.id, to: to.id, population, gdp: population * perCapitaGdp(from) })
    }
  }
  return transfers
}
