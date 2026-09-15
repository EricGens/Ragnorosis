// Save & Load (Epoch 2 skeleton §8): at-rest saves only, fresh randomness on load, no cross-epoch
// compatibility, and one Load entry point that dispatches on the file's own mode marker.

import type { FactionId, GameState } from './types'

export const SAVE_FORMAT = 'ragnorosis-save'
export const SAVE_VERSION = 1
export const SAVE_EPOCH = 2

export type SaveMode = 'sandbox'

export interface SaveFile {
  format: typeof SAVE_FORMAT
  version: number
  epoch: number
  /** Which context Load should open the game in; only the sandbox exists today. */
  mode: SaveMode
  savedAt: string
  perspective: FactionId
  game: GameState
}

export type SaveResult = { ok: true; json: string; filename: string } | { ok: false; reason: string }
export type ParseResult = { ok: true; save: SaveFile } | { ok: false; reason: string }

/** Serialize a game at rest. A live battle refuses the save rather than half-capturing it. */
export function serializeSave(game: GameState, perspective: FactionId, now = new Date()): SaveResult {
  if (game.battles.some((b) => b.endedAt === null)) {
    return { ok: false, reason: 'Save is available only at rest — a battle is in progress.' }
  }
  const save: SaveFile = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    epoch: SAVE_EPOCH,
    mode: 'sandbox',
    savedAt: now.toISOString(),
    perspective,
    game,
  }
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return { ok: true, json: JSON.stringify(save), filename: `ragnorosis-sandbox-${stamp}.json` }
}

/** Parse and sanity-check a save file; the reasons are player-facing. */
export function parseSave(json: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'That file is not valid JSON.' }
  }
  if (typeof data !== 'object' || data === null) return { ok: false, reason: 'That file is not a Ragnorosis save.' }
  const s = data as Partial<SaveFile>
  if (s.format !== SAVE_FORMAT) return { ok: false, reason: 'That file is not a Ragnorosis save.' }
  if (s.epoch !== SAVE_EPOCH || s.version !== SAVE_VERSION) {
    return {
      ok: false,
      reason: `This save is from Epoch ${s.epoch ?? '?'} (format v${s.version ?? '?'}); only Epoch ${SAVE_EPOCH} saves load.`,
    }
  }
  if (s.mode !== 'sandbox') return { ok: false, reason: `"${String(s.mode)}" saves aren't supported yet.` }
  const g = s.game as Partial<GameState> | undefined
  if (
    !g ||
    typeof g.tick !== 'number' ||
    typeof g.regions !== 'object' ||
    !Array.isArray(g.taskForces) ||
    !g.factions
  ) {
    return { ok: false, reason: 'That save file is incomplete.' }
  }
  if (typeof s.perspective !== 'string' || !(s.perspective in g.factions)) {
    return { ok: false, reason: 'That save file names an unknown faction.' }
  }
  return { ok: true, save: s as SaveFile }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

/** The game as it should resume: identical state, a fresh random seed (§8: repeatable tests, fresh outcomes), nothing pending. */
export function restoreGame(save: SaveFile, seed = randomSeed()): GameState {
  return { ...save.game, rngSeed: seed, interrupts: [] }
}
