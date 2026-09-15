// Domain control (Epoch 2 skeleton §1.1–1.3), computed fresh — never stored. Before Task Forces
// exist only the ambient and denial states apply; the graduated combat-contest percentage arrives
// with combat resolution, and maritime denial with Task Force presence.

import { atWarWith, factionRelation } from '../relations'
import type { FactionId, GameState, Region } from '../types'
import { isLand } from '../types'

/**
 * A faction's Air (land) or Sea (maritime) superiority over a region, 0–100.
 * - Land, controlled: 100 for the controller and anyone Friendly/Neutral with it; 0 if Hostile.
 * - Land, unaffiliated: 100 unless a country the faction controls is At War with the region's country.
 * - Maritime: 100 — denial needs a hostile Task Force physically present (a declared hostility alone
 *   is a paper blockade), so until TFs exist every maritime region is open to everyone.
 */
export function domainControl(state: GameState, faction: FactionId, region: Region): number {
  if (!isLand(region)) return 100
  if (region.controller === null) return atWarWith(state, faction, region.country) ? 0 : 100
  return factionRelation(state, faction, region.controller) === 'hostile' ? 0 : 100
}
