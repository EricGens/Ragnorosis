import { create } from 'zustand'
import { WINDOW_SIZE, findOpenSpace, type Rect, type Size } from '../components/panels/placement'

/**
 * A reference to any inspectable map entity. Regions now; Task Forces and Agents plug in later
 * without needing their own panel plumbing.
 */
export type EntityRef = { kind: 'region'; id: string }

export function sameRef(a: EntityRef | null, b: EntityRef | null): boolean {
  return a !== null && b !== null && a.kind === b.kind && a.id === b.id
}

export interface TooltipContent {
  title: string
  lines: string[]
}

export interface PinnedWindow extends TooltipContent {
  id: number
  x: number
  y: number
}

interface UIStore {
  /** Entity under the cursor — shown as a preview. */
  hovered: EntityRef | null
  /** Entity whose panel persists independent of hovering. */
  pinned: EntityRef | null
  /** Tooltips pinned as independent floating windows; closed only manually. */
  windows: PinnedWindow[]
  /** Region whose building-type selector is open. */
  selectorRegion: string | null
  militaryOpen: boolean

  openSelector: (regionId: string) => void
  closeSelector: () => void
  toggleMilitary: () => void
  setHovered: (ref: EntityRef | null) => void
  /** Left-click: pin this entity, or unpin it if it is already pinned. */
  togglePin: (ref: EntityRef) => void
  unpin: () => void
  /** Pin a tooltip as a floating window, placed in open space if any remains. */
  openWindow: (content: TooltipContent, area: Size, reserved?: Rect[]) => void
  closeWindow: (id: number) => void
  moveWindow: (id: number, x: number, y: number) => void
}

let nextWindowId = 1

export const useUIStore = create<UIStore>()((set, get) => ({
  hovered: null,
  pinned: null,
  windows: [],
  selectorRegion: null,
  militaryOpen: false,

  openSelector: (regionId) => set({ selectorRegion: regionId }),
  closeSelector: () => set({ selectorRegion: null }),
  toggleMilitary: () => set({ militaryOpen: !get().militaryOpen }),

  setHovered: (ref) => set({ hovered: ref }),

  togglePin: (ref) => set({ pinned: sameRef(get().pinned, ref) ? null : ref }),

  unpin: () => set({ pinned: null }),

  openWindow: (content, area, reserved = []) => {
    const existing = get().windows.map((w) => ({ x: w.x, y: w.y, ...WINDOW_SIZE }))
    const { x, y } = findOpenSpace(existing, WINDOW_SIZE, area, reserved)
    set({ windows: [...get().windows, { ...content, id: nextWindowId++, x, y }] })
  },

  closeWindow: (id) => set({ windows: get().windows.filter((w) => w.id !== id) }),

  moveWindow: (id, x, y) => set({ windows: get().windows.map((w) => (w.id === id ? { ...w, x, y } : w)) }),
}))
