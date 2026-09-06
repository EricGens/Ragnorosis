import type { ComponentType } from 'react'
import type { BuildingType } from '../../sim/types'

interface IconProps {
  className?: string
}

const svgProps = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function FossilFuelIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <polyline points="16,42 24,10 32,42" />
      <line x1="18" y1="34" x2="30" y2="34" />
      <line x1="19" y1="26" x2="29" y2="26" />
      <line x1="20" y1="18" x2="28" y2="18" />
      <line x1="9" y1="42" x2="39" y2="42" />
      <path d="M22 9 q2 -4 2 -7 q2 3 2 7 q-2 2 -4 0 Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function RenewableIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <line x1="24" y1="42" x2="24" y2="14" />
      <circle cx="24" cy="14" r="2" fill="currentColor" stroke="none" />
      <line x1="24" y1="14" x2="24" y2="4" />
      <line x1="24" y1="14" x2="33" y2="19" />
      <line x1="24" y1="14" x2="15" y2="19" />
      <line x1="18" y1="42" x2="30" y2="42" />
    </svg>
  )
}

function ProductionIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <circle cx="24" cy="24" r="12" />
      <circle cx="24" cy="24" r="5" />
      <rect x="21" y="3" width="6" height="9" />
      <rect x="21" y="3" width="6" height="9" transform="rotate(45 24 24)" />
      <rect x="21" y="3" width="6" height="9" transform="rotate(90 24 24)" />
      <rect x="21" y="3" width="6" height="9" transform="rotate(135 24 24)" />
      <rect x="21" y="3" width="6" height="9" transform="rotate(180 24 24)" />
      <rect x="21" y="3" width="6" height="9" transform="rotate(225 24 24)" />
      <rect x="21" y="3" width="6" height="9" transform="rotate(270 24 24)" />
      <rect x="21" y="3" width="6" height="9" transform="rotate(315 24 24)" />
    </svg>
  )
}

function TrainingIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <polyline points="10,38 24,28 38,38" />
      <polyline points="10,28 24,18 38,28" />
      <polyline points="10,18 24,8 38,18" />
    </svg>
  )
}

function FortificationIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M24 6 L38 12 L38 26 C38 36 30 42 24 44 C18 42 10 36 10 26 L10 12 Z" />
      <polygon points="24,18 30,24 24,30 18,24" />
    </svg>
  )
}

const ICONS: Record<BuildingType, ComponentType<IconProps>> = {
  'fossil-fuel-plant': FossilFuelIcon,
  'renewable-plant': RenewableIcon,
  'production-facility': ProductionIcon,
  'training-facility': TrainingIcon,
  fortification: FortificationIcon,
}

export function BuildingIcon({ type, className }: { type: BuildingType; className?: string }) {
  const Icon = ICONS[type]
  return <Icon className={className} />
}
