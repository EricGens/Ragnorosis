// Display formatting rules from the skeleton (§1.4). Pure functions, safe to use from the sim or UI.

function shorten(value: number, suffixes: [number, string][]): string {
  for (const [threshold, suffix] of suffixes) {
    if (Math.abs(value) >= threshold) {
      const scaled = value / threshold
      // One decimal when it adds information (17.9M), none when it doesn't (232K, 1M).
      const text = scaled >= 100 || Number.isInteger(scaled) ? Math.round(scaled).toString() : scaled.toFixed(1)
      return `${text.replace(/\.0$/, '')}${suffix}`
    }
  }
  return Math.round(value).toString()
}

/** 232,123 → "232K"; 17,883,490 → "17.9M"; 1,000,000 → "1M" */
export function formatPopulation(value: number): string {
  return shorten(value, [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ])
}

/** 500e9 → "$500B"; 2e12 → "$2T"; 1.5e6 → "$1.5M" */
export function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${shorten(Math.abs(value), [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ])}`
}

/** 49.3 → "49.3%" */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

/** Integer with thousands separators. */
export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}
