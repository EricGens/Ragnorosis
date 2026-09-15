// Unit designs: a platform plus a module multiset (Epoch 2 skeleton §3, §6 Unit Editor). Stats are
// computed from the design, never stored (compute, don't store).

import type { UnitDesign } from '../types'
import { PLATFORMS, type ModuleId, type PlatformId, type SlotKind, type Vector } from './platforms'

export interface DesignStats {
  cost: number
  supply: number
  vector: Vector
  piercing: number
  damage: number
  armor: number
  speed: { combat: number; transit: number }
  organization: number
  health: number
  manpower: number
  weight: number
  radar: number
  isr: number
  /** Any column carries a long-range value → eligible for the Deep Strike line (§5.2). */
  standoffCapable: boolean
}

function addVectors(a: Vector, b: Vector): Vector {
  return a.map((entry, i) => ({
    short: entry.short + b[i].short,
    long: entry.long === null && b[i].long === null ? null : (entry.long ?? 0) + (b[i].long ?? 0),
  })) as Vector
}

/** Module-additive stats over the platform base (§3.6). Rounded to 1 decimal where fractions occur. */
export function designStats(platform: PlatformId, modules: ModuleId[]): DesignStats {
  const p = PLATFORMS[platform]
  const stats: DesignStats = {
    cost: 0,
    supply: 0,
    vector: [
      { short: 0, long: null },
      { short: 0, long: null },
      { short: 0, long: null },
      { short: 0, long: null },
    ],
    piercing: 0,
    damage: 0,
    armor: p.armor,
    speed: { ...p.speed },
    organization: p.organization,
    health: p.health,
    manpower: p.manpower,
    weight: p.weight,
    radar: 0,
    isr: 0,
    standoffCapable: false,
  }
  for (const id of modules) {
    const m = p.modules.find((d) => d.id === id)
    if (!m) throw new Error(`Module "${id}" is not in ${platform}'s catalog`)
    stats.cost += m.cost
    stats.supply += m.supply
    stats.vector = addVectors(stats.vector, m.vector)
    stats.piercing += m.piercing
    if (m.slot === 'weapon') stats.damage += m.damage
    stats.armor += m.armor ?? 0
    if (m.speed) {
      stats.speed.combat += m.speed.combat
      stats.speed.transit += m.speed.transit
    }
    stats.radar += m.radar ?? 0
    stats.isr += m.isr ?? 0
  }
  stats.supply = Math.round(stats.supply * 10) / 10
  stats.standoffCapable = stats.vector.some((e) => e.long !== null)
  return stats
}

/** Why a design can't be saved, if anything (§6 Unit Editor validation). Empty = valid. */
export function designProblems(platform: PlatformId, modules: ModuleId[]): string[] {
  const p = PLATFORMS[platform]
  const problems: string[] = []
  const counts: Record<SlotKind, number> = { weapon: 0, engine: 0, misc: 0 }
  const seen = new Map<ModuleId, number>()
  for (const id of modules) {
    const m = p.modules.find((d) => d.id === id)
    if (!m) {
      problems.push(`${id} is not available on ${p.name}`)
      continue
    }
    counts[m.slot] += 1
    seen.set(id, (seen.get(id) ?? 0) + 1)
    if ((seen.get(id) ?? 0) > 1 && !(m.slot === 'weapon' && p.weaponDuplicates)) {
      problems.push(`${m.name} can only be equipped once`)
    }
  }
  for (const slot of ['weapon', 'engine', 'misc'] as SlotKind[]) {
    const { min, max } = p.slots[slot]
    if (counts[slot] < min) problems.push(`${p.name} requires ${min} ${slot} module${min > 1 ? 's' : ''}`)
    if (counts[slot] > max) problems.push(`${p.name} allows at most ${max} ${slot} module${max > 1 ? 's' : ''}`)
  }
  return [...new Set(problems)]
}

/** The platform's auto-generated name for this module set. */
export function autoName(platform: PlatformId, modules: ModuleId[]): string {
  return PLATFORMS[platform].autoName(modules)
}

/** Multiset equality — slot order never matters, counts do (§6 duplicate detection). */
export function sameModules(a: ModuleId[], b: ModuleId[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((id, i) => id === sortedB[i])
}

/** An existing design with the same platform and module multiset, if any. */
export function findDuplicate(
  designs: UnitDesign[],
  platform: PlatformId,
  modules: ModuleId[],
  exceptId?: number,
): UnitDesign | undefined {
  return designs.find((d) => d.id !== exceptId && d.platform === platform && sameModules(d.modules, modules))
}
