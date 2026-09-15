// Curved order arrows: a Catmull-Rom spline through region centres, rendered as cubic Béziers, with
// phantom end points that give even a single-leg move a battle-map arc (Eric, 2026-09-15).

export interface Pt {
  x: number
  y: number
}

/** [start, control 1, control 2, end] */
export type Cubic = [Pt, Pt, Pt, Pt]

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y })
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
const scale = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k })
/** Left-hand normal, same length as the input. */
const perp = (a: Pt): Pt => ({ x: -a.y, y: a.x })
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** How far the end tangents lean sideways, as a fraction of the end leg's length. */
const BULGE = 0.9

/** One cubic per consecutive pair of points, smooth through every interior point. */
export function cubicsThrough(pts: Pt[]): Cubic[] {
  if (pts.length < 2) return []
  const n = pts.length
  const d0 = sub(pts[1], pts[0])
  const dl = sub(pts[n - 1], pts[n - 2])
  // Phantom neighbours bend the first and last tangents to the same side, so a lone leg is an arc
  // and a chain enters and leaves with a flourish rather than dead straight.
  const ext: Pt[] = [
    sub(pts[0], add(d0, scale(perp(d0), BULGE))),
    ...pts,
    add(pts[n - 1], sub(dl, scale(perp(dl), BULGE))),
  ]
  const out: Cubic[] = []
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]]
    out.push([p1, add(p1, scale(sub(p2, p0), 1 / 6)), sub(p2, scale(sub(p3, p1), 1 / 6)), p2])
  }
  return out
}

export function cubicPoint([p0, c1, c2, p3]: Cubic, t: number): Pt {
  const a = lerp(p0, c1, t)
  const b = lerp(c1, c2, t)
  const c = lerp(c2, p3, t)
  return lerp(lerp(a, b, t), lerp(b, c, t), t)
}

/** De Casteljau split at t: the curve up to t, and the curve after it. */
export function splitCubic([p0, c1, c2, p3]: Cubic, t: number): [Cubic, Cubic] {
  const a = lerp(p0, c1, t)
  const b = lerp(c1, c2, t)
  const c = lerp(c2, p3, t)
  const ab = lerp(a, b, t)
  const bc = lerp(b, c, t)
  const m = lerp(ab, bc, t)
  return [
    [p0, a, ab, m],
    [m, bc, c, p3],
  ]
}

/** SVG path data for a chain of cubics (they must be contiguous). */
export function cubicsPath(cs: Cubic[]): string {
  if (cs.length === 0) return ''
  const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  return `M ${f(cs[0][0])} ` + cs.map(([, c1, c2, p3]) => `C ${f(c1)}, ${f(c2)}, ${f(p3)}`).join(' ')
}
