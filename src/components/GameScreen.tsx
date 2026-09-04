import { MapView } from './MapView'
import { TopBar } from './TopBar'

export function GameScreen() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="relative min-h-0 flex-1">
        <MapView />
      </main>
    </div>
  )
}
