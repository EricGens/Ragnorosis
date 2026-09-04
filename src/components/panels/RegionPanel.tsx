import { FACTIONS } from '../../sim/data/factions'
import type { FactionId, Region } from '../../sim/types'
import { isLand } from '../../sim/types'
import { useDisplayGame } from '../../store/gameStore'
import { factionColor } from '../factionColors'
import { BuildingGrid } from './BuildingGrid'
import { PANEL_WIDTH } from './gameArea'
import { regionDisplay } from './regionStats'
import { StatRow } from './StatRow'

// Placeholder "terrain image": gradients until real art exists (forest/plains for land, ocean for sea).
const BACKGROUNDS: Record<Region['type'], string> = {
  land: 'linear-gradient(160deg, #234a33 0%, #14301f 45%, #0b1a12 100%)',
  maritime: 'linear-gradient(160deg, #1a3f63 0%, #102a44 45%, #07111c 100%)',
}

export function RegionPanel({
  region,
  perspective,
  pinned,
  onClose,
}: {
  region: Region
  perspective: FactionId
  pinned: boolean
  onClose: () => void
}) {
  const game = useDisplayGame()
  const { header, stats } = regionDisplay(game, region, perspective)

  return (
    <aside
      className="absolute top-4 left-4 z-10 max-h-[calc(100%-2rem)] overflow-y-auto rounded border border-ink-600 shadow-2xl"
      style={{ width: PANEL_WIDTH, backgroundImage: BACKGROUNDS[header.type] }}
      aria-label={`${header.name} panel`}
    >
      <div className="bg-ink-950/70 p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg tracking-[0.15em] text-ink-100 uppercase">{header.name}</h2>
            <div className="mt-1 text-xs">
              {header.controller ? (
                <span style={{ color: factionColor(header.controller) }}>{FACTIONS[header.controller].name}</span>
              ) : header.type === 'land' ? (
                <span className="text-ink-400">Unaffiliated</span>
              ) : null}
              {header.country && <span className="text-ink-200"> · {header.country}</span>}
            </div>
          </div>
          {pinned ? (
            <button type="button" onClick={onClose} aria-label="Unpin panel" className="text-ink-400 hover:text-ink-100">
              ×
            </button>
          ) : (
            <span className="text-[10px] tracking-[0.15em] text-ink-400 uppercase">Preview</span>
          )}
        </div>

        {header.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {header.tags.map((t) => (
              <span key={t} className="rounded border border-ink-600 px-1.5 py-0.5 text-[10px] tracking-wider text-ink-200 uppercase">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mb-3 flex gap-4 text-xs">
          {header.superiority.air !== undefined && <Superiority label="Air" value={header.superiority.air} />}
          {header.superiority.sea !== undefined && <Superiority label="Sea" value={header.superiority.sea} />}
        </div>

        <div className="-mx-2 border-t border-ink-700 pt-2">
          {stats.map((stat) => (
            <StatRow key={stat.key} stat={stat} />
          ))}
        </div>

        {isLand(region) && <BuildingGrid region={region} perspective={perspective} />}
      </div>
    </aside>
  )
}

function Superiority({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-ink-200">
      <span className="tracking-[0.15em] text-ink-400 uppercase">{label} superiority</span>{' '}
      <span className={value >= 50 ? 'text-ink-100' : 'text-alert'}>{value}%</span>
    </span>
  )
}
