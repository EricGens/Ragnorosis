import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { RegionPanel } from './RegionPanel'

/**
 * The generic hover/pin display (skeleton §2.2). Shows the hovered entity as a preview; when
 * nothing is hovered, shows the pinned entity. Dispatches on entity kind so Task Forces and
 * Agents can add their own panel body later without new plumbing.
 */
export function EntityPanel() {
  const hovered = useUIStore((s) => s.hovered)
  const pinned = useUIStore((s) => s.pinned)
  const unpin = useUIStore((s) => s.unpin)
  const perspective = useGameStore((s) => s.activeFaction)
  const regions = useGameStore((s) => s.game.regions)

  const shown = hovered ?? pinned
  if (!shown) return null

  switch (shown.kind) {
    case 'region': {
      const region = regions[shown.id]
      if (!region) return null
      return <RegionPanel region={region} perspective={perspective} pinned={hovered === null} onClose={unpin} />
    }
  }
}
