import type { Priority } from '../../sim/types'

export const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', normal: 'Normal', low: 'Low' }

/** The §3.8 chevron display: Low ›, Normal ››, High ›››. */
export function chevrons(priority: Priority): string {
  return { low: '›', normal: '››', high: '›››' }[priority]
}
