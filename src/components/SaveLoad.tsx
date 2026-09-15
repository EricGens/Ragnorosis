import { useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'

export const QUICKSAVE_KEY = 'ragnorosis.quicksave'

export function readQuickSave(): string | null {
  try {
    return localStorage.getItem(QUICKSAVE_KEY)
  } catch {
    return null
  }
}

/**
 * Save writes a .json download and a browser quick-save; Load opens a file picker. One shared Load
 * path for every context (Epoch 2 skeleton §8) — the file's own marker decides where it opens.
 */
export function useSaveLoad() {
  const saveGame = useGameStore((s) => s.saveGame)
  const loadGame = useGameStore((s) => s.loadGame)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const save = () => {
    const r = saveGame()
    if (!r.ok) {
      setNotice(r.reason)
      return
    }
    try {
      localStorage.setItem(QUICKSAVE_KEY, r.json)
    } catch {
      /* private mode etc. — the download still happens */
    }
    const url = URL.createObjectURL(new Blob([r.json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = r.filename
    a.click()
    URL.revokeObjectURL(url)
    setNotice(`Saved ${r.filename}`)
  }

  const loadText = (json: string) => {
    const r = loadGame(json)
    setNotice(r.ok ? 'Loaded.' : r.reason)
  }

  const pickFile = () => fileInput.current?.click()

  const input = (
    <input
      ref={fileInput}
      type="file"
      accept="application/json,.json"
      className="hidden"
      aria-label="Load a save file"
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        file.text().then(loadText, () => setNotice("Couldn't read that file."))
      }}
    />
  )

  return { save, pickFile, loadText, input, notice, clearNotice: () => setNotice(null) }
}
