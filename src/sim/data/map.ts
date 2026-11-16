// What an authored map is. The simulation only ever sees a MapDefinition (via createInitialState), so
// a new map — the full 190-region one, a test fixture — is a new data file of this shape, not new code.
// `layout` is the one part the sim ignores: it tells the map renderer where each region is drawn.

import type { Region, RegionId } from '../types'

/** Authored map: regions plus each undirected edge listed once. */
export interface MapDefinition {
  regions: Region[]
  edges: [RegionId, RegionId][]
  /** Edge lengths in miles where they differ from DEFAULT_DISTANCE (Epoch 2 skeleton §4.1). */
  distances?: [RegionId, RegionId, number][]
  layout: Record<RegionId, MapLayout>
}

/** Length of any edge a map doesn't list under `distances` — the dummy map's flat 300 miles (§4.1). */
export const DEFAULT_DISTANCE = 300

/** Where a region sits on the rendered map. Land regions occupy grid cells; maritime regions wrap a corner. */
export type MapLayout =
  { kind: 'grid'; col: number; row: number } | { kind: 'corner'; corner: 'nw' | 'ne' | 'sw' | 'se' }
