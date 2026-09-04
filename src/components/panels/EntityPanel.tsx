import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { RegionPanel } from './RegionPanel'

/**
 * The generic hover/pin display (skeleton §2.2). With nothing pinned, shows whatever is hovered
 * as a preview. Once something is pinned, it displays exclusively — hovering other entities no
 * longer changes what's shown; only clicking a different entity or unpinning does. Dispatches on
 * entity kind so Task Forces and Agents can add their own panel body later without new plumbing.
 */
export function EntityPanel() {
  const hovered = useUIStore((s) => s.hovered)
  const pinned = useUIStore((s) => s.pinned)
  const unpin = useUIStore((s) => s.unpin)
  const perspective = useGameStore((s) => s.activeFaction)
  const regions = useGameStore((s) => s.game.regions)

  const shown = pinned ?? hovered
  if (!shown) return null

  switch (shown.kind) {
    case 'region': {
      const region = regions[shown.id]
      if (!region) return null
      return <RegionPanel region={region} perspective={perspective} pinned={pinned !== null} onClose={unpin} />
    }
  }
}
