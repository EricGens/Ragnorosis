// A round robin of well over a hundred Task Force designs at two army sizes, to see whether one design
// dominates or whether the strong ones counter each other. tournament.test.ts writes it out as
// tournament-report.md (`npm run balance:tournament`, roughly a quarter of an hour).

import { designStats } from '../military/design'
import type { DesignInput } from '../military/roster'
import { runMatchup, type Force } from './arena'
import { DESIGNS as D, mix } from './forces'

const SEEDS = 8
const cost = (d: DesignInput) => designStats(d.platform, d.modules).cost
const pct = (x: number) => `${Math.round(x * 100)}%`

/**
 * Every combination of: a front (infantry of one type; 12 or 24 tanks with an infantry filler; or all tanks), artillery
 * (none, 12 Towed, 12 MLRS), CAS (none or 6) and air defence (none or 6 SHORAD Vehicles), with whatever
 * Production is left spent on the infantry.
 */
export function candidateBuilds(budget: number): Force[] {
  const out: Force[] = []
  // name, tank on the Front Line (if any), how many of it, and the infantry the rest of the budget buys
  // (null = spend the rest on more of the same tank: an all-armour force with a deep bench).
  const fronts: [string, DesignInput | null, number, DesignInput | null][] = [
    ['Light Infantry', null, 0, D.lightInf],
    ['AT Infantry', null, 0, D.atInf],
    ['Heavy Infantry', null, 0, D.heavyInf],
    ['12 MBT+ / Light Infantry', D.mbtPlus, 12, D.lightInf],
    ['12 MBT+ / AT Infantry', D.mbtPlus, 12, D.atInf],
    ['12 MBT (AT) / Light Infantry', D.mbtAT, 12, D.lightInf],
    ['12 MBT (AT) / AT Infantry', D.mbtAT, 12, D.atInf],
    ['12 IFV / Light Infantry', D.ifv, 12, D.lightInf],
    ['24 MBT+ / Light Infantry', D.mbtPlus, 24, D.lightInf],
    ['24 MBT+ / AT Infantry', D.mbtPlus, 24, D.atInf],
    ['All MBT+', D.mbtPlus, 12, null],
    ['All MBT (AT)', D.mbtAT, 12, null],
  ]
  const artillery: [string, DesignInput | null][] = [
    ['', null],
    [' + Towed', D.towed],
    [' + MLRS', D.mlrs],
  ]
  for (const [frontName, tank, tanks, infantryDesign] of fronts)
    for (const [artyName, arty] of artillery)
      for (const cas of [0, 6])
        for (const aa of [0, 6]) {
          const filler = infantryDesign ?? tank!
          const fixed =
            (tank ? tanks * cost(tank) : 0) + (arty ? 12 * cost(arty) : 0) + cas * cost(D.cas) + aa * cost(D.shorad)
          const rest = Math.floor((budget - fixed) / cost(filler))
          if (rest < 0 || (!tank && rest < 12)) continue
          const units: [DesignInput, number][] = []
          if (tank) units.push([tank, tanks + (infantryDesign ? 0 : rest)])
          if (infantryDesign && rest > 0) units.push([infantryDesign, rest])
          if (arty) units.push([arty, 12])
          if (cas) units.push([D.cas, cas])
          if (aa) units.push([D.shorad, aa])
          out.push(mix(`${frontName}${artyName}${cas ? ' + CAS' : ''}${aa ? ' + SHORAD' : ''}`, ...units))
        }
  return out
}

/** Round robin; each pair's result is averaged over attacking and defending. Returns markdown lines. */
export function roundRobin(title: string, forces: Force[]): string[] {
  const wins = forces.map((a) => forces.map((b) => runMatchup(a, b, SEEDS).attackerWinRate))
  const net = (i: number, j: number) => (wins[i][j] + (1 - wins[j][i])) / 2
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const all = forces.map((_, i) => i)
  const score = all.map((i) => mean(all.map((j) => net(i, j))))
  const order = [...all].sort((x, y) => score[y] - score[x])
  const out = [`## ${title}`, '', `${forces.length} designs, ${SEEDS} seeds per matchup in each direction.`, '']
  out.push(
    '| rank | design | overall | attacking | defending | worst matchups |',
    '| ---: | --- | ---: | ---: | ---: | --- |',
  )
  order.slice(0, 15).forEach((i, rank) => {
    const worst = order
      .filter((j) => net(i, j) < 0.45)
      .sort((x, y) => net(i, x) - net(i, y))
      .slice(0, 3)
      .map((j) => `${forces[j].name} (${pct(net(i, j))})`)
    out.push(
      `| ${rank + 1} | ${forces[i].name} | ${pct(score[i])} | ${pct(mean(wins[i]))} | ${pct(mean(all.map((j) => 1 - wins[j][i])))} | ${worst.join('; ') || 'none below 45%'} |`,
    )
  })
  out.push(
    '',
    `Weakest five: ${order
      .slice(-5)
      .map((i) => `${forces[i].name} (${pct(score[i])})`)
      .join('; ')}.`,
    '',
  )
  const top = order.slice(0, 8)
  out.push('Top eight against each other (row versus column):', '')
  out.push(`| | ${top.map((_, k) => `#${k + 1}`).join(' | ')} |`, `| --- | ${top.map(() => '---:').join(' | ')} |`)
  top.forEach((i, k) => out.push(`| #${k + 1} ${forces[i].name} | ${top.map((j) => pct(net(i, j))).join(' | ')} |`))
  out.push(
    '',
    ...top.map((i, k) => `- #${k + 1}: ${forces[i].units.map(([d, n]) => `${n} ${d.name}`).join(' + ')}`),
    '',
  )
  return out
}

/** The whole report as markdown lines. */
export function tournamentReport(): string[] {
  const out = [
    '# Tournament report',
    '',
    'Generated by `npm run balance:tournament` — do not edit by hand. Plain ground; "overall" averages a',
    "design's results attacking and defending against every design in the pool, itself included.",
    '',
  ]
  out.push(...roundRobin('6,000 Production', candidateBuilds(6000)))
  // At army scale a full round robin is slow: score everyone against a spread-out panel first, then run
  // the round robin among the best 34.
  const all = candidateBuilds(20000)
  const panel = all.filter((_, i) => i % 9 === 0)
  const first = all.map((a) =>
    panel.reduce((s, b) => s + (runMatchup(a, b, 4).attackerWinRate + 1 - runMatchup(b, a, 4).attackerWinRate) / 2, 0),
  )
  const best = all
    .map((_, i) => i)
    .sort((x, y) => first[y] - first[x])
    .slice(0, 34)
    .map((i) => all[i])
  out.push(...roundRobin(`20,000 Production (best 34 of ${all.length} after a first round)`, best))
  return out
}
