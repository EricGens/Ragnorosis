import { describe, expect, it } from 'vitest'
import { MARGIN, WINDOW_SIZE, findOpenSpace, intersects, triangleWave, type Rect } from './placement'

const area = { width: 1000, height: 600 }
const at = (x: number, y: number): Rect => ({ x, y, ...WINDOW_SIZE })

describe('triangleWave', () => {
  it('bounces between 0 and range', () => {
    expect(triangleWave(0, 10)).toBe(0)
    expect(triangleWave(5, 10)).toBe(5)
    expect(triangleWave(10, 10)).toBe(10)
    expect(triangleWave(15, 10)).toBe(5)
    expect(triangleWave(20, 10)).toBe(0)
    expect(triangleWave(25, 10)).toBe(5)
    expect(triangleWave(30, 10)).toBe(10)
  })

  it('returns 0 for a non-positive range', () => {
    expect(triangleWave(5, 0)).toBe(0)
    expect(triangleWave(5, -10)).toBe(0)
  })
})

describe('findOpenSpace', () => {
  it('starts at the top-left margin on an empty screen', () => {
    expect(findOpenSpace([], WINDOW_SIZE, area)).toEqual({ x: MARGIN, y: MARGIN })
  })

  it('fills downward, then moves to the next column', () => {
    const first = findOpenSpace([], WINDOW_SIZE, area)
    const second = findOpenSpace([at(first.x, first.y)], WINDOW_SIZE, area)
    expect(second).toEqual({ x: MARGIN, y: MARGIN + WINDOW_SIZE.height + MARGIN })
    const third = findOpenSpace([at(first.x, first.y), at(second.x, second.y)], WINDOW_SIZE, area)
    expect(third).toEqual({ x: MARGIN, y: MARGIN + 2 * (WINDOW_SIZE.height + MARGIN) })
    // A 4th no longer fits in the first column (3 × 196 + 16 > 600), so it moves right.
    const fourth = findOpenSpace([first, second, third].map((p) => at(p.x, p.y)), WINDOW_SIZE, area)
    expect(fourth).toEqual({ x: MARGIN + WINDOW_SIZE.width + MARGIN, y: MARGIN })
  })

  it('opens flush against a reserved rect instead of skipping to the next full grid column', () => {
    // A reserved rect narrower than one window-pitch (392 vs 300+16+16=332) used to force windows
    // all the way out to x=648; the gap right beside it should now be used directly.
    const panel: Rect = { x: 0, y: 0, width: 392, height: 600 }
    const p = findOpenSpace([], WINDOW_SIZE, area, [panel])
    expect(p).toEqual({ x: panel.width + MARGIN, y: MARGIN })
    expect(intersects({ ...p, ...WINDOW_SIZE }, panel)).toBe(false)
  })

  it('reuses the space below a reserved rect once it does not span the full height', () => {
    // A short reserved rect (e.g. a panel with little content) should leave the rest of that
    // column free, not block the full height the way a fixed 10,000px guess used to.
    const shortPanel: Rect = { x: 0, y: 0, width: 200, height: 100 }
    const p = findOpenSpace([], WINDOW_SIZE, area, [shortPanel])
    expect(p).toEqual({ x: MARGIN, y: shortPanel.height + MARGIN })
  })

  it('avoids a reserved area that spans the full height', () => {
    const panel: Rect = { x: 0, y: 0, width: 400, height: 600 }
    const p = findOpenSpace([], WINDOW_SIZE, area, [panel])
    expect(intersects({ ...p, ...WINDOW_SIZE }, panel)).toBe(false)
    expect(p.x).toBeGreaterThanOrEqual(400)
  })

  it('cascades with a growing, bounded offset once the screen is genuinely full', () => {
    const full: Rect = { x: 0, y: 0, ...area }
    const positions = [1, 2, 3, 4].map((n) => findOpenSpace(Array(n).fill(full), WINDOW_SIZE, area))
    // Each step moves by a fixed 24px stride along both axes while inside range.
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].x - positions[i - 1].x).toBeCloseTo(24)
      expect(positions[i].y - positions[i - 1].y).toBeCloseTo(24)
    }
    for (const p of positions) {
      expect(p.x).toBeGreaterThanOrEqual(MARGIN)
      expect(p.x + WINDOW_SIZE.width).toBeLessThanOrEqual(area.width)
      expect(p.y).toBeGreaterThanOrEqual(MARGIN)
      expect(p.y + WINDOW_SIZE.height).toBeLessThanOrEqual(area.height)
    }
  })

  it('bounces back once the cascade reaches an edge, instead of stacking on the same spot', () => {
    // A narrow area forces the x cascade to hit its edge (range 84) well before y (range 1804).
    const narrow = { width: 400, height: 2000 }
    const full: Rect = { x: 0, y: 0, ...narrow }
    const positions = [3, 4, 5].map((n) => findOpenSpace(Array(n).fill(full), WINDOW_SIZE, narrow))
    const [beforeEdge, atOrPastEdge, afterEdge] = positions
    // n=3 → distance 72 (still climbing toward range 84); n=4 → 96 (past 84, reflected to 72);
    // n=5 → 120 (reflected to 48) — so x must turn around while y keeps climbing throughout.
    expect(beforeEdge.x).toBe(88) // 16 + 72
    expect(atOrPastEdge.x).toBe(88) // 16 + (168-96=72)
    expect(afterEdge.x).toBe(64) // 16 + (168-120=48)
    expect(afterEdge.y).toBeGreaterThan(atOrPastEdge.y)
    expect(atOrPastEdge.y).toBeGreaterThan(beforeEdge.y)
  })
})
