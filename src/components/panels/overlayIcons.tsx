import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Military panel button. */
export function MilitaryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="26" y="12" width="16" height="4" />
      <rect x="12" y="16" width="22" height="6" />
      <polygon points="14,22 22,22 20,40 12,40" />
      <path d="M22 22 v6 h4 v-6" />
    </svg>
  )
}

/** Weather — map overlay and Region panel tag. */
export function WeatherIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 32 a7 7 0 0 1 0 -14 a9 9 0 0 1 17 -3 a8 8 0 0 1 9 8 a6 6 0 0 1 -2 9 Z" />
      <polygon points="24,26 20,34 24,34 20,44 30,32 25,32 28,26" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Offshore Energy — map overlay, any Maritime region with an Energy reserve > 0. */
export function OilPlatformIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <line x1="8" y1="40" x2="40" y2="40" />
      <rect x="10" y="28" width="20" height="4" />
      <line x1="13" y1="32" x2="10" y2="40" />
      <line x1="27" y1="32" x2="30" y2="40" />
      <polyline points="16,28 20,14 24,28" />
      <line x1="32" y1="28" x2="32" y2="16" />
      <path d="M32 16 c-2 -3 2 -3 0 -6 c2 3 2 3 0 6 Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Rugged terrain tag. */
export function RuggedIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 34 Q20 10 30 14 Q38 16 44 32" />
      <polygon points="6,36 9,29 12,36" />
      <polygon points="11,36 14,27 17,36" />
      <polygon points="18,36 21,25 24,36" />
      <polygon points="25,36 28,27 31,36" />
      <polygon points="32,36 35,29 38,36" />
    </svg>
  )
}

/** Mountainous terrain tag. */
export function MountainousIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <polygon points="24,8 30,20 36,14 42,36 6,36" />
      <path d="M24 8 L29 18 L26 16 L23 19 L20 16 L17 18 Z" fill="currentColor" stroke="none" />
    </svg>
  )
}
