import type { Rect, Size } from './placement'

export const GAME_AREA_ID = 'game-area'
export const ENTITY_PANEL_ID = 'entity-panel'
export const PANEL_WIDTH = 360

/** Size of the map area that floating windows are placed within. */
export function gameArea(): Size {
  const el = document.getElementById(GAME_AREA_ID)
  return el ? { width: el.clientWidth, height: el.clientHeight } : { width: 1280, height: 720 }
}

/**
 * Rects that pinned windows should avoid — currently just the entity panel, measured from its
 * actual rendered footprint rather than a fixed guess, so windows can reuse the space below or
 * beside it once it doesn't fill the whole game area (or don't reserve anything at all when no
 * panel is open).
 */
export function reservedRects(): Rect[] {
  const area = document.getElementById(GAME_AREA_ID)
  const panel = document.getElementById(ENTITY_PANEL_ID)
  if (!area || !panel) return []
  const a = area.getBoundingClientRect()
  const p = panel.getBoundingClientRect()
  return [{ x: p.left - a.left, y: p.top - a.top, width: p.width, height: p.height }]
}
