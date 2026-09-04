import type { FactionId } from '../sim/types'

const COLORS: Record<FactionId, string> = {
  'mankind-united': '#f28c28',
  china: '#ff3b3b',
  'united-states': '#3b82f6',
  widows: '#a855f7',
  laserward: '#22d3ee',
  hive: '#eab308',
  gamer: '#4ade80',
  'red-queen': '#ff2d95',
}

export function factionColor(id: FactionId): string {
  return COLORS[id]
}
