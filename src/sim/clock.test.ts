import { describe, expect, it } from 'vitest'
import {
  TICKS_PER_DAY,
  TICKS_PER_PULSE,
  TICKS_PER_SECOND,
  calendarDate,
  formatDate,
  isPulseBoundary,
  pulseOf,
  tickInPulse,
} from './clock'

describe('pulse/tick clock', () => {
  it('has 168 ticks per pulse', () => {
    expect(TICKS_PER_PULSE).toBe(168)
  })

  it('completes a pulse in ~56s / 28s / 11.2s at 1x / 2x / 5x', () => {
    expect(TICKS_PER_PULSE / TICKS_PER_SECOND[1]).toBe(56)
    expect(TICKS_PER_PULSE / TICKS_PER_SECOND[2]).toBe(28)
    expect(TICKS_PER_PULSE / TICKS_PER_SECOND[5]).toBeCloseTo(11.2)
  })

  it('indexes pulses and ticks within them', () => {
    expect(pulseOf(0)).toBe(0)
    expect(pulseOf(167)).toBe(0)
    expect(pulseOf(168)).toBe(1)
    expect(tickInPulse(169)).toBe(1)
  })

  it('detects pulse boundaries, excluding tick 0', () => {
    expect(isPulseBoundary(0)).toBe(false)
    expect(isPulseBoundary(167)).toBe(false)
    expect(isPulseBoundary(168)).toBe(true)
    expect(isPulseBoundary(336)).toBe(true)
  })
})

describe('calendar', () => {
  const day = (n: number) => n * TICKS_PER_DAY

  it('starts on Jan 1, Year 1', () => {
    expect(formatDate(0)).toBe('Jan 1, Year 1')
    expect(formatDate(23)).toBe('Jan 1, Year 1')
    expect(calendarDate(23).hour).toBe(23)
  })

  it('rolls over months', () => {
    expect(formatDate(day(31))).toBe('Feb 1, Year 1')
    expect(formatDate(day(9))).toBe('Jan 10, Year 1')
  })

  it('never produces Feb 29', () => {
    expect(formatDate(day(58))).toBe('Feb 28, Year 1')
    expect(formatDate(day(59))).toBe('Mar 1, Year 1')
  })

  it('rolls over years after 365 days', () => {
    expect(formatDate(day(364))).toBe('Dec 31, Year 1')
    expect(formatDate(day(365))).toBe('Jan 1, Year 2')
    expect(formatDate(day(365 * 4 + 59))).toBe('Mar 1, Year 5')
  })
})
