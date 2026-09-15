// Production allocation (skeleton §4.3, decisions doc "Production pool & cadence").
// Aggregate Production is split by societal focus, then overflow from capped/empty categories is
// rerouted proportionally to the receiving categories' current shares. Allocation floors and
// discards fractions (frictional loss); nothing here accumulates toward a threshold.

import type { Focus, ProductionAllocation, ProductionCategory } from '../types'

export const FOCUS_SPLIT: Record<Focus, Record<ProductionCategory, number>> = {
  balanced: { equipment: 1 / 3, manpower: 1 / 3, construction: 1 / 3 },
  equipment: { equipment: 0.5, manpower: 0.25, construction: 0.25 },
  manpower: { equipment: 0.25, manpower: 0.5, construction: 0.25 },
  construction: { equipment: 0.25, manpower: 0.25, construction: 0.5 },
}

export const FOCUSES: readonly Focus[] = ['balanced', 'equipment', 'manpower', 'construction']

export interface AllocationInputs {
  /** How much more Manpower the pool can hold before hitting the 2% cap. */
  manpowerCapRoom: number
  /**
   * How much Equipment Production has somewhere to go: unfilled Task Force demand plus stockpile
   * room, in allocation points (Epoch 2 skeleton §3.9 — once every SKU is at cap, Equipment-focus
   * Production reroutes exactly like a capped Manpower pool).
   */
  equipmentRoom: number
  /** Whether any construction project can receive progress. */
  hasProjects: boolean
}

export function allocateProduction(total: number, focus: Focus, inputs: AllocationInputs): ProductionAllocation {
  const split = FOCUS_SPLIT[focus]
  const shares: Record<ProductionCategory, number> = {
    equipment: Math.floor(total * split.equipment),
    manpower: Math.floor(total * split.manpower),
    construction: Math.floor(total * split.construction),
  }
  const manpowerRoom = Math.max(0, Math.floor(inputs.manpowerCapRoom))
  const equipmentRoom = Math.max(0, Math.floor(inputs.equipmentRoom))
  let warning = false

  // Reroute until stable: a receiver can itself hit its cap after receiving overflow.
  for (let pass = 0; pass < 4; pass++) {
    let pool = 0
    if (!inputs.hasProjects && shares.construction > 0) {
      pool += shares.construction
      shares.construction = 0
    }
    if (shares.manpower > manpowerRoom) {
      pool += shares.manpower - manpowerRoom
      shares.manpower = manpowerRoom
    }
    if (shares.equipment > equipmentRoom) {
      pool += shares.equipment - equipmentRoom
      shares.equipment = equipmentRoom
    }
    if (pool === 0) break

    const receivers: ProductionCategory[] = []
    if (shares.equipment < equipmentRoom) receivers.push('equipment')
    if (shares.manpower < manpowerRoom) receivers.push('manpower')
    if (inputs.hasProjects) receivers.push('construction')
    if (receivers.length === 0) {
      warning = true
      break
    }
    const weightSum = receivers.reduce((s, c) => s + shares[c], 0)
    for (const c of receivers) {
      const weight = weightSum > 0 ? shares[c] / weightSum : 1 / receivers.length
      shares[c] += Math.floor(pool * weight)
    }
  }

  return { total, ...shares, warning }
}
