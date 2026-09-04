import type { FactionId } from '../types'

export interface FactionDef {
  id: FactionId
  name: string
  /** Selectable at the title screen. Red Queen is not, but is reachable via devtools. */
  playable: boolean
  /** What this faction calls the Popularity stat in its own UI. */
  popularityLabel: string
}

export const FACTIONS: Record<FactionId, FactionDef> = {
  'mankind-united': { id: 'mankind-united', name: 'Mankind United', playable: true, popularityLabel: 'Popularity' },
  china: { id: 'china', name: 'China', playable: true, popularityLabel: 'Popularity' },
  'united-states': { id: 'united-states', name: 'United States', playable: true, popularityLabel: 'RBO' },
  widows: { id: 'widows', name: 'The Widows', playable: true, popularityLabel: 'Popularity' },
  laserward: { id: 'laserward', name: 'LaserWard', playable: true, popularityLabel: 'Popularity' },
  hive: { id: 'hive', name: 'The Hive', playable: true, popularityLabel: 'Popularity' },
  gamer: { id: 'gamer', name: 'The Gamer', playable: true, popularityLabel: 'Popularity' },
  'red-queen': { id: 'red-queen', name: 'Red Queen', playable: false, popularityLabel: 'Popularity' },
}

export const PLAYABLE_FACTIONS: FactionDef[] = Object.values(FACTIONS).filter((f) => f.playable)
