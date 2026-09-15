// Domain control (Epoch 2 skeleton §1.1–1.3), computed fresh — never stored. Three states: ambient
// access (100), denial by hostility (0), and the graduated contest that exists only while two Task
// Forces are actively exchanging fire, read straight off the live battle. Maritime denial waits for
// naval presence.

import { atWarWith, factionRelation } from '../relations'
import type { FactionId, GameState, Region } from '../types'
import { isLand } from '../types'

/** Below this a region is denied to the faction: Energy can't route through it, movement is at Combat Speed. */
export const PERMISSIVE_THRESHOLD = 50

export function isPermissive(state: GameState, faction: FactionId, region: Region): boolean {
  return domainControl(state, faction, region) >= PERMISSIVE_THRESHOLD
}

/**
 * A faction's Air (land) or Sea (maritime) superiority over a region, 0–100.
 * - While a battle involving this faction touches the region, the battle's per-tick number (§1.3);
 *   the two sides' values are complements, and third parties are unaffected (bilateral, §1.1).
 * - Land, controlled: 100 for the controller and anyone Friendly/Neutral with it; 0 if Hostile.
 * - Land, unaffiliated: 100 unless a country the faction controls is At War with the region's country.
 * - Maritime: 100 for everyone until naval presence exists.
 */
export function domainControl(state: GameState, faction: FactionId, region: Region): number {
  for (const b of state.battles) {
    if (b.endedAt !== null) continue
    const isAttacker = b.attacker.faction === faction
    const isDefender = b.defender.faction === faction
    if (!isAttacker && !isDefender) continue
    if (b.regionId === region.id) return isAttacker ? b.airSuperiority.contested : 100 - b.airSuperiority.contested
    if (b.attackerRegionId === region.id)
      return isAttacker ? b.airSuperiority.attackerHome : 100 - b.airSuperiority.attackerHome
  }
  if (!isLand(region)) return 100
  if (region.controller === null) return atWarWith(state, faction, region.country) ? 0 : 100
  return factionRelation(state, faction, region.controller) === 'hostile' ? 0 : 100
}
