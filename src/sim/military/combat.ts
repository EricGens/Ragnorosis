// Combat formulas (Epoch 2 skeleton §3.6, §5.1, §5.4; GDD §8.6). Pure functions — the battle state
// machine in battle.ts applies them. Every number here is the spec's; tuning lives in playtesting.

import { defensibility } from '../formulas/defensibility'
import type { CompositionLine, GameState, LandRegion, TaskForce, UnitDesign } from '../types'
import { designStats, type DesignStats } from './design'
import type { PlatformId } from './platforms'
import { findDesign } from './taskForce'

/** Baseline chance of a successful engagement for a side with any nonzero relevant vector value. */
export const BASE_HIT_PERCENT = 5
/** The advantaged side's chance: min(this cap, baseline + point gap) — universal across roles (decisions doc). */
export const ADVANTAGE_CAP_PERCENT = 50
/** Chance per empty Front Line slot per tick to pull a unit up from Reserves. */
export const REINFORCE_PERCENT = 33
/** Shock lasts this long from the start of invasion combat (GDD §8.6.2). */
export const SHOCK_TICKS = 24
export const SHOCK_PER_MPH = 0.3
/** Organization regained per tick out of contact, as a fraction of max (Eric, 2026-09-15). */
export const ORG_REGEN_PER_TICK = 0.005
/** Share of a surrendered Task Force's Equipment the victor converts (Eric, 2026-09-15). */
export const SURRENDER_EQUIPMENT_SHARE = 0.25
/** Stability a captured region must reach before its captor may move on (Eric, 2026-09-15). */
export const CONSOLIDATION_STABILITY = 50

/** Which vector column a platform is read against (§3.6): Infantry / Vehicle / Tank / Anti-Air. */
export function columnFor(platform: PlatformId): number {
  switch (platform) {
    case 'infantry':
      return 0
  }
}

/**
 * The single partitioned roll (§5.1): attacker %, defender %, remainder is a push. A side with no
 * relevant vector value can't score at all; the advantaged side adds the raw point gap, capped.
 */
export function engagementChances(attackValue: number, defendValue: number): { attacker: number; defender: number } {
  const chance = (own: number, other: number) =>
    own <= 0 ? 0 : own > other ? Math.min(ADVANTAGE_CAP_PERCENT, BASE_HIT_PERCENT + (own - other)) : BASE_HIT_PERCENT
  return { attacker: chance(attackValue, defendValue), defender: chance(defendValue, attackValue) }
}

/** Piercing vs Armor (GDD §8.6): Armor 0 → full damage; else 20% + 60% × min(1, Piercing ÷ Armor). */
export function pierceMultiplier(piercing: number, armor: number): number {
  if (armor <= 0) return 1
  return 0.2 + 0.6 * Math.min(1, piercing / armor)
}

/** Survival check (§5.1): destruction probability = damage ÷ (damage + health), damage post-piercing. */
export function destructionChance(damage: number, health: number): number {
  if (damage <= 0) return 0
  return damage / (damage + health)
}

/** Partisan bonus for the invader (GDD §8.6.3): floor((50 − Stability) ÷ 5) below 50% Stability, else 0. */
export function partisanBonus(stability: number): number {
  return stability < 50 ? Math.floor((50 - stability) / 5) : 0
}

/** Shock multiplier from the attacker's average Front Line Combat Speed (GDD §8.6.2). */
export function shockMultiplier(averageCombatSpeed: number): number {
  return averageCombatSpeed * SHOCK_PER_MPH
}

/** Defensibility → defending-vector multiplier (§3.6): 1 + D ÷ 100. */
export function defenseMultiplier(region: LandRegion): number {
  return 1 + defensibility(region) / 100
}

/** Inverse-cost targeting weights (§5.1): (1 ÷ cost) ÷ Σ(1 ÷ cost). */
export function inverseCostWeights(costs: number[]): number[] {
  const inv = costs.map((c) => 1 / Math.max(c, 1e-9))
  const sum = inv.reduce((s, v) => s + v, 0)
  return inv.map((v) => v / sum)
}

/** Each unit of a line operates at this fraction of nominal (§3.10 linear Manpower fill). */
export function manpowerFraction(line: CompositionLine, stats: DesignStats): number {
  if (line.equipment <= 0 || stats.manpower <= 0) return 0
  return Math.min(1, line.manpower / (line.equipment * stats.manpower))
}

/** A unit's Organization contribution: the platform's value, scaled by its Manpower fill. */
export function unitOrganization(line: CompositionLine, stats: DesignStats): number {
  return stats.organization * manpowerFraction(line, stats)
}

/** Sum of every filled unit's contribution (§3.6: additive across the Task Force). */
export function maxOrganization(state: GameState, tf: TaskForce): number {
  let total = 0
  for (const line of tf.composition) {
    const design = findDesign(state, tf.faction, line.designId)
    if (!design) continue
    total += line.equipment * unitOrganization(line, designStats(design.platform, design.modules))
  }
  return total
}

export function organization(state: GameState, tf: TaskForce): number {
  return Math.max(0, maxOrganization(state, tf) - tf.organizationLost)
}

/** The design and stats behind a line, or undefined if the design is gone. */
export function lineStats(
  state: GameState,
  tf: TaskForce,
  designId: number,
): { design: UnitDesign; stats: DesignStats; line: CompositionLine } | undefined {
  const line = tf.composition.find((l) => l.designId === designId)
  const design = findDesign(state, tf.faction, designId)
  if (!line || !design) return undefined
  return { design, stats: designStats(design.platform, design.modules), line }
}
