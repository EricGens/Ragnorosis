import { GameScreen } from './components/GameScreen'
import { TitleScreen } from './components/TitleScreen'
import { useGameStore } from './store/gameStore'

function App() {
  const screen = useGameStore((s) => s.screen)
  return screen === 'game' ? <GameScreen /> : <TitleScreen />
}

export default App
