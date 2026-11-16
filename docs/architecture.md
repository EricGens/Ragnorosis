# Ragnorosis — Code Architecture

A map of the codebase for whoever picks it up next. The design documents say *what the game does*; this
says *where that lives in the code and how to add to it*. Keep it current: if a change makes a sentence
here false, fix the sentence in the same PR.

Last reviewed 2026-11-16 (Epoch 2 feature-complete, in playtest).

## 1. The three layers

```
src/sim/          The simulation. Plain TypeScript: no React, no browser, no store.
src/store/        Two Zustand stores that hold state and expose actions to the UI.
src/components/   React. Reads the stores, draws, calls store actions.
```

Dependencies point one way: components → store → sim. The sim never imports from the other two, which is
why it can be tested without a browser and why a balance simulator or an AI opponent could drive it
directly later.

(One known wrinkle: `store/uiStore.ts` imports window-placement maths from `components/panels/placement.ts`.
It is a pure function and harmless, but it belongs somewhere neutral if it ever grows.)

## 2. The simulation core (`src/sim/`)

### The rules everything follows

1. **`GameState` is plain data** (`types.ts`). No classes, no methods, nothing that can't be written to
   JSON. A save file is literally `GameState` plus a header.
2. **Time moves only through `advanceTick`** (`advance.ts`). One call is one game hour. Game speed changes
   how often the UI calls it, never what it computes.
3. **Compute, don't store.** If a value can be worked out from other state — Production, Supply, Research
   rate, Defensibility, the Stability anchor, domain control, a unit design's stats, a Task Force's speed
   and maximum Organization — it is a function, not a field. Stored fields are the *inputs*. This is why
   devtools only edits inputs, and why nothing ever goes stale.
4. **Mutating functions take an Immer draft.** Files say so in their header ("every function here operates
   on an Immer draft"). They are called inside `produce(...)` — by `advanceTick`, by the store's `run`
   helper, or by a test. Pure functions (everything in `formulas/`, `combat.ts`, `design.ts`) just read.
5. **Player actions return a result, they don't throw.** `{ ok: true, ... } | { ok: false, reason }`, where
   `reason` is a sentence the UI can show as-is (`orderMove`, `saveDesign`, `queueBuild`, …). Thrown errors
   are reserved for bugs and bad authored data.
6. **All randomness comes from `nextRandom(state)`** (`rng.ts`), which advances `state.rngSeed`. Same seed,
   same inputs, same outcome — so tests of combat are exact, not statistical. It also means **the order of
   `nextRandom` calls is part of the rules**: reordering two rolls inside a battle changes every seeded
   outcome even if the logic is "the same". When refactoring combat, compare full-state hashes of a seeded
   scenario before and after.
7. **Symmetric pairs use `pairKey(a, b)`** (`relations.ts`): faction relations, country relations, edge
   distances. Unstored pairs mean the default (Neutral / At Peace).
8. **Float comparisons against a threshold allow `EPSILON`** (`numeric.ts`). Progress and speeds are
   fractions summed every tick; without the slack, things wait an extra tick over rounding dust.
9. **Every notable thing the sim does is logged** with `log(state, category, message)` (`log.ts`). The
   devtools log viewer is the first place to look when a number surprises you.

### What happens in one tick

From `advanceTick`, in order:

| When | Step | Where |
| --- | --- | --- |
| every tick | `tick += 1` | `advance.ts` |
| first tick of a pulse | take the Energy/Weather snapshot for the pulse | `steps/pulseSteps.ts` `beginPulse` |
| first tick of a pulse | lock each faction's Production split from its focus | `steps/productionSteps.ts` `allocateAllFactions` |
| every tick | Research income | `steps/tickSteps.ts` |
| every tick | Weather countdown / onset | `steps/tickSteps.ts` |
| every tick | Construction progress; completed levels raise an interrupt | `steps/productionSteps.ts` |
| every tick | Task Forces walk; arriving captures; an invasion leg starts a battle | `military/movement.ts` |
| every tick | standoff exchanges start where a flag points at a hostile force | `military/battle.ts` |
| every tick | one round of every live battle, then outcomes | `military/battle.ts` → `battleRound.ts` |
| every tick | Organization regenerates out of contact; consolidation locks lift | `military/battle.ts` |
| last tick of a pulse | Money, Legitimacy | `steps/pulseSteps.ts` |
| last tick of a pulse | Equipment manufactured, Manpower trained and drawn down | `steps/productionSteps.ts` → `military/pipeline.ts` |
| last tick of a pulse | Population growth, immigration, Stability drift | `steps/pulseSteps.ts` |
| last tick of a pulse | consolidation re-check, Shock "Planning" clears | `military/battle.ts` |

A pulse is 168 ticks (one week). "First tick of a pulse" is `tickInPulse(tick) === 1`; "last" is
`isPulseBoundary(tick)`. The pulse snapshot is taken on the *first* tick, not at the boundary, so that
edits made while paused between pulses apply to the pulse about to run. (`useDisplayGame` in the store
previews that snapshot while paused, so the UI shows the effect immediately.)

### Where things are

```
sim/
  types.ts            Every state type. Start here.
  state.ts            createInitialState(map): builds a GameState from a MapDefinition.
  advance.ts          advanceTick / advancePulse — the tick order above.
  clock.ts            Tick/pulse/calendar arithmetic.
  snapshot.ts         The pulse-start Energy/Weather snapshot.
  relations.ts        Faction & country relationship matrix, with its cascades.
  construction.ts     Queueing buildings (player action).
  save.ts             Save file format, parse, restore.
  format.ts           Number formatting shared by logs and UI.
  log.ts, rng.ts, numeric.ts
  testing.ts          Shared test scaffolding (see §5).
  data/
    map.ts            What a map is (MapDefinition).
    dummyMap.ts       The 13-region sandbox map — one MapDefinition.
    buildings.ts      Building catalog and cost curve.
    factions.ts       Faction names.
  formulas/           Pure economy formulas, one file per topic, each with a test beside it.
  steps/              The per-tick and per-pulse mutations that apply those formulas.
  military/
    platforms.ts      Platform and module catalog (data).
    design.ts         Unit design → stats, validation, naming, adoption between rosters.
    roster.ts         Saving / renaming / deleting designs (player actions).
    taskForce.ts      Composition grid, line slots, raising and disbanding (player actions).
    pipeline.ts       Priority waterfall, manufacturing, stockpile, Manpower drawdown.
    movement.ts       Speed, pathfinding, move orders, redirect, arrival and capture.
    combat.ts         Combat formulas and constants (pure).
    battle.ts         Battle lifecycle: start, end, outcomes, retreat, surrender, recovery.
    battleRound.ts    One tick of one battle: sensors, the three lines, hits, reinforcement, air.
```

`formulas/` vs `steps/` is the pure/mutating split for the economy; `combat.ts` vs `battle*.ts` is the
same split for fighting. Comments cite the spec section they implement (`§5.1` = the current epoch's
implementation skeleton; `GDD §8.6.2` = the Game Design Document).

## 3. Stores (`src/store/`)

- **`gameStore`** holds the `GameState`, which screen is showing, the perspective faction, and the run
  loop (a timer that calls `stepTick` however many times the elapsed real time is worth). Every sim
  action the UI can take is a one-line wrapper here around a sim function, via the `run` helper, which
  applies it to a draft and returns its result. `mutate(fn)` is the devtools escape hatch for arbitrary
  edits.
- **`uiStore`** holds everything that is *not* game state and must not be saved: what's hovered, what's
  pinned, which panels and editors are open, floating tooltip windows, the map's order mode.

Rule of thumb: if loading a save should restore it, it belongs in `GameState`; otherwise in `uiStore`.

## 4. UI (`src/components/`)

`GameScreen.tsx` lists every top-level piece. `MapView.tsx` draws the map as SVG; `panels/` is the
hover/pin entity panel (Region and Task Force), stat rows and their tooltips; `military/` is the Unit
Editor, Task Force Editor and Battle Logs; `devtools/` is the Dev panel.

Things worth knowing before touching it:

- **Tooltips and hints render at the game-area level**, through `uiStore.hoverTooltip` / `hoverHint`, not
  inline next to the thing hovered. An absolutely-positioned element inside the scrollable Region panel
  pushes the panel into scrollbars; that bug was fixed three separate times before the shared mechanism
  existed. Use the mechanism.
- **Components that need derived numbers call sim functions directly** (`designStats`, `etaTicks`,
  `skuStanding`, …). That is intended — it is the UI half of "compute, don't store".
- **`MapView` knows the dummy map's shape.** `shapeFor()` turns the dummy map's grid/corner layout into
  polygons, and the component imports `DUMMY_MAP.layout` directly. See §7.
- **Interactive map elements carry `data-*` attributes** (`data-region`, `data-task-force`, `data-battle`,
  `data-order-flash`, …) so the UI can be driven and checked from a browser automation tool.

## 5. Testing

`npm test` runs Vitest; `npm run check` runs type-check, lint, format check and tests — run it before
opening a PR (CI runs the same thing).

- **Tests sit beside the file they test** (`energy.ts` / `energy.test.ts`).
- **Worked examples in the spec become tests.** If the skeleton says "5 vs 10.8 → attacker 5%, defender
  10.8%", there is a test with those numbers and the section reference in its name. When a ruling
  changes a number, the test changes with it.
- **Scenario tests build a game with `sim/testing.ts`**: `newGame(setup)`, `raiseTaskForce`, `giveRegion`,
  `ticks(state, n)`, and the stock `LIGHT_INFANTRY` / `TOWED_ARTILLERY` designs. Its header shows a
  complete example.
- **Combat tests are exact**, because the RNG is seeded (rule 6). A test that needs "the attacker wins"
  picks force sizes that make it so and asserts the outcome outright.
- **Tests run in Node, not a simulated browser.** A test that renders components must start with the line
  `// @vitest-environment jsdom`. There are no component tests yet; UI behaviour has so far been verified
  by driving the running app.

## 6. How to add things

**A formula or a tuning constant.** Pure function in `formulas/` (or `military/combat.ts`), exported
constant with a comment saying where the number came from, test beside it with the spec's worked example.
Then call it from the relevant step.

**Something that happens every tick or every pulse.** A mutating function in `steps/` (or the relevant
`military/` file), added to `advanceTick` or `resolvePulseEnd` *at a deliberate position* — order matters,
and the table in §2 should gain a row.

**A new stored field.** Add it to `types.ts` with a doc comment; initialise it in `state.ts`
(`createInitialState` / `initialFaction`) or wherever the owning object is created (`createTaskForce`);
add a devtools field if a playtester should be able to set it. First ask whether it can be computed
instead (rule 3). Because saves are the raw state, **an old save will not have the field**: bump
`SAVE_VERSION` in `save.ts` so old files are refused cleanly rather than loaded half-empty.

**A player action.** A sim function taking a draft and returning a result (rule 5), a test, a one-line
wrapper in `gameStore`, then the UI that calls it. Validate in the sim function, not the component — the
UI is not the only caller.

**A building.** Add the id to `BuildingType` in `types.ts`, an entry in `data/buildings.ts`, an icon in
`components/panels/buildingIcons.tsx`, and whatever formula reads its level. TypeScript will point at
every `Record<BuildingType, …>` that needs the new key.

**A module, or a whole platform.** Data in `military/platforms.ts`. A platform also needs its id in
`PlatformId` (`types.ts`) and says which lines it can hold, which vector column it is read against, and
how it is auto-named. Nothing in combat or the editors is per-platform code.

**A new kind of thing on the map** (Agents, next epoch). Add a variant to `EntityRef` in `uiStore.ts`, a
panel under `components/panels/`, a branch in `EntityPanel.tsx`, and markers in `MapView`. Hover, pin and
the floating windows then work for it without new plumbing.

**A new log category.** Add to `LogCategory` in `types.ts` and to `LOG_CATEGORIES` in `DevtoolsPanel.tsx`.

## 7. Known debts and seams

Things deliberately left as they are, so nobody rediscovers them the hard way. None blocks current work.

- **The map renderer is tied to the dummy map.** The sim is map-agnostic (it takes any `MapDefinition`),
  but `MapView` reads `DUMMY_MAP.layout` and only understands "grid cell" and "ocean corner" shapes, and
  `gameStore` names `DUMMY_MAP` when starting a sandbox. Epoch 6 (the full world map) needs real region
  geometry in `MapDefinition.layout` and a renderer that draws it. `docs/art-direction.md` already plans a
  canvas/WebGL renderer, so `MapView` is expected to be rewritten rather than extended — keep new
  game logic out of it.
- **Saves have no migration path.** By ruling (Epoch 2 decisions, "Save & Load"), a save from a different
  version is refused. Fine for a sandbox; a real campaign will eventually want upgrades between versions.
- **`parseSave` checks the header and a few top-level fields, not the whole state.** A hand-edited save can
  load and then misbehave.
- **Battles are strictly one attacker against one defender.** A second attacker waits at the border; a
  second defender is fought afterwards. `Battle` has exactly two `BattleSide`s, and `battleRound.ts`
  assumes it throughout. Multi-force battles will be a real change, not a parameter.
- **Design and Task Force ids are numbers that also appear as string keys** (`stockpile`, `reserves`,
  `unitsLost` are `Record<string, number>` keyed by design id), hence the scattered `Number(id)`. Bank keys
  are `"designId|tier"` strings. It works and is covered by tests; a branded id type would be tidier.
- **Some log lines print faction ids** ("united-states collects…") where others print names ("United
  States and China are now hostile"). Cosmetic; `FACTIONS[id].name` is the fix when someone cares.
- **`DevtoolsPanel.tsx` (≈550 lines) and `MapView.tsx` (≈650) are the largest components.** Both are
  several small components in one file and split naturally along those lines when next worked on.
- **No component tests.** The harness supports them (§5); nothing has needed one yet.
- **`findPath` scans for the nearest unvisited region linearly.** Instant on 13 regions; wants a proper
  priority queue at 190.

## 8. Documents

| Document | What it is | Who edits it |
| --- | --- | --- |
| `docs/ragnorosis_gdd.md` | The Game Design Document. The source of truth for intent. | Eric |
| `docs/epochN-implementation-skeleton.md` | The buildable spec for one epoch, with worked examples. | Eric |
| `docs/epochN-questions.md` | Gaps found on the implementation side before an epoch starts. | implementer |
| `docs/epochN-decisions.md` | Rulings made while building. Newer than the skeleton where they differ. | implementer, with Eric's rulings |
| `docs/art-direction.md` | Visual intent and content guidelines. | Eric + implementer |
| `docs/dev-environment.md` | Machine setup and the Claude Code sandbox. | implementer |
| `docs/architecture.md` | This file. | implementer |

Order of authority when they disagree: decisions doc, then skeleton, then GDD — and the disagreement
itself gets written down under the decisions doc's "source-doc fixes needed" so the older document can be
corrected. The design documents are hand-authored and excluded from Prettier; never reflow them.
