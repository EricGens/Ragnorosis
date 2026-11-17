// The balance arena: stage one invasion between two Task Forces on a blank battlefield and report who won
// and what it cost. For asking "does this composition punch above its Production cost?" across many seeds
// without touching the UI (GDD §12.10, the balance sandbox). Nothing in the app imports this.
//
// The arena runs only the military part of the tick (movement, battles, recovery) and mutates a private
// GameState directly rather than through Immer, so thousands of battles take seconds. The combat code it
// calls is exactly the game's.

import { DUMMY_MAP } from '../data/dummyMap'
import { recoverTaskForces, resolveBattles, startStandoffs } from '../military/battle'
import { organization } from '../military/combat'
import { designStats } from '../military/design'
import { moveTaskForces, orderMove } from '../military/movement'
import { saveDesign, type DesignInput } from '../military/roster'
import { createTaskForce, fillTaskForce, setTarget } from '../military/taskForce'
import { setFactionRelation } from '../relations'
import { createInitialState } from '../state'
import type { BattleOutcome, BattleSide, FactionId, GameState, HitTally, LandRegion, TerrainTrait } from '../types'

/** A composition to test: unit designs and how many of each. Order matters — earlier entries claim line slots first. */
export interface Force {
  name: string
  units: [design: DesignInput, count: number][]
}

export interface Battlefield {
  /** Terrain traits of the defender's region (each adds Defensibility). Default: none. */
  traits?: TerrainTrait[]
  /** Fortification level in the defender's region. Default 0. */
  fortification?: number
  /** Stability of the defender's region; below 50 the attacker gets the partisan bonus. Default 50. */
  stability?: number
  /** Whether the attacker arrives Ready (with Shock). Default true. */
  shock?: boolean
}

export interface SideReport {
  /** Production cost of the whole force at the start. */
  cost: number
  manpower: number
  /** Production cost of the units destroyed. */
  costLost: number
  manpowerLost: number
  unitsLost: number
  /** Hits this side landed, by the line that scored them. */
  hits: HitTally
  /** Average number of its 12 Front Line slots this side had filled over the battle. */
  meanFrontLine: number
}

/** Why the losing side lost: its Organization hit zero, or it ran out of units able to hold the Front Line. */
export type EndReason = 'organization' | 'no-line' | 'none'

export interface BattleReport {
  outcome: BattleOutcome | 'timeout'
  attackerWon: boolean
  endReason: EndReason
  ticks: number
  attacker: SideReport
  defender: SideReport
}

const ATTACKER: FactionId = 'united-states'
const DEFENDER: FactionId = 'china'
const FROM = 'w-land'
const AT = 'c-land'

export function forceCost(force: Force): { cost: number; manpower: number } {
  let cost = 0
  let manpower = 0
  for (const [design, count] of force.units) {
    const stats = designStats(design.platform, design.modules)
    cost += stats.cost * count
    manpower += stats.manpower * count
  }
  return { cost, manpower }
}

function raise(state: GameState, faction: FactionId, regionId: string, force: Force): number {
  const tf = createTaskForce(state, faction, regionId)
  if (!tf.ok) throw new Error(tf.reason)
  // The same design listed twice (say, a base of infantry plus more infantry as an add-on) is one unit type.
  const ids = new Map<string, number>()
  const counts = new Map<number, number>()
  for (const [design, count] of force.units) {
    let id = ids.get(design.name)
    if (id === undefined) {
      const saved = saveDesign(state, faction, design)
      if (!saved.ok) throw new Error(`${force.name}: ${saved.reason}`)
      id = saved.id
      ids.set(design.name, id)
    }
    counts.set(id, (counts.get(id) ?? 0) + count)
    const set = setTarget(state, tf.id, id, counts.get(id)!)
    if (!set.ok) throw new Error(set.reason)
  }
  fillTaskForce(state, tf.id)
  return tf.id
}

function report(state: GameState, force: Force, side: BattleSide, meanFrontLine: number): SideReport {
  let costLost = 0
  let unitsLost = 0
  for (const [id, n] of Object.entries(side.unitsLost)) {
    const design = state.factions[side.faction].designs.find((d) => d.id === Number(id))
    if (design) costLost += n * designStats(design.platform, design.modules).cost
    unitsLost += n
  }
  return {
    ...forceCost(force),
    costLost,
    manpowerLost: side.manpowerLost,
    unitsLost,
    hits: { ...side.hits },
    meanFrontLine,
  }
}

/** One invasion: `attacker` marches from open ground into `defender`'s region. Deterministic per seed. */
export function runBattle(
  attacker: Force,
  defender: Force,
  seed: number,
  field: Battlefield = {},
  maxTicks = 5000,
): BattleReport {
  const state = createInitialState(DUMMY_MAP, seed)
  const ground = state.regions[AT] as LandRegion
  ground.controller = DEFENDER
  ground.traits = field.traits ?? []
  ground.buildings = { fortification: field.fortification ?? 0 }
  ground.stability = field.stability ?? 50
  setFactionRelation(state, ATTACKER, DEFENDER, 'hostile')
  const a = raise(state, ATTACKER, FROM, attacker)
  raise(state, DEFENDER, AT, defender)
  if (field.shock === false) state.taskForces[0].shock = 'planning'
  const order = orderMove(state, a, AT)
  if (!order.ok) throw new Error(`${attacker.name}: ${order.reason}`)

  let battle = state.battles[0]
  let endReason: EndReason = 'none'
  let samples = 0
  let frontA = 0
  let frontD = 0
  while (state.tick < maxTicks) {
    state.tick += 1
    moveTaskForces(state)
    startStandoffs(state)
    resolveBattles(state)
    battle = state.battles[0]
    if (battle) {
      samples += 1
      frontA += battle.attacker.frontLine.filter((id) => id !== null).length
      frontD += battle.defender.frontLine.filter((id) => id !== null).length
    }
    if (battle && battle.endedAt !== null) {
      // Read the loser's Organization before recovery starts topping it back up.
      const loserId = battle.outcome === 'defender-won' ? battle.attacker.taskForceId : battle.defender.taskForceId
      const loser = state.taskForces.find((t) => t.id === loserId)
      endReason = loser && organization(state, loser) <= 0 ? 'organization' : 'no-line'
      break
    }
    recoverTaskForces(state)
  }
  if (!battle) throw new Error('No battle started')
  const outcome = battle.outcome ?? 'timeout'
  return {
    outcome,
    attackerWon: outcome === 'attacker-won' || outcome === 'defender-surrendered' || outcome === 'defender-withdrew',
    endReason,
    ticks: (battle.endedAt ?? state.tick) - battle.startedAt + 1,
    attacker: report(state, attacker, battle.attacker, frontA / Math.max(1, samples)),
    defender: report(state, defender, battle.defender, frontD / Math.max(1, samples)),
  }
}

export interface MatchupSummary {
  attacker: string
  defender: string
  runs: number
  /** Share of runs the attacker won, 0–1. */
  attackerWinRate: number
  timeouts: number
  meanTicks: number
  /** Mean share of each side's starting Production value destroyed, 0–1. */
  attackerLossShare: number
  defenderLossShare: number
  attackerManpowerLost: number
  defenderManpowerLost: number
  /** Share of decided battles that ended because the loser's Organization hit zero, 0–1. */
  brokeShare: number
}

/** Run the same matchup over `runs` seeds and average it. */
export function runMatchup(attacker: Force, defender: Force, runs: number, field: Battlefield = {}): MatchupSummary {
  let wins = 0
  let timeouts = 0
  let ticks = 0
  let aLoss = 0
  let dLoss = 0
  let aMp = 0
  let dMp = 0
  let broke = 0
  for (let seed = 1; seed <= runs; seed++) {
    const r = runBattle(attacker, defender, seed * 7919, field)
    if (r.attackerWon) wins++
    if (r.outcome === 'timeout') timeouts++
    if (r.endReason === 'organization') broke++
    ticks += r.ticks
    aLoss += r.attacker.costLost / r.attacker.cost
    dLoss += r.defender.costLost / r.defender.cost
    aMp += r.attacker.manpowerLost
    dMp += r.defender.manpowerLost
  }
  return {
    attacker: attacker.name,
    defender: defender.name,
    runs,
    attackerWinRate: wins / runs,
    timeouts,
    meanTicks: ticks / runs,
    attackerLossShare: aLoss / runs,
    defenderLossShare: dLoss / runs,
    attackerManpowerLost: aMp / runs,
    defenderManpowerLost: dMp / runs,
    brokeShare: runs > timeouts ? broke / (runs - timeouts) : 0,
  }
}
