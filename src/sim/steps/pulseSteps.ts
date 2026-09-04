// Pulse-end resolution. Every function here operates on an Immer draft.

import { legitimacyPerPulse, moneyPerPulse, populationGrowthPerPulse } from '../formulas/economy'
import { planImmigration } from '../formulas/immigration'
import { driftStability, stabilityAnchor } from '../formulas/stability'
import { formatMoney, formatPopulation } from '../format'
import { log } from '../log'
import type { GameState, LandRegion } from '../types'
import { FACTION_IDS, isLand } from '../types'

function landRegions(state: GameState): LandRegion[] {
  return state.regionOrder.map((id) => state.regions[id]).filter(isLand)
}

/** Money from each controlled region to its controller. */
export function collectMoney(state: GameState): void {
  const totals: Partial<Record<string, number>> = {}
  for (const r of landRegions(state)) {
    if (!r.controller) continue
    const income = moneyPerPulse(r)
    state.factions[r.controller].money += income
    totals[r.controller] = (totals[r.controller] ?? 0) + income
  }
  for (const [faction, total] of Object.entries(totals)) {
    log(state, 'economy', `${faction} collects ${formatMoney(total ?? 0)} in taxes`)
  }
}

/** Legitimacy accrues to every faction from Popularity × Population, regardless of Control. */
export function collectLegitimacy(state: GameState): void {
  const regions = landRegions(state)
  for (const id of FACTION_IDS) {
    state.factions[id].legitimacy += legitimacyPerPulse(regions, id)
  }
}

/** Population grows 1%/yr; GDP grows by the same fraction, holding per-capita steady. */
export function growPopulation(state: GameState): void {
  for (const r of landRegions(state)) {
    const growth = populationGrowthPerPulse(r.population)
    if (r.population > 0) r.gdp *= 1 + growth / r.population
    r.population += growth
  }
}

/** Net-zero population transfer from low- to high-Stability regions. */
export function applyImmigration(state: GameState): void {
  for (const t of planImmigration(state)) {
    const from = state.regions[t.from] as LandRegion
    const to = state.regions[t.to] as LandRegion
    from.population -= t.population
    from.gdp -= t.gdp
    to.population += t.population
    to.gdp += t.gdp
    log(state, 'economy', `${formatPopulation(t.population)} migrate from ${from.name} to ${to.name}`)
  }
}

/** Each region's Stability moves toward its computed anchor. */
export function driftAllStability(state: GameState): void {
  for (const r of landRegions(state)) {
    const anchor = stabilityAnchor(r)
    const next = driftStability(r.stability, anchor)
    if (next !== r.stability) {
      log(state, 'stability', `${r.name} Stability ${r.stability.toFixed(1)} → ${next.toFixed(1)} (anchor ${anchor.toFixed(1)})`)
      r.stability = next
    }
  }
}

/** The full pulse-end sequence, in order. */
export function resolvePulseEnd(state: GameState): void {
  collectMoney(state)
  collectLegitimacy(state)
  growPopulation(state)
  applyImmigration(state)
  driftAllStability(state)
}
