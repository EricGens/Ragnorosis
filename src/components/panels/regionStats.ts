// Builds the display model for a Region panel: header identity/control info from the active
// faction's perspective, plus a stat block where every stat carries its own tooltip explaining
// what it means and how it is calculated (skeleton §2.2–2.3).

import { BUILDINGS } from '../../sim/data/buildings'
import { FACTIONS } from '../../sim/data/factions'
import { formatInt, formatMoney, formatPercent, formatPopulation } from '../../sim/format'
import { defensibility } from '../../sim/formulas/defensibility'
import { moneyPerPulse, perCapitaGdp, popularityCut, researchPerTick } from '../../sim/formulas/economy'
import { fossilEnergyDemand, regionProduction, regionSupply } from '../../sim/formulas/production'
import { gdpStabilityInput, stabilityAnchor } from '../../sim/formulas/stability'
import type { FactionId, GameState, LandRegion, Region } from '../../sim/types'
import { FACTION_IDS, isLand } from '../../sim/types'
import type { TooltipContent } from '../../store/uiStore'

export type Tone = 'neutral' | 'good' | 'warn' | 'bad'

export interface StatDescriptor {
  key: string
  label: string
  value: string
  tone?: Tone
  /** Stability-style trend: "value → target", arrow colored by direction. */
  trend?: { target: string; direction: 'up' | 'down' | 'flat' }
  tooltip: TooltipContent
}

export interface RegionHeader {
  name: string
  type: Region['type']
  controller: FactionId | null
  country?: string
  tags: string[]
  superiority: { air?: number; sea?: number }
}

export interface RegionDisplay {
  header: RegionHeader
  stats: StatDescriptor[]
  buildings: { name: string; level: number }[]
}

/** Three flat bands matching GDD §6.4: red <25, yellow 25–50, green >50. */
export function popularityTone(value: number): Tone {
  if (value < 25) return 'bad'
  if (value <= 50) return 'warn'
  return 'good'
}

function isCoastal(state: GameState, region: Region): boolean {
  return state.adjacency[region.id].some((n) => !isLand(state.regions[n]))
}

export function regionDisplay(state: GameState, region: Region, perspective: FactionId): RegionDisplay {
  const tags: string[] = []
  if (region.weatherActive) tags.push(`Weather (${region.weatherTicksRemaining}t)`)
  if (isLand(region)) for (const t of region.traits) tags.push(capitalize(t))

  const sup = region.superiority[perspective]
  const header: RegionHeader = {
    name: region.name,
    type: region.type,
    controller: isLand(region) ? region.controller : null,
    country: isLand(region) ? region.country : undefined,
    tags,
    superiority: isLand(region)
      ? { air: sup.air, sea: isCoastal(state, region) ? sup.sea : undefined }
      : { sea: sup.sea },
  }

  const stats = isLand(region) ? landStats(region, perspective) : maritimeStats(region)
  const buildings = isLand(region)
    ? Object.entries(region.buildings)
        .filter(([, level]) => (level ?? 0) > 0)
        .map(([type, level]) => ({ name: BUILDINGS[type as keyof typeof BUILDINGS].name, level: level ?? 0 }))
    : []

  return { header, stats, buildings }
}

function maritimeStats(region: Region): StatDescriptor[] {
  return [energyStat(region, 0)]
}

function landStats(region: LandRegion, perspective: FactionId): StatDescriptor[] {
  const perCapita = perCapitaGdp(region)
  const production = regionProduction(region) // TODO(slice 5): pass this pulse's Energy fulfillment
  const anchor = stabilityAnchor(region)
  const controllerName = region.controller ? FACTIONS[region.controller].name : 'no one'
  const controllerPop = region.controller ? region.popularity[region.controller] : null
  const ownPopularity = region.popularity[perspective]
  const label = FACTIONS[perspective].popularityLabel

  return [
    {
      key: 'population',
      label: 'Population',
      value: formatPopulation(region.population),
      tooltip: {
        title: 'Population',
        lines: [
          `${formatInt(region.population)} people.`,
          'Grows 1% per year (applied each Pulse). Moves between neighboring land regions from low to high Stability.',
          'Reduced by training Population into Manpower, and later by invasion and long-range fire.',
        ],
      },
    },
    {
      key: 'gdp',
      label: 'GDP',
      value: formatMoney(region.gdp),
      tooltip: {
        title: 'GDP',
        lines: [
          `Annual output in current dollars. Per capita: ${formatMoney(perCapita)}.`,
          'Grows with Population, holding per-capita GDP steady; moves with migrants.',
          `Money to the controller each Pulse = GDP ÷ 52 × Stability ÷ 100 × popularity cut.`,
        ],
      },
    },
    {
      key: 'money',
      label: 'Money / Pulse',
      value: formatMoney(moneyPerPulse(region)),
      tooltip: {
        title: 'Money per Pulse',
        lines: [
          `Collected by ${controllerName}.`,
          `Weekly GDP ${formatMoney(region.gdp / 52)} × Stability ${region.stability.toFixed(1)}% × cut ${
            controllerPop === null ? '—' : popularityCut(controllerPop).toFixed(3)
          }.`,
          'The cut is 0 below 50% Popularity and rises linearly to 0.7 at 100%.',
        ],
      },
    },
    {
      key: 'production',
      label: 'Production',
      value: `${formatInt(production.total)}(${formatInt(regionSupply(production.total))})`,
      tooltip: {
        title: 'Production (Supply)',
        lines: [
          `Population ${formatInt(production.population)} (1 per 100K) + Fossil ${formatInt(production.fossil)} + Renewable ${formatInt(production.renewable)} per Pulse.`,
          'Plants yield 100 per level. Fossil output is curtailed 1:1 by Energy shortfall; Renewable output halves while Weather is active.',
          'Pooled across all faction-controlled regions, then allocated to Construction, Manpower, and Equipment.',
          'Supply (in parentheses) is derived 1:1 from Production and sustains Task Forces.',
        ],
      },
    },
    {
      key: 'research',
      label: 'Research / Tick',
      value: formatInt(researchPerTick(region)),
      tooltip: {
        title: 'Research per Tick',
        lines: [
          `GDP ${formatMoney(region.gdp)} ÷ $1B × Stability ${region.stability.toFixed(1)}% = ${researchPerTick(region).toFixed(1)}.`,
          'Flows continuously to the controller every Tick and pushes progress toward the focused tech.',
        ],
      },
    },
    energyStat(region, fossilEnergyDemand(region)),
    {
      key: 'stability',
      label: 'Stability',
      value: region.stability.toFixed(1),
      trend: {
        target: anchor.toFixed(1),
        direction: anchor > region.stability ? 'up' : anchor < region.stability ? 'down' : 'flat',
      },
      tooltip: {
        title: 'Stability',
        lines: [
          `Currently ${region.stability.toFixed(1)}, trending toward its anchor of ${anchor.toFixed(1)}.`,
          `Anchor = mean of ${
            controllerPop === null
              ? 'the per-capita GDP input only (no controlling faction)'
              : `${controllerName}'s Popularity (${controllerPop.toFixed(1)}) and the per-capita GDP input (${gdpStabilityInput(perCapita).toFixed(1)})`
          }.`,
          'The GDP input is 10 at ≤$1,000 per capita and 90 at ≥$200,000, linear between.',
          'Each Pulse, Stability moves 10% of the way to the anchor (at least 0.1).',
          'Sets the effective tax rate and Research collection; low values drive emigration.',
        ],
      },
    },
    {
      key: 'popularity',
      label,
      value: formatPercent(ownPopularity),
      tone: popularityTone(ownPopularity),
      tooltip: {
        title: `${label} — all factions`,
        lines: [
          ...FACTION_IDS.map((id) => `${FACTIONS[id].name}: ${formatPercent(region.popularity[id])}`),
          'Local standing, 0–100%, non-summing. Below 25% a faction is treated as criminal; 25–50% operates with friction; above 50% operates freely and can collect income.',
        ],
      },
    },
    {
      key: 'defensibility',
      label: 'Defensibility',
      value: formatInt(defensibility(region)),
      tooltip: {
        title: 'Defensibility',
        lines: [
          `10 base + 10 × ${region.traits.length} terrain trait(s) + 5 × ${region.buildings.fortification ?? 0} Fortification level(s).`,
          'Favors the defending Task Force. Fortification caps at level 10.',
        ],
      },
    },
  ]
}

function energyStat(region: Region, demand: number): StatDescriptor {
  return {
    key: 'energy',
    label: 'Energy',
    value: demand > 0 ? `${formatInt(region.energyReserve)} / ${formatInt(demand)}` : formatInt(region.energyReserve),
    tone: demand > region.energyReserve ? 'warn' : undefined,
    tooltip: {
      title: 'Energy',
      lines: [
        `Fossil-fuel supply rate: ${formatInt(region.energyReserve)} per Pulse (does not deplete).`,
        demand > 0 ? `Local demand: ${formatInt(demand)} per Pulse (100 per Fossil Fuel Plant level).` : 'No local demand.',
        'Sourced same-country first, then outward along clear paths. Under global shortage every faction receives the same share of its own demand; a blockade can push a region further below that.',
        'Not gated by political Control — access follows Air/Sea Superiority.',
      ],
    },
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
