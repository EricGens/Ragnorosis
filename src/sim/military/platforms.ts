// Platform and module catalog (Epoch 2 skeleton §3.1–3.6). Modules are platform-specific catalog
// entries, not a shared pool: two platforms may carry same-named modules with different numbers by
// design (§3.4). Every design's stats are the module-additive sum over its base platform (§3.6).

import type { PlatformId } from '../types'

export type { PlatformId } from '../types'
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

/** Parse the skeleton's `X(Y)` notation per column: "8(8)" → short 8, long 8; "5" → short 5, no standoff. */
export function vx(inf: string, veh: string, tank: string, aa: string): Vector {
  const parse = (s: string): VectorEntry => {
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*(?:\(\s*(-?\d+(?:\.\d+)?)\s*\))?\s*$/.exec(s)
    if (!m) throw new Error(`Bad vector entry "${s}"`)
    return { short: Number(m[1]), long: m[2] === undefined ? null : Number(m[2]) }
  }
  return [parse(inf), parse(veh), parse(tank), parse(aa)]
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
  /** Weapon target domain, for Light Aircraft's category-based naming (§3.5). */
  role?: 'ground' | 'air'
}

export interface SlotRange {
  min: number
  max: number
}

export interface PlatformDef {
  id: PlatformId
  name: string
  /** Ground platforms set Task Force speed and may hold the line; aircraft do neither (§4.5, §5.1). */
  kind: 'ground' | 'air'
  /** Which combat lines this platform may be assigned to; Long-Range follows standoff capability. */
  roles: { frontLine: boolean; cas: boolean }
  /** The vector column other units read this platform against (§3.3: Artillery uses Vehicle's). */
  column: 0 | 1 | 2 | 3
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

/** "Base (tag/tag)" — the shared suffix style every platform's misc modules use. */
function named(base: string, tags: string[]): string {
  return tags.length > 0 ? `${base} (${tags.join('/')})` : base
}

// ---------------------------------------------------------------------------------------------
// Infantry (§3.1)

// One row per module, mirroring the skeleton's tables.
// prettier-ignore
const INFANTRY_MODULES: ModuleDef[] = [
  { id: 'inf-small-arms-1', name: 'Small Arms I', slot: 'weapon', cost: 50, supply: 1.0, vector: v(5, 3, 0, 0), piercing: 0, damage: 5, role: 'ground' },
  { id: 'inf-man-at', name: 'Man-portable AT', slot: 'misc', cost: 10, supply: 0.1, vector: v(1, 5, 5, 0), piercing: 5, damage: 0 },
  { id: 'inf-man-aa', name: 'Man-portable AA', slot: 'misc', cost: 10, supply: 0.1, vector: v(0, 0, 0, 5), piercing: 0, damage: 0 },
]

export const INFANTRY: PlatformDef = {
  id: 'infantry',
  name: 'Infantry',
  kind: 'ground',
  roles: { frontLine: true, cas: false },
  column: 0,
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

// ---------------------------------------------------------------------------------------------
// Vehicle (§3.2)

// prettier-ignore
const VEHICLE_MODULES: ModuleDef[] = [
  { id: 'veh-csw-1', name: 'Crew-Served Weapons I', slot: 'weapon', cost: 50, supply: 1.0, vector: v(5, 3, 0, 0), piercing: 0, damage: 5, role: 'ground' },
  { id: 'veh-autocannon-1', name: 'Autocannon I', slot: 'weapon', cost: 100, supply: 2.0, vector: v(8, 8, 3, 3), piercing: 5, damage: 10, role: 'ground' },
  { id: 'veh-diesel-1', name: 'Diesel Engine I', slot: 'engine', cost: 50, supply: 2.5, vector: ZERO_VECTOR, piercing: 0, damage: 0 },
  { id: 'veh-cs-at', name: 'Crew-Served AT', slot: 'misc', cost: 10, supply: 0.1, vector: v(1, 5, 5, 0), piercing: 5, damage: 0 },
  { id: 'veh-cs-aa', name: 'Crew-Served AA', slot: 'misc', cost: 10, supply: 0.1, vector: v(0, 0, 0, 5), piercing: 0, damage: 0 },
  { id: 'veh-reactive-armor', name: 'Reactive Armor', slot: 'misc', cost: 50, supply: 0.5, vector: ZERO_VECTOR, piercing: 0, damage: 0, armor: 5, speed: { combat: -2, transit: -5 } },
  { id: 'veh-targeting-1', name: 'Targeting Computer I', slot: 'misc', cost: 10, supply: 0.1, vector: v(2, 2, 2, 5), piercing: 0, damage: 0 },
  { id: 'veh-radar-1', name: 'Radar I', slot: 'misc', cost: 25, supply: 0.5, vector: v(0, 0, 0, 5), piercing: 0, damage: 0, radar: 1 },
]

export const VEHICLE: PlatformDef = {
  id: 'vehicle',
  name: 'Vehicle',
  kind: 'ground',
  roles: { frontLine: true, cas: false },
  column: 1,
  slots: { weapon: { min: 1, max: 1 }, engine: { min: 1, max: 1 }, misc: { min: 0, max: 3 } },
  weaponDuplicates: false,
  speed: { combat: 10, transit: 30 },
  organization: 10,
  health: 15,
  manpower: 20,
  weight: 5,
  armor: 0,
  modules: VEHICLE_MODULES,
  autoName: (modules) => {
    const has = (id: ModuleId) => modules.includes(id)
    const autocannon = has('veh-autocannon-1')
    let base = autocannon ? 'Recon Vehicle' : has('veh-csw-1') ? 'Light Utility Vehicle' : 'Vehicle'
    if (has('veh-reactive-armor')) base = autocannon ? 'APC' : 'Light APC'
    const tags: string[] = []
    if (has('veh-cs-at')) tags.push('AT')
    if (has('veh-cs-aa')) tags.push('SHORAD')
    if (has('veh-targeting-1')) tags.push('AFCS')
    if (has('veh-radar-1')) tags.push('Radar')
    return named(base, tags)
  },
}

// ---------------------------------------------------------------------------------------------
// Artillery (§3.3) — matched against the Vehicle column, not its own.

// prettier-ignore
const ARTILLERY_MODULES: ModuleDef[] = [
  { id: 'art-tube', name: 'Tube Artillery', slot: 'weapon', cost: 100, supply: 2.0, vector: vx('8(8)', '8(8)', '5(5)', '0'), piercing: 5, damage: 10, role: 'ground' },
  { id: 'art-rocket', name: 'Rocket Artillery', slot: 'weapon', cost: 150, supply: 2.5, vector: vx('5(10)', '5(10)', '3(8)', '0'), piercing: 8, damage: 15, role: 'ground' },
  { id: 'art-diesel-1', name: 'Diesel Engine I', slot: 'engine', cost: 50, supply: 2.5, vector: ZERO_VECTOR, piercing: 0, damage: 0, speed: { combat: 5, transit: 0 } },
  { id: 'art-targeting-1', name: 'Targeting Computer I', slot: 'misc', cost: 10, supply: 0.1, vector: v(2, 2, 2, 0), piercing: 0, damage: 0 },
]

export const ARTILLERY: PlatformDef = {
  id: 'artillery',
  name: 'Artillery',
  kind: 'ground',
  roles: { frontLine: false, cas: false },
  column: 1,
  slots: { weapon: { min: 1, max: 1 }, engine: { min: 0, max: 1 }, misc: { min: 0, max: 1 } },
  weaponDuplicates: false,
  speed: { combat: 5, transit: 30 },
  organization: 5,
  health: 15,
  manpower: 15,
  weight: 5,
  armor: 0,
  modules: ARTILLERY_MODULES,
  autoName: (modules) => {
    const has = (id: ModuleId) => modules.includes(id)
    const engine = has('art-diesel-1')
    const tags: string[] = []
    let base = 'Artillery'
    if (has('art-rocket')) {
      base = engine ? 'Transporter Erector Launcher' : 'MLRS'
      if (engine) tags.push('TEL')
    } else if (has('art-tube')) {
      base = engine ? 'Self-Propelled Gun' : 'Towed Artillery'
    }
    if (has('art-targeting-1')) tags.push('AFCS')
    return named(base, tags)
  },
}

// ---------------------------------------------------------------------------------------------
// Tank (§3.4)

// prettier-ignore
const TANK_MODULES: ModuleDef[] = [
  { id: 'tank-autocannon-1', name: 'Autocannon I', slot: 'weapon', cost: 100, supply: 2.0, vector: v(8, 8, 3, 3), piercing: 5, damage: 10, role: 'ground' },
  { id: 'tank-cannon-1', name: 'Cannon I', slot: 'weapon', cost: 150, supply: 2.5, vector: v(10, 10, 8, 0), piercing: 10, damage: 15, role: 'ground' },
  { id: 'tank-diesel-1', name: 'Diesel Engine I', slot: 'engine', cost: 50, supply: 2.5, vector: ZERO_VECTOR, piercing: 0, damage: 0 },
  { id: 'tank-turbine-1', name: 'Gas Turbine Engine I', slot: 'engine', cost: 80, supply: 2.7, vector: ZERO_VECTOR, piercing: 0, damage: 0, speed: { combat: 2, transit: 0 } },
  { id: 'tank-csw', name: 'Crew Served Weapons', slot: 'misc', cost: 10, supply: 0.1, vector: v(5, 3, 0, 0), piercing: 0, damage: 0 },
  { id: 'tank-cs-at', name: 'Crew-served AT', slot: 'misc', cost: 10, supply: 0.1, vector: v(1, 5, 5, 0), piercing: 5, damage: 0 },
  { id: 'tank-cs-aa', name: 'Crew-served AA', slot: 'misc', cost: 10, supply: 0.1, vector: v(0, 0, 0, 5), piercing: 0, damage: 0 },
  { id: 'tank-reactive-armor', name: 'Reactive Armor', slot: 'misc', cost: 50, supply: 0.5, vector: ZERO_VECTOR, piercing: 0, damage: 0, armor: 5, speed: { combat: -2, transit: -5 } },
  { id: 'tank-targeting-1', name: 'Targeting Computer I', slot: 'misc', cost: 10, supply: 0.1, vector: v(2, 2, 2, 0), piercing: 0, damage: 0 },
]

export const TANK: PlatformDef = {
  id: 'tank',
  name: 'Tank',
  kind: 'ground',
  roles: { frontLine: true, cas: false },
  column: 2,
  slots: { weapon: { min: 1, max: 1 }, engine: { min: 1, max: 1 }, misc: { min: 0, max: 2 } },
  weaponDuplicates: false,
  speed: { combat: 8, transit: 30 },
  organization: 10,
  health: 25,
  manpower: 16,
  weight: 10,
  armor: 5,
  modules: TANK_MODULES,
  autoName: (modules) => {
    const has = (id: ModuleId) => modules.includes(id)
    const base = has('tank-cannon-1')
      ? 'Main Battle Tank'
      : has('tank-autocannon-1')
        ? 'Infantry Fighting Vehicle'
        : 'Tank'
    const tags: string[] = []
    if (has('tank-csw')) tags.push('Anti-personnel')
    if (has('tank-cs-at')) tags.push('AT')
    if (has('tank-cs-aa')) tags.push('SHORAD')
    if (has('tank-reactive-armor')) tags.push('AOA')
    if (has('tank-targeting-1')) tags.push('AFCS')
    return named(base, tags)
  },
}

// ---------------------------------------------------------------------------------------------
// Light Aircraft (§3.5) — CAS only this epoch; the naming rule already covers fighters for later.

// prettier-ignore
const LIGHT_AIRCRAFT_MODULES: ModuleDef[] = [
  { id: 'la-autocannon', name: 'Autocannon', slot: 'weapon', cost: 80, supply: 1.5, vector: v(8, 8, 3, 0), piercing: 2, damage: 5, role: 'ground' },
  { id: 'la-pgm', name: 'Precision Guided Munitions', slot: 'weapon', cost: 120, supply: 2.0, vector: v(12, 12, 10, 0), piercing: 5, damage: 15, role: 'ground' },
  { id: 'la-agm', name: 'Air-to-Ground Missiles', slot: 'weapon', cost: 180, supply: 2.8, vector: vx('10(5)', '10(5)', '8(4)', '0'), piercing: 4, damage: 10, role: 'ground' },
  { id: 'la-turbofan', name: 'Turbofan Engine', slot: 'engine', cost: 80, supply: 2.5, vector: ZERO_VECTOR, piercing: 0, damage: 0 },
  { id: 'la-targeting-pod', name: 'Targeting Pod', slot: 'misc', cost: 10, supply: 0.1, vector: v(2, 2, 2, 0), piercing: 0, damage: 0 },
  { id: 'la-ssr', name: 'Surface Search Radar', slot: 'misc', cost: 20, supply: 0.2, vector: v(2, 2, 2, 0), piercing: 0, damage: 0, isr: 1 },
]

export const LIGHT_AIRCRAFT: PlatformDef = {
  id: 'light-aircraft',
  name: 'Light Aircraft',
  kind: 'air',
  roles: { frontLine: false, cas: true },
  column: 3,
  slots: { weapon: { min: 1, max: 3 }, engine: { min: 1, max: 1 }, misc: { min: 0, max: 2 } },
  weaponDuplicates: true,
  speed: { combat: 300, transit: 300 },
  organization: 10,
  health: 20,
  manpower: 5,
  weight: 10,
  armor: 0,
  modules: LIGHT_AIRCRAFT_MODULES,
  autoName: (modules) => {
    const roles = new Set(
      modules
        .map((id) => LIGHT_AIRCRAFT_MODULES.find((m) => m.id === id))
        .filter((m): m is ModuleDef => m?.slot === 'weapon' && m.role !== undefined)
        .map((m) => m.role),
    )
    const base =
      roles.size === 0
        ? 'Light Aircraft'
        : roles.size > 1
          ? 'Multirole Fighter'
          : roles.has('air')
            ? 'Air Superiority Fighter'
            : 'CAS Aircraft'
    const tags: string[] = []
    if (modules.includes('la-targeting-pod')) tags.push('Targeting Pod')
    if (modules.includes('la-ssr')) tags.push('SAR')
    return named(base, tags)
  },
}

export const PLATFORMS: Record<PlatformId, PlatformDef> = {
  infantry: INFANTRY,
  vehicle: VEHICLE,
  artillery: ARTILLERY,
  tank: TANK,
  'light-aircraft': LIGHT_AIRCRAFT,
}
export const PLATFORM_IDS: readonly PlatformId[] = Object.keys(PLATFORMS) as PlatformId[]

export function moduleDef(platform: PlatformId, id: ModuleId): ModuleDef {
  const def = PLATFORMS[platform].modules.find((m) => m.id === id)
  if (!def) throw new Error(`Module "${id}" is not in ${platform}'s catalog`)
  return def
}
