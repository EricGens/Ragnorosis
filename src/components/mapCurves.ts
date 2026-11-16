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

export interface RibbonStyle {
  /** Full width at the tail (the origin end). */
  tail: number
  /** Full width where the body meets the head. */
  neck: number
  /** Length of the arrowhead along the curve. */
  headLength: number
  /** Full width across the arrowhead's barbs. */
  headWidth: number
}

/** The HOI4-style order arrow: starts fat, narrows subtly, ends in a head (tunable; map is 1000 units square). */
export const ORDER_RIBBON: RibbonStyle = { tail: 18, neck: 8, headLength: 26, headWidth: 30 }

const SAMPLES_PER_CUBIC = 24

/** The chain as a polyline with cumulative arc length at every vertex. */
function measured(cs: Cubic[]): { pts: Pt[]; at: number[]; total: number } {
  const pts: Pt[] = []
  cs.forEach((c, i) => {
    for (let k = i === 0 ? 0 : 1; k <= SAMPLES_PER_CUBIC; k++) pts.push(cubicPoint(c, k / SAMPLES_PER_CUBIC))
  })
  const at = [0]
  for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return { pts, at, total: at[at.length - 1] }
}

/**
 * A tapered, filled arrow along a chain of cubics, as SVG path data. `from`/`to` are fractions of the whole
 * route's length (so the width taper is continuous across pieces); the arrowhead is drawn only when `to` is 1.
 * Returns '' for a degenerate route.
 */
export function taperedRibbon(cs: Cubic[], style: RibbonStyle, from = 0, to = 1): string {
  const { pts, at, total } = measured(cs)
  if (cs.length === 0 || total < 1 || to <= from) return ''
  const headLength = Math.min(style.headLength, total * 0.4)
  const bodyEnd = total - headLength
  const pointAt = (s: number): Pt => {
    const t = Math.min(total, Math.max(0, s))
    let i = 1
    while (i < at.length - 1 && at[i] < t) i++
    const span = at[i] - at[i - 1] || 1
    return lerp(pts[i - 1], pts[i], (t - at[i - 1]) / span)
  }
  const normalAt = (s: number): Pt => {
    const a = pointAt(s - 1)
    const b = pointAt(s + 1)
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len }
  }
  const half = (s: number) => (style.tail + (style.neck - style.tail) * Math.min(1, s / bodyEnd)) / 2
  const withHead = to >= 1
  const start = from * total
  const end = withHead ? bodyEnd : Math.min(to * total, bodyEnd)
  if (end <= start) return ''
  const steps = Math.max(2, Math.ceil(((end - start) / total) * 60))
  const left: Pt[] = []
  const right: Pt[] = []
  for (let k = 0; k <= steps; k++) {
    const s = start + ((end - start) * k) / steps
    const p = pointAt(s)
    const n = normalAt(s)
    left.push(add(p, scale(n, half(s))))
    right.push(sub(p, scale(n, half(s))))
  }
  const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  const outline = [...left]
  if (withHead) {
    const n = normalAt(bodyEnd)
    const base = pointAt(bodyEnd)
    outline.push(add(base, scale(n, style.headWidth / 2)), pointAt(total), sub(base, scale(n, style.headWidth / 2)))
  }
  outline.push(...right.reverse())
  return (
    `M ${f(outline[0])} ` +
    outline
      .slice(1)
      .map((p) => `L ${f(p)}`)
      .join(' ') +
    ' Z'
  )
}

/** The fraction of the whole route's length covered by the first cubic up to parameter `t` (where the icon sits). */
export function routeFraction(cs: Cubic[], t: number): number {
  const { at, total } = measured(cs)
  if (total === 0) return 0
  const x = Math.min(1, Math.max(0, t)) * SAMPLES_PER_CUBIC
  const i = Math.min(SAMPLES_PER_CUBIC - 1, Math.floor(x))
  return (at[i] + (x - i) * (at[i + 1] - at[i])) / total
}
