import type { GameState } from './types'

/** mulberry32: small, fast, deterministic. Returns [0, 1) and the next seed. */
export function mulberry32(seed: number): { value: number; next: number } {
  let t = (seed + 0x6d2b79f5) | 0
  let r = Math.imul(t ^ (t >>> 15), 1 | t)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return { value: ((r ^ (r >>> 14)) >>> 0) / 4294967296, next: t }
}

/** Draw a random number from the state's seed, advancing it. Call on an Immer draft. */
export function nextRandom(state: GameState): number {
  const { value, next } = mulberry32(state.rngSeed)
  state.rngSeed = next
  return value
}
