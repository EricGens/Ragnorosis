import type { LandRegion } from '../types'
import { perCapitaGdp } from './economy'

/** Per-capita GDP → anchor input: 10 at ≤$1,000, 90 at ≥$200,000, linear between (midpoint 50 at $100,500). */
export function gdpStabilityInput(perCapita: number): number {
  const t = Math.min(1, Math.max(0, (perCapita - 1000) / 199000))
  return 10 + 80 * t
}

/**
 * Stability's anchor: the mean of currently-active inputs. Popularity (of the controlling faction)
 * counts only when a controller exists; Task Force presence arrives in a later epoch.
 */
export function stabilityAnchor(region: LandRegion): number {
  const inputs = [gdpStabilityInput(perCapitaGdp(region))]
  if (region.controller) inputs.push(region.popularity[region.controller])
  return inputs.reduce((a, b) => a + b, 0) / inputs.length
}

export const DRIFT_FRACTION = 0.1
export const DRIFT_FLOOR = 0.1

/** Once per Pulse: move 10% of the way to the anchor, at least 0.1, never overshooting. */
export function driftStability(current: number, anchor: number): number {
  const delta = anchor - current
  if (delta === 0) return current
  const step = Math.min(Math.abs(delta), Math.max(DRIFT_FLOOR, DRIFT_FRACTION * Math.abs(delta)))
  return current + Math.sign(delta) * step
}
