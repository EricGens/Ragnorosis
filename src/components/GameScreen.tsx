import { DevtoolsButton, DevtoolsPanel } from './devtools/DevtoolsPanel'
import { InterruptNotice } from './InterruptNotice'
import { MapView } from './MapView'
import { MilitaryButton, MilitaryPanel } from './MilitaryPanel'
import { BuildingSelector } from './panels/BuildingSelector'
import { EntityPanel } from './panels/EntityPanel'
import { GAME_AREA_ID } from './panels/gameArea'
import { HoverTooltipWindow } from './panels/HoverTooltipWindow'
import { PinnedWindows } from './panels/PinnedWindows'
import { TopBar } from './TopBar'

export function GameScreen() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main id={GAME_AREA_ID} className="relative min-h-0 flex-1 overflow-hidden">
        <MapView />
        <EntityPanel />
        <HoverTooltipWindow />
        <PinnedWindows />
        <MilitaryButton />
        <MilitaryPanel />
        <InterruptNotice />
        <DevtoolsButton />
        <DevtoolsPanel />
        <BuildingSelector />
      </main>
    </div>
  )
}
