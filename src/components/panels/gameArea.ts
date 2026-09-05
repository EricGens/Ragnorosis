import type { Rect, Size } from './placement'

export const GAME_AREA_ID = 'game-area'
export const ENTITY_PANEL_ID = 'entity-panel'
export const PANEL_WIDTH = 360

/** Size of the map area that floating windows are placed within. */
export function gameArea(): Size {
  const el = document.getElementById(GAME_AREA_ID)
  return el ? { width: el.clientWidth, height: el.clientHeight } : { width: 1280, height: 720 }
}

/** An element's rect expressed relative to the game area's own top-left, not the viewport. */
export function relativeRect(el: Element): Rect {
  const area = document.getElementById(GAME_AREA_ID)
  const a = area ? area.getBoundingClientRect() : { left: 0, top: 0 }
  const r = el.getBoundingClientRect()
  return { x: r.left - a.left, y: r.top - a.top, width: r.width, height: r.height }
}

/**
 * Rects that pinned windows should avoid — currently just the entity panel, measured from its
 * actual rendered footprint rather than a fixed guess, so windows can reuse the space below or
 * beside it once it doesn't fill the whole game area (or don't reserve anything at all when no
 * panel is open).
 */
export function reservedRects(): Rect[] {
  const panel = document.getElementById(ENTITY_PANEL_ID)
  return panel ? [relativeRect(panel)] : []
}
