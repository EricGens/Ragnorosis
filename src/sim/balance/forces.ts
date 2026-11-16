// A catalog of unit designs and force-building helpers for balance work. Add designs here as the
// module catalog grows; the report (report.test.ts) and ad-hoc experiments both draw on it.

import type { DesignInput } from '../military/roster'
import type { PlatformId } from '../types'
import { forceCost, type Force } from './arena'

const design = (name: string, platform: PlatformId, ...modules: string[]): DesignInput => ({ name, platform, modules })

export const DESIGNS = {
  lightInf: design('Light Infantry', 'infantry', 'inf-small-arms-1'),
  atInf: design('AT Infantry', 'infantry', 'inf-small-arms-1', 'inf-man-at'),
  aaInf: design('AA Infantry', 'infantry', 'inf-small-arms-1', 'inf-man-aa'),
  heavyInf: design('Heavy Infantry', 'infantry', 'inf-small-arms-1', 'inf-man-at', 'inf-man-aa'),
  utility: design('Light Utility Vehicle', 'vehicle', 'veh-csw-1', 'veh-diesel-1'),
  recon: design('Recon Vehicle', 'vehicle', 'veh-autocannon-1', 'veh-diesel-1'),
  apc: design('APC', 'vehicle', 'veh-autocannon-1', 'veh-diesel-1', 'veh-reactive-armor'),
  ifv: design('IFV', 'tank', 'tank-autocannon-1', 'tank-diesel-1'),
  mbt: design('MBT', 'tank', 'tank-cannon-1', 'tank-diesel-1'),
  /** MBT with Crew Served Weapons and a Targeting Computer: +20 Production for +7 vs Infantry. */
  mbtPlus: design('MBT+', 'tank', 'tank-cannon-1', 'tank-diesel-1', 'tank-csw', 'tank-targeting-1'),
  towed: design('Towed Artillery', 'artillery', 'art-tube'),
  mlrs: design('MLRS', 'artillery', 'art-rocket'),
  cas: design('CAS Aircraft', 'light-aircraft', 'la-pgm', 'la-turbofan'),
} satisfies Record<string, DesignInput>

/** A force of several unit types. Earlier entries claim line slots first; overflow waits in Reserves. */
export function mix(name: string, ...units: [DesignInput, number][]): Force {
  return { name, units }
}

/** As many of one design as `budget` Production buys. */
export function pure(budget: number, d: DesignInput, name = d.name): Force {
  const unit = forceCost({ name, units: [[d, 1]] }).cost
  return { name, units: [[d, Math.floor(budget / unit)]] }
}
