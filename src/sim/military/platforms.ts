// Platform and module catalog (Epoch 2 skeleton §3.1–3.6). Modules are platform-specific catalog
// entries, not a shared pool: two platforms may carry same-named modules with different numbers by
// design (§3.4). Every design's stats are the module-additive sum over its base platform (§3.6).

export type PlatformId = 'infantry'
export type ModuleId = string
export type SlotKind = 'weapon' | 'engine' | 'misc'

/** One combat-vector column: value at short/CAS range, and at long/standoff range (null = no standoff capability). */
export interface VectorEntry {
  short: number
  long: number | null
}

/** Columns: Infantry, Vehicle, Tank, Anti-Air (§3.6). */
export type Vector = [VectorEntry, VectorEntry, VectorEntry, VectorEntry]
export const VECTOR_COLUMNS = ['Infantry', 'Vehicle', 'Tank', 'Anti-Air'] as const

export function v(inf: number, veh: number, tank: number, aa: number): Vector {
  return [
    { short: inf, long: null },
    { short: veh, long: null },
    { short: tank, long: null },
    { short: aa, long: null },
  ]
}

export const ZERO_VECTOR: Vector = v(0, 0, 0, 0)

export interface ModuleDef {
  id: ModuleId
  name: string
  slot: SlotKind
  cost: number
  supply: number
  vector: Vector
  piercing: number
  /** Only Main Weapon modules ever carry damage (§3.4 rule). */
  damage: number
  armor?: number
  speed?: { combat: number; transit: number }
  radar?: number
  isr?: number
}

export interface SlotRange {
  min: number
  max: number
}

export interface PlatformDef {
  id: PlatformId
  name: string
  slots: Record<SlotKind, SlotRange>
  /** Whether the same weapon module may fill several weapon slots (Light Aircraft only, §3.5). */
  weaponDuplicates: boolean
  speed: { combat: number; transit: number }
  organization: number
  health: number
  manpower: number
  weight: number
  armor: number
  /** This platform's own module catalog. */
  modules: ModuleDef[]
  /** The platform's naming rule over the equipped module set (§3.1–3.5). */
  autoName: (modules: ModuleId[]) => string
}

// ---------------------------------------------------------------------------------------------
// Infantry (§3.1)

// One row per module, mirroring the skeleton's tables.
// prettier-ignore
const INFANTRY_MODULES: ModuleDef[] = [
  { id: 'inf-small-arms-1', name: 'Small Arms I', slot: 'weapon', cost: 50, supply: 1.0, vector: v(5, 3, 0, 0), piercing: 0, damage: 5 },
  { id: 'inf-man-at', name: 'Man-portable AT', slot: 'misc', cost: 10, supply: 0.1, vector: v(1, 5, 5, 0), piercing: 5, damage: 0 },
  { id: 'inf-man-aa', name: 'Man-portable AA', slot: 'misc', cost: 10, supply: 0.1, vector: v(0, 0, 0, 5), piercing: 0, damage: 0 },
]

export const INFANTRY: PlatformDef = {
  id: 'infantry',
  name: 'Infantry',
  slots: { weapon: { min: 1, max: 1 }, engine: { min: 0, max: 0 }, misc: { min: 0, max: 2 } },
  weaponDuplicates: false,
  speed: { combat: 5, transit: 30 },
  organization: 25,
  health: 10,
  manpower: 50,
  weight: 1,
  armor: 0,
  modules: INFANTRY_MODULES,
  autoName: (modules) => {
    const at = modules.includes('inf-man-at')
    const aa = modules.includes('inf-man-aa')
    if (at && aa) return 'Heavy Infantry'
    if (at) return 'AT Infantry'
    if (aa) return 'AA Infantry'
    return 'Light Infantry'
  },
}

export const PLATFORMS: Record<PlatformId, PlatformDef> = { infantry: INFANTRY }
export const PLATFORM_IDS: readonly PlatformId[] = Object.keys(PLATFORMS) as PlatformId[]

export function moduleDef(platform: PlatformId, id: ModuleId): ModuleDef {
  const def = PLATFORMS[platform].modules.find((m) => m.id === id)
  if (!def) throw new Error(`Module "${id}" is not in ${platform}'s catalog`)
  return def
}
