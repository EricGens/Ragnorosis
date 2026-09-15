import { PLAYABLE_FACTIONS } from '../sim/data/factions'
import { useGameStore } from '../store/gameStore'
import { readQuickSave, useSaveLoad } from './SaveLoad'

const buttonBase = 'w-64 rounded border px-6 py-3 text-sm uppercase tracking-[0.25em] transition-colors'
const enabled = `${buttonBase} border-signal-dim text-signal hover:bg-signal/10 hover:border-signal`
const disabled = `${buttonBase} border-ink-700 text-ink-400 cursor-not-allowed`

export function TitleScreen() {
  const screen = useGameStore((s) => s.screen)
  const goToFactionSelect = useGameStore((s) => s.goToFactionSelect)
  const startSandbox = useGameStore((s) => s.startSandbox)
  const saveLoad = useSaveLoad()
  const quick = readQuickSave()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-12 bg-ink-950">
      <h1 className="text-6xl font-semibold tracking-[0.3em] text-ink-100 uppercase">Ragnorosis</h1>

      {screen === 'title' ? (
        <div className="flex flex-col gap-3">
          <button type="button" className={disabled} disabled title="Not available yet">
            New Game
          </button>
          {/* One Load entry point for every kind of save (Epoch 2 skeleton §8); the file decides where it opens. */}
          <button type="button" className={enabled} onClick={saveLoad.pickFile}>
            Load Game
          </button>
          {quick && (
            <button
              type="button"
              className={enabled}
              onClick={() => saveLoad.loadText(quick)}
              title="The last save made in this browser"
            >
              Continue
            </button>
          )}
          <button type="button" className={enabled} onClick={goToFactionSelect}>
            Sandbox
          </button>
          {saveLoad.input}
          {saveLoad.notice && <p className="max-w-64 text-center text-xs text-warn">{saveLoad.notice}</p>}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs tracking-[0.35em] text-ink-400 uppercase">Choose your faction</p>
          <div className="grid grid-cols-2 gap-3">
            {PLAYABLE_FACTIONS.map((f) => (
              <button key={f.id} type="button" className={enabled} onClick={() => startSandbox(f.id)}>
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
