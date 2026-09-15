import { formatDate } from '../../sim/clock'
import { FACTIONS } from '../../sim/data/factions'
import { formatInt } from '../../sim/format'
import { formatLosses, lossValue } from '../../sim/military/battle'
import type { Battle, BattleOutcome } from '../../sim/types'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { factionColor } from '../factionColors'

const OUTCOME_LABEL: Record<BattleOutcome, string> = {
  'attacker-won': 'Attacker won',
  'defender-won': 'Defender held',
  'attacker-withdrew': 'Attacker withdrew',
  'defender-withdrew': 'Defender withdrew',
  'defender-surrendered': 'Defender surrendered',
}

/**
 * The Battle Logs browser (Epoch 2 skeleton §6): live battles first, then history. Production
 * value of losses is computed on open at *today's* costs — deliberately not historical.
 */
export function BattleLogs() {
  const { open, battleId } = useUIStore((s) => s.battleLogs)
  const close = useUIStore((s) => s.closeBattleLogs)
  const focus = useUIStore((s) => s.openBattleLogs)
  const game = useGameStore((s) => s.game)
  if (!open) return null

  const battles = [...game.battles].sort(
    (a, b) => Number(a.endedAt !== null) - Number(b.endedAt !== null) || b.startedAt - a.startedAt,
  )
  const selected = battles.find((b) => b.id === battleId) ?? battles[0]

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink-950/70" onClick={close}>
      <div
        className="flex h-[30rem] w-[52rem] max-w-[calc(100%-2rem)] flex-col rounded border border-ink-600 bg-ink-900 shadow-2xl"
        role="dialog"
        aria-label="Battle Logs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
          <h2 className="text-xs tracking-[0.25em] text-signal uppercase">Battle Logs</h2>
          <button type="button" onClick={close} aria-label="Close" className="text-ink-400 hover:text-ink-100">
            ×
          </button>
        </div>
        {battles.length === 0 ? (
          <p className="p-5 text-xs text-ink-400">No battles yet.</p>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[18rem_1fr]">
            <ul className="overflow-y-auto border-r border-ink-700 p-2 text-xs">
              {battles.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => focus(b.id)}
                    className={`w-full rounded px-2 py-1.5 text-left hover:bg-ink-100/5 ${selected?.id === b.id ? 'bg-ink-100/10' : ''}`}
                  >
                    <div className="flex justify-between">
                      <span className="text-ink-100">{game.regions[b.regionId].name}</span>
                      <span className={b.endedAt === null ? 'text-alert' : 'text-ink-400'}>
                        {b.endedAt === null ? 'LIVE' : OUTCOME_LABEL[b.outcome!]}
                      </span>
                    </div>
                    <div className="text-[10px] text-ink-400">
                      {b.attacker.name} vs {b.defender.name} · {formatDate(b.startedAt)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {selected && <BattleDetail battle={selected} />}
          </div>
        )}
      </div>
    </div>
  )
}

function BattleDetail({ battle }: { battle: Battle }) {
  const game = useGameStore((s) => s.game)
  const region = game.regions[battle.regionId]
  const live = battle.endedAt === null
  const duration = (live ? game.tick : battle.endedAt!) - battle.startedAt
  return (
    <div className="overflow-y-auto p-5 text-xs">
      <h3 className="text-sm tracking-[0.15em] text-ink-100 uppercase">
        Invasion of {region.name}
        {live && <span className="ml-2 text-alert">· live</span>}
      </h3>
      <p className="mt-1 text-ink-400">
        {formatDate(battle.startedAt)} · {duration} ticks
        {battle.outcome && ` · ${OUTCOME_LABEL[battle.outcome]}`}
        {battle.shock && ` · Shock ×${battle.shock.multiplier.toFixed(1)} until tick ${battle.shock.until}`}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {(['attacker', 'defender'] as const).map((role) => {
          const side = battle[role]
          const value = lossValue(game, side)
          return (
            <div key={role} className="rounded border border-ink-700 p-3">
              <div className="text-[10px] tracking-[0.15em] text-ink-400 uppercase">{role}</div>
              <div className="text-ink-100" style={{ color: factionColor(side.faction) }}>
                {side.name} <span className="text-ink-400">· {FACTIONS[side.faction].name}</span>
              </div>
              <dl className="mt-2 space-y-1">
                <Row label="Hits landed" value={String(side.hitsLanded)} />
                <Row label="Losses" value={formatLosses(game, side)} />
                <Row label="Production lost" value={`${formatInt(value)} Prod`} />
                {live && (
                  <>
                    <Row label="On the line" value={String(side.frontLine.filter((x) => x !== null).length)} />
                    <Row label="In Reserves" value={String(Object.values(side.reserves).reduce((a, b) => a + b, 0))} />
                  </>
                )}
              </dl>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[10px] text-ink-400">
        Production lost is valued at today's costs whenever this log is opened, not the cost at the time of each loss.
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-right text-ink-100">{value}</dd>
    </div>
  )
}
