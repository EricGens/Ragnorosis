import type { Rect, Size } from './placement'

export const GAME_AREA_ID = 'game-area'
/** Entity panel geometry, reserved so pinned windows don't open on top of it. */
export const PANEL_WIDTH = 360
export const PANEL_RESERVED: Rect[] = [{ x: 0, y: 0, width: PANEL_WIDTH + 32, height: 10_000 }]

/** Size of the map area that floating windows are placed within. */
export function gameArea(): Size {
  const el = document.getElementById(GAME_AREA_ID)
  return el ? { width: el.clientWidth, height: el.clientHeight } : { width: 1280, height: 720 }
}
