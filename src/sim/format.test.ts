import { describe, expect, it } from 'vitest'
import { formatMoney, formatPercent, formatPopulation } from './format'

describe('population formatting', () => {
  it('follows the spec examples', () => {
    expect(formatPopulation(1_000_000)).toBe('1M')
    expect(formatPopulation(1_000)).toBe('1K')
    expect(formatPopulation(232_123)).toBe('232K')
    expect(formatPopulation(17_883_490)).toBe('17.9M')
    expect(formatPopulation(100_000_000)).toBe('100M')
    expect(formatPopulation(950)).toBe('950')
  })
})

describe('money formatting', () => {
  it('shortens with M/B/T', () => {
    expect(formatMoney(500e9)).toBe('$500B')
    expect(formatMoney(2e12)).toBe('$2T')
    expect(formatMoney(100e9)).toBe('$100B')
    expect(formatMoney(1.5e6)).toBe('$1.5M')
    expect(formatMoney(-2.5e9)).toBe('-$2.5B')
  })
})

describe('percent formatting', () => {
  it('shows one decimal', () => {
    expect(formatPercent(49.3)).toBe('49.3%')
    expect(formatPercent(75)).toBe('75.0%')
  })
})
