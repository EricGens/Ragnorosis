import type { BuildingType } from '../types'

export interface BuildingDef {
  id: BuildingType
  name: string
  /** Production cost of level 1. */
  baseCost: number
  /** Level cap, if any. Only Fortification has one in Epoch 1. */
  maxLevel?: number
  description: string
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  'fossil-fuel-plant': {
    id: 'fossil-fuel-plant',
    name: 'Fossil Fuel Plant',
    baseCost: 1000,
    description: 'Converts Energy into Production: 100 per level, consuming 100 Energy per level. Output is curtailed 1:1 by any Energy shortfall.',
  },
  'renewable-plant': {
    id: 'renewable-plant',
    name: 'Renewable Plant',
    baseCost: 1700,
    description: 'Self-contained Production: 100 per level, halved while Weather is active. Needs no Energy and is immune to blockade.',
  },
  'production-facility': {
    id: 'production-facility',
    name: 'Production Facility',
    baseCost: 1400,
    description: 'Each level converts Production into Equipment 20% more efficiently.',
  },
  'training-facility': {
    id: 'training-facility',
    name: 'Training Facility',
    baseCost: 1000,
    description: 'Each level converts Population into Manpower 20% more efficiently.',
  },
  fortification: {
    id: 'fortification',
    name: 'Fortification',
    baseCost: 2000,
    maxLevel: 10,
    description: '+5 Defensibility per level, up to level 10.',
  },
}

export const BUILDING_TYPES: readonly BuildingType[] = Object.keys(BUILDINGS) as BuildingType[]

/** Escalating stack cost: each level ~5% costlier than the last. */
export const COST_GROWTH = 1.05

/** Production cost to build the given level of a building type. */
export function buildingCost(type: BuildingType, level: number): number {
  return BUILDINGS[type].baseCost * COST_GROWTH ** (level - 1)
}
