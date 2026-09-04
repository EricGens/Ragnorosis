// Pulse/Tick clock. Tick = 1 hour, Pulse = 1 week. Speed changes only how fast ticks are shown,
// never what is calculated.

export const TICKS_PER_DAY = 24
export const DAYS_PER_PULSE = 7
export const TICKS_PER_PULSE = TICKS_PER_DAY * DAYS_PER_PULSE // 168
export const DAYS_PER_YEAR = 365 // always a non-leap year, so Feb 29 never exists

export type Speed = 1 | 2 | 5
export const SPEEDS: readonly Speed[] = [1, 2, 5]
/** Ticks rendered per real second at each speed. */
export const TICKS_PER_SECOND: Record<Speed, number> = { 1: 3, 2: 6, 5: 15 }

/** Zero-based index of the pulse containing this tick. */
export function pulseOf(tick: number): number {
  return Math.floor(tick / TICKS_PER_PULSE)
}

/** Position within the current pulse, 0..167. */
export function tickInPulse(tick: number): number {
  return tick % TICKS_PER_PULSE
}

/** True when `tick` is the first tick of a new pulse (other than tick 0). */
export function isPulseBoundary(tick: number): boolean {
  return tick > 0 && tick % TICKS_PER_PULSE === 0
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export interface CalendarDate {
  /** 1-based, obfuscated ("Year 1"). */
  year: number
  /** 0-based month index. */
  month: number
  /** 1-based day of month. */
  day: number
  /** 0–23 */
  hour: number
}

export function calendarDate(tick: number): CalendarDate {
  const totalDays = Math.floor(tick / TICKS_PER_DAY)
  const year = Math.floor(totalDays / DAYS_PER_YEAR) + 1
  let dayOfYear = totalDays % DAYS_PER_YEAR
  let month = 0
  while (dayOfYear >= MONTH_LENGTHS[month]) {
    dayOfYear -= MONTH_LENGTHS[month]
    month++
  }
  return { year, month, day: dayOfYear + 1, hour: tick % TICKS_PER_DAY }
}

/** e.g. "Jan 10, Year 1" */
export function formatDate(tick: number): string {
  const d = calendarDate(tick)
  return `${MONTH_NAMES[d.month]} ${d.day}, Year ${d.year}`
}
