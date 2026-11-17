import { describe, expect, it } from 'vitest'
import { forceCost, runBattle, runMatchup } from './arena'
import { DESIGNS, mix, pure } from './forces'

describe('balance arena', () => {
  it('prices a force from its designs', () => {
    expect(forceCost(mix('x', [DESIGNS.atInf, 10], [DESIGNS.mbt, 2]))).toEqual({ cost: 1000, manpower: 532 })
    expect(pure(6000, DESIGNS.mbt).units[0][1]).toBe(30)
  })

  it('replays the same battle for the same seed', () => {
    const a = pure(1200, DESIGNS.atInf)
    const b = pure(1200, DESIGNS.mbt)
    expect(runBattle(a, b, 42)).toEqual(runBattle(a, b, 42))
  })

  it('reports a decided battle with losses on both ledgers', () => {
    const r = runBattle(pure(3000, DESIGNS.atInf), pure(3000, DESIGNS.atInf), 7)
    expect(r.outcome).not.toBe('timeout')
    expect(r.attacker.cost).toBe(3000)
    expect(r.attacker.costLost + r.defender.costLost).toBeGreaterThan(0)
    expect(r.attackerWon).toBe(r.outcome !== 'defender-won')
  })

  it('shows a hard counter: Light Utility Vehicles have no vector against Tanks and never touch them', () => {
    const m = runMatchup(pure(3000, DESIGNS.utility), pure(3000, DESIGNS.mbt), 10)
    expect(m.attackerWinRate).toBe(0)
    expect(m.defenderLossShare).toBe(0)
  })
})
