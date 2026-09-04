// Window placement for pinned tooltips (skeleton §2.2): new windows look for open screen space
// first; once none is left they may overlap older ones. Nothing is ever auto-evicted.

export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  x: number
  y: number
}

/** Nominal footprint used for placement; actual windows size to content. */
export const WINDOW_SIZE: Size = { width: 300, height: 180 }
export const MARGIN = 16
const CASCADE = 24

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/**
 * Scan columns left→right, rows top→bottom for the first slot that overlaps neither an existing
 * window nor a reserved area (e.g. the entity panel). If the screen is full, cascade off the
 * newest window, clamped to the area.
 */
export function findOpenSpace(existing: Rect[], size: Size, area: Size, reserved: Rect[] = []): { x: number; y: number } {
  const blocked = [...existing, ...reserved]
  for (let x = MARGIN; x + size.width <= area.width; x += size.width + MARGIN) {
    for (let y = MARGIN; y + size.height <= area.height; y += size.height + MARGIN) {
      const candidate = { x, y, ...size }
      if (!blocked.some((r) => intersects(candidate, r))) return { x, y }
    }
  }
  const last = existing[existing.length - 1]
  if (!last) return { x: MARGIN, y: MARGIN }
  return {
    x: clamp(last.x + CASCADE, 0, Math.max(0, area.width - size.width)),
    y: clamp(last.y + CASCADE, 0, Math.max(0, area.height - size.height)),
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
