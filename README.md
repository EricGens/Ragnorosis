# Ragnorosis

A grand-strategy game based on the Ragnorosis novels. Currently a **sandbox** on a 13-region dummy map:
the Pulse/Tick clock, the economy (Energy, Production, buildings), unit design, Task Forces, movement and
land combat, save/load, and a devtools panel for setting up any situation by hand. Epochs 1 and 2 of the
plan in GDD §12 are built; Epoch 2 is in playtest.

## Running it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (normally http://localhost:5173), click **Sandbox**, and pick a faction.

- **Map:** hover a region to preview its panel, click to pin it. WASD pans, the mouse wheel or +/− zooms.
- **Time:** the play button runs to the next Pulse boundary and pauses; 1×/2×/5× change only how fast
  ticks are shown. A completed building also pauses the game.
- **Stats:** hover any stat for an explanation; click it to pin the explanation as a floating window.
- **Buildings:** in a region you control, the next empty grid square starts a new building; clicking an
  occupied square queues its next level. Up to four projects build at once, faction-wide.
- **Top bar:** Money, Research, Legitimacy, and pooled Production with the societal focus (click to change).
- **Military** (right edge): Equipment and Manpower pools, what each unit type still needs, the Unit
  Editor, and Battle Logs.
- **Task Forces:** raise one from the Military panel in a region you control, set its composition, then
  pin it on the map and click a region to move it (shift-click queues a further leg). The rocket beside a
  pinned Task Force aims long-range fire at an adjacent hostile region. Moving into a hostile Task Force's
  region starts a battle; the crossed swords open its live log.
- **Save / Load** (top bar): downloads a `.json` and keeps a quick-save for the title screen's Continue.
- **Dev** (bottom left): edit any stored value, set faction relations, create and fill Task Forces, step
  ticks/pulses, and read the resolution log.

## Documents

- [`docs/architecture.md`](docs/architecture.md) — **start here to work on the code**: layers, tick order,
  conventions, where things live, how to add things, known debts
- [`docs/ragnorosis_gdd.md`](docs/ragnorosis_gdd.md) — the full Game Design Document
- [`docs/epoch1-implementation-skeleton.md`](docs/epoch1-implementation-skeleton.md),
  [`docs/epoch2-implementation-skeleton.md`](docs/epoch2-implementation-skeleton.md) — the buildable spec
  for each epoch
- [`docs/epoch1-decisions.md`](docs/epoch1-decisions.md),
  [`docs/epoch2-decisions.md`](docs/epoch2-decisions.md) — rulings made while implementing; newer than the
  skeletons where they differ
- [`docs/art-direction.md`](docs/art-direction.md) — visual intent and content guidelines
- [`docs/dev-environment.md`](docs/dev-environment.md) — machine setup (WSL2) and the Claude Code sandbox
- [`CLAUDE.md`](CLAUDE.md) — working agreement and quick reference for AI-assisted sessions

## Code layout

- `src/sim/` — the simulation: plain TypeScript, no React. `GameState` is data; `advanceTick` is the only
  way it moves. Economy formulas in `sim/formulas/`, tick/pulse mutations in `sim/steps/`, units, Task
  Forces, movement and combat in `sim/military/`, authored data in `sim/data/`. Derived values are
  computed from state, never stored.
- `src/store/` — Zustand stores: `gameStore` (sim state, player actions, the run loop) and `uiStore`
  (hover/pin, panels, windows).
- `src/components/` — React UI: the map, the entity panels (`panels/`), the military editors and Battle
  Logs (`military/`), and the dev panel (`devtools/`).

## Scripts

- `npm run dev` — dev server · `npm run build` — type-check and build
- `npm run check` — type-check, lint, format check and tests in one go (CI runs the same on every PR)
- `npm test` / `npm run test:watch` — Vitest · `npm run lint` — oxlint · `npm run format` — Prettier
