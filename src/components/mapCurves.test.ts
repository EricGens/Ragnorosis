import { describe, expect, it } from 'vitest'
import { cubicsThrough, ORDER_RIBBON, taperedRibbon, type Cubic, type Pt } from './mapCurves'

const line: Cubic[] = [
  [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
    { x: 300, y: 0 },
  ],
]

/** Vertices of the polygon in a path made only of M/L/Z commands. */
function vertices(d: string): Pt[] {
  return [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
}

describe('taperedRibbon', () => {
  it('is empty for a degenerate route or an empty slice', () => {
    expect(taperedRibbon([], ORDER_RIBBON)).toBe('')
    expect(
      taperedRibbon(
        cubicsThrough([
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ]),
        ORDER_RIBBON,
      ),
    ).toBe('')
    expect(taperedRibbon(line, ORDER_RIBBON, 0.5, 0.5)).toBe('')
  })

  it('starts fat at the tail and narrows toward the head, ending at the destination', () => {
    const v = vertices(taperedRibbon(line, ORDER_RIBBON))
    const tailWidth = Math.abs(v[0].y - v[v.length - 1].y) // first left vertex vs last right vertex
    expect(tailWidth).toBeCloseTo(ORDER_RIBBON.tail, 0)
    const tip = v.reduce((best, p) => (p.x > best.x ? p : best))
    expect(tip.x).toBeCloseTo(300, 0)
    expect(tip.y).toBeCloseTo(0, 0)
    // The body is narrower at the neck than at the tail; the barbs are the widest part.
    const neck = v.filter((p) => Math.abs(p.x - (300 - ORDER_RIBBON.headLength)) < 1)
    const widths = neck.map((p) => Math.abs(p.y))
    expect(Math.min(...widths)).toBeCloseTo(ORDER_RIBBON.neck / 2, 0)
    expect(Math.max(...widths)).toBeCloseTo(ORDER_RIBBON.headWidth / 2, 0)
  })

  it('draws a head only when the slice reaches the end, and keeps the taper continuous across slices', () => {
    const progress = vertices(taperedRibbon(line, ORDER_RIBBON, 0, 0.4))
    const whole = vertices(taperedRibbon(line, ORDER_RIBBON))
    expect(Math.max(...progress.map((p) => p.x))).toBeCloseTo(120, 0) // 0.4 × 300, no head
    // Same width at the same distance along the route in both pieces.
    const at = (vs: Pt[]) => Math.abs(vs.find((p) => Math.abs(p.x - 60) < 1.5 && p.y > 0)!.y)
    expect(at(progress)).toBeCloseTo(at(whole), 0)
  })

  it('follows a curved chain without NaNs', () => {
    const curved = cubicsThrough([
      { x: 100, y: 100 },
      { x: 400, y: 150 },
      { x: 600, y: 500 },
    ])
    const d = taperedRibbon(curved, ORDER_RIBBON)
    expect(d.startsWith('M ')).toBe(true)
    expect(d.endsWith(' Z')).toBe(true)
    expect(d).not.toContain('NaN')
  })
})
