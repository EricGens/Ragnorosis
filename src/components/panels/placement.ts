// Window placement for pinned tooltips (skeleton §2.2): new windows look for open screen space
// first; once none is left they cascade diagonally, bouncing off the edges like a billiard ball so
// overlapping windows still show a visible offset rather than stacking exactly on top of each other.

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

/** A 1D triangle wave: 0 → range → 0 → range → … as n grows. Models a point bouncing in [0, range]. */
export function triangleWave(n: number, range: number): number {
  if (range <= 0) return 0
  const period = range * 2
  const m = ((n % period) + period) % period
  return m <= range ? m : period - m
}

/**
 * Find open space for a new window. Candidate positions are the margin origin plus the point just
 * outside every blocked rect's right and bottom edges — this reuses whatever gap actually exists
 * (e.g. the strip beside a reserved panel that doesn't span the full height) instead of a fixed
 * grid pitched to the window's own size, which would skip over it. Scans columns left→right, rows
 * top→bottom within a column, so it still fills the same way a fixed grid would when nothing is
 * reserved.
 */
export function findOpenSpace(existing: Rect[], size: Size, area: Size, reserved: Rect[] = []): { x: number; y: number } {
  const blocked = [...existing, ...reserved]

  const xs = [...new Set([MARGIN, ...blocked.map((r) => r.x + r.width + MARGIN)])]
    .filter((x) => x + size.width <= area.width)
    .sort((a, b) => a - b)
  const ys = [...new Set([MARGIN, ...blocked.map((r) => r.y + r.height + MARGIN)])]
    .filter((y) => y + size.height <= area.height)
    .sort((a, b) => a - b)

  for (const x of xs) {
    for (const y of ys) {
      const candidate = { x, y, ...size }
      if (!blocked.some((r) => intersects(candidate, r))) return { x, y }
    }
  }

  // No free slot: bounce a diagonal cascade around the area, offset by how many windows are
  // already open, so each new overlapping window still lands somewhere visibly different.
  const n = existing.length
  const xRange = Math.max(0, area.width - size.width - MARGIN)
  const yRange = Math.max(0, area.height - size.height - MARGIN)
  return {
    x: MARGIN + triangleWave(n * CASCADE, xRange),
    y: MARGIN + triangleWave(n * CASCADE, yRange),
  }
}
