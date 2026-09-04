# Ragnorosis

A grand-strategy game based on the Ragnorosis novels. Currently the **Epoch 1 sandbox**: the
13-region dummy map, the Pulse/Tick clock, region stats, Energy, buildings, and a devtools panel.

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
- **Military** (right edge): Equipment and Manpower pools with what lands at the end of the pulse.
- **Dev** (bottom left): edit any stored value, step ticks/pulses, and read the resolution log.

## Design docs

- [`docs/ragnorosis_gdd.md`](docs/ragnorosis_gdd.md) — full Game Design Document
- [`docs/epoch1-implementation-skeleton.md`](docs/epoch1-implementation-skeleton.md) — Epoch 1 spec
- [`docs/epoch1-decisions.md`](docs/epoch1-decisions.md) — rulings made while implementing Epoch 1, and
  changes the GDD needs

## Code layout

- `src/sim/` — the simulation core: plain TypeScript, no React. `GameState` is data; `advanceTick` is the
  only way it moves. Formulas live in `sim/formulas/`, tick/pulse mutations in `sim/steps/`, the authored
  map in `sim/data/`. Derived values (Production, Supply, Research rate, Defensibility, the Stability
  anchor) are computed from state, never stored.
- `src/store/` — Zustand stores: `gameStore` (sim state + the run loop) and `uiStore` (hover/pin, windows).
- `src/components/` — React UI. `panels/` holds the generic entity panel, the Region panel, and the pinned
  tooltip windows; `devtools/` the dev panel.

## Scripts

- `npm run dev` — dev server · `npm run build` — type-check and build
- `npm test` / `npm run test:watch` — Vitest · `npm run lint` — oxlint · `npm run format` — Prettier
