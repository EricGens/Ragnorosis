import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { advancePulse } from '../advance'
import { DUMMY_MAP } from '../data/dummyMap'
import { createInitialState } from '../state'
import { computeAllocation } from '../steps/productionSteps'
import type { GameState } from '../types'
import {
  demandPools,
  distribute,
  drawdownManpower,
  equipmentProductionRoom,
  manufactureEquipment,
  skuStanding,
  waterfall,
} from './pipeline'
import { saveDesign } from './roster'
import { createTaskForce, cyclePriority, setTarget } from './taskForce'

const US = 'united-states'
const SA = 'inf-small-arms-1'
const AT = 'inf-man-at'
const AA = 'inf-man-aa'

/** US roster: 1 = Light Infantry (50 Prod, 50 Manpower), 2 = Heavy Infantry (70 Prod). */
const base = produce(createInitialState(DUMMY_MAP), (d) => {
  saveDesign(d, US, { name: 'Light Infantry', platform: 'infantry', modules: [SA] })
  saveDesign(d, US, { name: 'Heavy Infantry', platform: 'infantry', modules: [SA, AT, AA] })
})

function withTaskForce(state: GameState, lines: [designId: number, target: number][]): GameState {
  return produce(state, (d) => {
    const r = createTaskForce(d, US, 'w-land')
    if (!r.ok) throw new Error(r.reason)
    for (const [designId, target] of lines) setTarget(d, r.id, designId, target)
  })
}

const light = (s: GameState) => skuStanding(s, US, s.factions[US].designs[0])
const heavy = (s: GameState) => skuStanding(s, US, s.factions[US].designs[1])

describe('waterfall (§3.8)', () => {
  const three = [
    { priority: 'high', need: 100, weight: 100 },
    { priority: 'normal', need: 100, weight: 100 },
    { priority: 'low', need: 100, weight: 100 },
  ] as const

  it('splits 60/30/10 across the tiers when everyone is short', () => {
    expect(waterfall(100, [...three]).grants).toEqual([60, 30, 10])
  })

  it('flows what a tier does not need down to the next', () => {
    // High gets 120 but needs 100 → 20 flows to Normal (60 + 20), Low keeps its 20.
    expect(waterfall(200, [...three]).grants).toEqual([100, 80, 20])
    const r = waterfall(1000, [...three])
    expect(r.grants).toEqual([100, 100, 100])
    expect(r.leftover).toBe(700)
  })

  it('offers what the Low tier leaves back to anyone still short (no tier reserves for nobody)', () => {
    // Only Normal demand: 30% + High's 60% = 90 first, then Low's untouched 10 comes back around.
    expect(waterfall(100, [{ priority: 'normal', need: 100, weight: 100 }]).grants).toEqual([100])
    const r = waterfall(100, [{ priority: 'normal', need: 95, weight: 100 }])
    expect(r.grants).toEqual([95])
    expect(r.leftover).toBe(5)
  })

  it('recycles within a tier before anything waterfalls', () => {
    // Two High recipients, equal weight: A saturates at 10 of its 30 share; the 20 goes to B.
    const r = waterfall(100, [
      { priority: 'high', need: 10, weight: 100 },
      { priority: 'high', need: 200, weight: 100 },
      { priority: 'normal', need: 100, weight: 100 },
      { priority: 'low', need: 100, weight: 100 },
    ])
    expect(r.grants).toEqual([10, 50, 30, 10])
  })

  it('distribute() terminates and returns the surplus when everyone saturates', () => {
    const r = distribute(100, [
      { need: 10, weight: 1 },
      { need: 20, weight: 1 },
    ])
    expect(r.grants).toEqual([10, 20])
    expect(r.leftover).toBe(70)
  })
})

describe('Equipment manufacturing (§3.7–3.10)', () => {
  it('is binary per unit: Production banks until a whole unit is affordable', () => {
    const s = withTaskForce(base, [[1, 1]])
    const s1 = produce(s, (d) => void manufactureEquipment(d, US, 40))
    expect(light(s1).equipped).toBe(0)
    expect(light(s1).banked).toBe(40)
    const s2 = produce(s1, (d) => void manufactureEquipment(d, US, 10))
    expect(light(s2).equipped).toBe(1)
    expect(light(s2).banked).toBe(0)
  })

  it('fills Task Force demand before stockpiling, then stockpiles toward 3× demand', () => {
    const s = withTaskForce(base, [[1, 1]])
    // Wants 1 unit (50) + 3 in the stockpile (150) = 200 Production of room.
    expect(equipmentProductionRoom(s, US)).toBe(200)
    const s1 = produce(s, (d) => void manufactureEquipment(d, US, 199.2))
    expect(light(s1)).toMatchObject({ equipped: 1, target: 1, stockpile: 2, stockpileCap: 3 })
    expect(light(s1).banked).toBeCloseTo(49.2)
    const s2 = produce(s1, (d) => void manufactureEquipment(d, US, 0.8))
    expect(light(s2)).toMatchObject({ equipped: 1, stockpile: 3 })
    expect(equipmentProductionRoom(s2, US)).toBe(0)
  })

  it('splits stockpile production 250/320 vs 70/320 between 5 Light and 1 Heavy at full strength (§3.9)', () => {
    const s = produce(
      withTaskForce(base, [
        [1, 5],
        [2, 1],
      ]),
      (d) => {
        for (const line of d.taskForces[0].composition) line.equipment = line.target
      },
    )
    const s1 = produce(s, (d) => void manufactureEquipment(d, US, 320))
    expect(light(s1).stockpile).toBe(5) // 250 Production → 5 × 50
    expect(heavy(s1).stockpile).toBe(1) // 70 Production → 1 × 70
  })

  it('recomputes the split once a type hits its cap — the other gets everything', () => {
    const s = produce(
      withTaskForce(base, [
        [1, 5],
        [2, 1],
      ]),
      (d) => {
        for (const line of d.taskForces[0].composition) line.equipment = line.target
        d.factions[US].stockpile[2] = 3 // Heavy already at its 3× cap
      },
    )
    const s1 = produce(s, (d) => void manufactureEquipment(d, US, 320))
    expect(light(s1).stockpile).toBe(6)
    expect(heavy(s1).stockpile).toBe(3)
  })

  it('serves High-priority demand first and pools Military Button lines per priority', () => {
    const s = produce(withTaskForce(withTaskForce(base, [[1, 2]]), [[1, 2]]), (d) => {
      cyclePriority(d, 2, 1) // second Task Force: Normal → High
    })
    expect(demandPools(s, US).map((p) => [p.priority, p.target])).toEqual([
      ['normal', 2],
      ['high', 2],
    ])
    // 100 Production: High gets 60 + Low's unused 10 → 1 unit (20 banked); Normal banks its 30.
    const s1 = produce(s, (d) => void manufactureEquipment(d, US, 100))
    expect(s1.taskForces[1].composition[0].equipment).toBe(1)
    expect(s1.taskForces[0].composition[0].equipment).toBe(0)
    expect(s1.factions[US].manufacturing).toEqual({ '1|high': 20, '1|normal': 30 })
    // Each tier's bank builds for its own lines. Another 100: High needs only 50 more (→ full),
    // Normal gets 30 + High's 10 spare + Low's 10 = 50 → its bank reaches 80 → its first unit.
    const s2 = produce(s1, (d) => void manufactureEquipment(d, US, 100))
    expect(s2.taskForces[1].composition[0].equipment).toBe(2)
    expect(s2.taskForces[0].composition[0].equipment).toBe(1)
    expect(s2.factions[US].manufacturing).toEqual({ '1|high': 20, '1|normal': 30 })
  })

  it('an over-cap stockpile is a valid, stable state that simply stops production (§3.9)', () => {
    const s = produce(withTaskForce(base, [[1, 10]]), (d) => {
      d.taskForces[0].composition[0].equipment = 10
      d.factions[US].stockpile[1] = 83
    })
    expect(light(s)).toMatchObject({ equipped: 10, target: 10, stockpile: 83, stockpileCap: 30 })
    expect(equipmentProductionRoom(s, US)).toBe(0)
    expect(computeAllocation(s, US).equipment).toBe(0)
    expect(produce(s, (d) => void manufactureEquipment(d, US, 500))).toEqual(s)
  })

  it('reaches the skeleton\'s "1/1, Stockpile 3/3" through real pulses', () => {
    let s = withTaskForce(base, [[1, 1]])
    for (let i = 0; i < 3; i++) s = advancePulse(s)
    expect(light(s)).toMatchObject({ equipped: 1, target: 1, stockpile: 3, stockpileCap: 3 })
    expect(computeAllocation(s, US).equipment).toBe(0) // nothing left to build → reroutes
    // A newly-added, not-yet-equipped Heavy Infantry line shows 0/1, Stockpile 0/3.
    const s2 = produce(s, (d) => void setTarget(d, 1, 2, 1))
    expect(heavy(s2)).toMatchObject({ equipped: 0, target: 1, stockpile: 0, stockpileCap: 3 })
  })
})

describe('Manpower drawdown (§3.7, §3.10)', () => {
  it('fills lines linearly from the pool — 60 of 100 needed is a 60% unit', () => {
    const s = produce(withTaskForce(base, [[1, 2]]), (d) => {
      d.factions[US].manpower = 60
      drawdownManpower(d, US)
    })
    expect(s.taskForces[0].composition[0].manpower).toBe(60)
    expect(s.factions[US].manpower).toBe(0)
  })

  it('splits a contested pool 60/30/10 by priority', () => {
    // Two Task Forces each wanting 2 Light Infantry (100 Manpower): one High, one Low; pool 100.
    const s = produce(withTaskForce(withTaskForce(base, [[1, 2]]), [[1, 2]]), (d) => {
      cyclePriority(d, 1, 1) // Normal → High
      cyclePriority(d, 2, 1)
      cyclePriority(d, 2, 1) // Normal → High → Low
      d.factions[US].manpower = 100
      drawdownManpower(d, US)
    })
    expect(s.taskForces[0].composition[0].manpower).toBe(60)
    expect(s.taskForces[1].composition[0].manpower).toBe(40) // 10% + Normal's unused 30%
    expect(s.factions[US].manpower).toBe(0)
  })

  it('fills completely when the pool suffices and never draws more than a line needs', () => {
    const s = produce(withTaskForce(base, [[1, 2]]), (d) => {
      d.factions[US].manpower = 1000
      drawdownManpower(d, US)
    })
    expect(s.taskForces[0].composition[0].manpower).toBe(100)
    expect(s.factions[US].manpower).toBe(900)
  })

  it('uses Manpower independently of Equipment (§3.10 sources each independently)', () => {
    const s = produce(withTaskForce(base, [[1, 1]]), (d) => {
      d.factions[US].manpower = 50
      drawdownManpower(d, US)
    })
    expect(s.taskForces[0].composition[0]).toMatchObject({ equipment: 0, manpower: 50 })
  })
})
