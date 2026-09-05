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

/** A transient hover preview of a tooltip, anchored to the row the cursor is over. */
export interface HoverTooltip {
  content: TooltipContent
  /** The hovered row's rect, relative to the game area — used to place the preview beside it. */
  anchor: Rect
}

interface UIStore {
  /** Entity under the cursor — shown as a preview. */
  hovered: EntityRef | null
  /** Entity whose panel persists independent of hovering. */
  pinned: EntityRef | null
  /** Tooltips pinned as independent floating windows; closed only manually. */
  windows: PinnedWindow[]
  /** The tooltip preview for whatever stat row is currently hovered, if any. */
  hoverTooltip: HoverTooltip | null
  /** Region whose building-type selector is open. */
  selectorRegion: string | null
  militaryOpen: boolean
  devtoolsOpen: boolean

  openSelector: (regionId: string) => void
  closeSelector: () => void
  toggleMilitary: () => void
  toggleDevtools: () => void
  setHovered: (ref: EntityRef | null) => void
  /** Left-click: pin this entity, or unpin it if it is already pinned. */
  togglePin: (ref: EntityRef) => void
  unpin: () => void
  /** Pin a tooltip as a floating window, placed in open space if any remains. */
  openWindow: (content: TooltipContent, area: Size, reserved?: Rect[]) => void
  closeWindow: (id: number) => void
  moveWindow: (id: number, x: number, y: number) => void
  /** Show a stat's tooltip as a preview beside its row. Replaces any other preview showing. */
  showHoverTooltip: (content: TooltipContent, anchor: Rect) => void
  hideHoverTooltip: () => void
}

let nextWindowId = 1

export const useUIStore = create<UIStore>()((set, get) => ({
  hovered: null,
  pinned: null,
  windows: [],
  hoverTooltip: null,
  selectorRegion: null,
  militaryOpen: false,
  devtoolsOpen: false,

  openSelector: (regionId) => set({ selectorRegion: regionId }),
  closeSelector: () => set({ selectorRegion: null }),
  toggleMilitary: () => set({ militaryOpen: !get().militaryOpen }),
  toggleDevtools: () => set({ devtoolsOpen: !get().devtoolsOpen }),

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

  showHoverTooltip: (content, anchor) => set({ hoverTooltip: { content, anchor } }),

  hideHoverTooltip: () => set({ hoverTooltip: null }),
}))
