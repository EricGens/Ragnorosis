import { describe, expect, it } from 'vitest'
import { MARGIN, WINDOW_SIZE, findOpenSpace, intersects, type Rect } from './placement'

const area = { width: 1000, height: 600 }
const at = (x: number, y: number): Rect => ({ x, y, ...WINDOW_SIZE })

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

  it('avoids reserved areas such as the entity panel', () => {
    const panel: Rect = { x: 0, y: 0, width: 400, height: 600 }
    const p = findOpenSpace([], WINDOW_SIZE, area, [panel])
    expect(intersects({ ...p, ...WINDOW_SIZE }, panel)).toBe(false)
    expect(p.x).toBeGreaterThanOrEqual(400)
  })

  it('cascades off the newest window once the screen is full', () => {
    const small = { width: 320, height: 200 } // room for exactly one window
    const first = findOpenSpace([], WINDOW_SIZE, small)
    const second = findOpenSpace([at(first.x, first.y)], WINDOW_SIZE, small)
    expect(second.x).toBeGreaterThan(first.x)
    expect(second.y).toBeGreaterThan(first.y)
    expect(second.x + WINDOW_SIZE.width).toBeLessThanOrEqual(small.width)
    expect(second.y + WINDOW_SIZE.height).toBeLessThanOrEqual(small.height)
  })
})
