# Epoch 1 — Foundation: Map, Time, Basic Economy
## Implementation Document (SUBSTANTIALLY COMPLETE — all five components resolved, one small open item remains)

*Companion to the full GDD (ragnorosis_gdd.md, currently v2.1). This document specifies what to build for
Epoch 1 specifically; the GDD remains the source of truth for *why* each system works the way it does. Where
this doc gives a number or a rule that conflicts with the GDD, the GDD wins — flag it as a bug in this doc,
not an override. Several numbers and rules below are new content that doesn't exist in the GDD at all yet
(worked out here first, implementation-driven) — those are marked NEW rather than SOURCE-tagged.*

**Source in the GDD:** §12.1 (this epoch's charter), plus the systems it draws from: §2.1 (Time & Turn
Architecture), §6 (The Board), §7 (Economy & Resources), §7.7–7.8 (Buildings, Energy).

**Building principle for this whole epoch:** build the general system, seed it with a small dataset. A 3×3
dummy map is *data*, not a special case in the code — the region model, the adjacency graph, the panel/UI
system, and the building system all need to be exactly what the full 190-region game will use later, just
populated with fewer rows.

**A second principle that's emerged repeatedly while working through this epoch: compute, don't store.**
Per-capita GDP, "what does this tech unlock," adjacency-edge move-legality — every one of these gets computed
fresh from its true source values whenever needed, never cached as its own field that could drift out of
sync. Apply this by default to anything new that looks derivable from other fields.

---

## 0. Epoch Summary

**What this epoch delivers:** a real map (small, but built on the general region/adjacency model), a working
Pulse/Tick clock, a generic hover/pin panel system for inspecting any entity, and a testable basic economy
loop — Production spent on a handful of buildings, region stats updating on their proper cadence, Global
Tension displayed but inert.

**What this epoch does *not* include** (explicitly out of scope, arriving in later epochs): Agents, Task
Forces, combat, tech research, events, diplomacy *gameplay* (the state exists, the verbs don't yet), the full
190-region map, domain-control computation (air/sea superiority defaults to a dev-editable flat 100%).

**Definition of done:** a dev (or Fable, or a future collaborator) can open the sandbox, see the 13-region
dummy map, click through regions to inspect and edit their stats via the panel system, advance time at
variable speed, and watch a region's numbers respond to buildings and Weather — all through the devtools
panel, with no hardcoded assumptions that would break if the map were swapped for the full one later.

---

## 1. Component: Region Data Model & Map

*SOURCE: GDD §6.1–6.2, §7 (all), §7.7–7.8*

### 1.1 The Dummy Map — RESOLVED, full topology confirmed

**13 regions total: 9 land in a 3×3 grid, 4 maritime surrounding them.**

**Land grid** (orthogonal adjacency only — no diagonal movement, matching how the real map will work):
NW Land, N Land, NE Land, W Land, C Land, E Land, SW Land, S Land, SE Land.

**Maritime** (larger than land regions, each touching multiple land regions): NW Maritime, NE Maritime,
SW Maritime, SE Maritime.

**Complete adjacency graph, confirmed and cross-checked for symmetry:**
- NW Land ↔ N Land, W Land, NW Maritime
- N Land ↔ NW Land, NE Land, C Land, NW Maritime, NE Maritime
- NE Land ↔ N Land, E Land, NE Maritime
- W Land ↔ NW Land, C Land, SW Land, NW Maritime, SW Maritime
- C Land ↔ N Land, W Land, E Land, S Land *(landlocked by design — no maritime adjacency, can never be
  directly bombarded or amphibiously assaulted)*
- E Land ↔ NE Land, C Land, SE Land, NE Maritime, SE Maritime
- SW Land ↔ W Land, S Land, SW Maritime
- S Land ↔ SW Land, C Land, SE Land, SW Maritime, SE Maritime
- SE Land ↔ E Land, S Land, SE Maritime
- NW Maritime ↔ NE Maritime, SW Maritime, NW Land, N Land, W Land
- NE Maritime ↔ NW Maritime, SE Maritime, NE Land, N Land, E Land
- SW Maritime ↔ NW Maritime, SE Maritime, SW Land, W Land, S Land
- SE Maritime ↔ NE Maritime, SW Maritime, SE Land, E Land, S Land

**Deliberate asymmetry, confirmed intentional:** the four corner land regions each touch exactly one maritime
region; the four edge-middle land regions (N/W/E/S) each touch two — built specifically so a region like
N Land can be approached amphibiously from two independent maritime directions at once, letting later
playtesting exercise multiple Task Forces converging on one contested region (the Taiwan scenario).

### 1.2 Region Type — RESOLVED

**A closed enum, `RegionType: Land | Maritime`** — small, fixed set, determines move *legality* and map
rendering (green vs. blue). Kept deliberately separate from open-ended descriptive **tags** (e.g.
"Mountainous," "Littoral") which modify *behavior or stats* without changing fundamental legality. Adding a
new tag later never touches movement-legality code.

### 1.3 Adjacency — RESOLVED

**Pure boolean topology, nothing else stored on the edge itself.** Move-legality (cargo capacity required,
counts as amphibious, etc.) is **computed at move-time** by querying the target region's `RegionType` against
the mover's own current properties — never cached on the edge.

### 1.4 Region Stats — RESOLVED (formulas; starting values now in §1.6 below)

**Population** — integer. Display-shortened: 1,000,000 → "1M", 1,000 → "1K" (e.g. 232,123 → "232K",
17,883,490 → "17.9M"). Grows slowly per Pulse based on population growth (modifiable by faction traits
implying high immigration, e.g. the Hive's Arcology bonus). Can be reduced by: population→Manpower training
conversion, invasion damage (higher rate) or long-range fire damage (lower rate), and negative net migration
from low Stability. *(Growth-rate formula and invasion/fire-damage-to-population ratios: not yet specified —
deferred, likely alongside combat detail in a later epoch, but the field and its display rules are ready now.)*

**GDP** — floating point, current-day-dollar terms, shortened with B/M (billions/millions). Produces Money for
the controlling faction **each Pulse**. Actual Money yield modulated by Stability and any active
maladies/buffs. Set at game start reflecting real-world development level (Taiwan high, Central America low,
etc. — actual per-region numbers pending). Rises with Population growth (roughly holding per-capita GDP
steady), can be raised further by Agent Missions (economic-development flavor, deferred) and modestly by
certain buildings (Fusion Plants contribute more than, say, Fortification levels — building-specific GDP
bonuses TBD per building).

**Production** — NEW, resolved this session. Two additive sources:
- **Baseline: 100 Production from any power plant** (any Energy-generating building type — Fossil Fuel,
  Renewable, or Fusion — each contributes this same flat baseline regardless of type).
- **Population contribution: +1 Production per 100,000 population.** *(Revised from an initial 1-per-10K
  estimate — the higher rate keeps population as a genuine floor for a damaged economy rather than letting it
  dominate building output at realistic region-population scales. Worked check: US West Coast at 54M → 540
  Production from population alone, roughly 5.4 power plants' worth — confirmed as the intended feel.)*
- Spent on: constructing buildings, training Population into military Manpower, producing Equipment for Task
  Forces, generating Supply (§8.7).
- **Two efficiency buildings exist to convert Production more effectively:** **Production Facility** →
  **Molecular Production Facility** (more efficient once Molecular Machinery is researched, §10.3.2) for
  Equipment/construction output; a **Training Facility** for more efficient Manpower conversion — *(this name
  is new, proposed this session; I could not find an existing GDD reference to a dedicated Manpower-efficiency
  building — flagging honestly rather than pretending I found something that isn't there. Needs your
  confirmation this is a real building we're adding, not something I've misremembered.)* All efficiency
  buildings are optional — a region can produce Equipment/Manpower without them, just less efficiently.

**Supply** — derived, not independently stored. Tied to Production (illustrative 1:1 baseline, tech-modified
by Molecular Machinery/Nanotechnology at +10% each). **Displayed in parentheses next to Production** on the
region panel — e.g. `100(110)` — this is an already-established GDD UI convention (§7.7), not new. Consumed
by Task Forces; degraded-performance effects deferred to the Task Force epoch, but the value itself is live
and displayed now.

**Research** — currency-like, but **not saved/spent at discrete decision points** — continuously pushes
progress toward whatever tech a faction currently has focused. **Calculated every Tick, not just every
Pulse** (resolved this session) — this is realistic enough that a highly-developed faction could complete
several shallow, low-tier techs within a single Pulse. Income scales with GDP, Stability, and faction-specific
buffs/maluses; raisable further via Agent Missions (a recurring output boost, and a separate large-lump-sum
mission) — both deferred to the Agent epoch.

**Energy** — NEW, resolved this session, genuinely two related but distinct concepts:
1. **Raw resource stat** — a variable amount per region representing local fossil-fuel reserves (Texas,
   Middle East high; most regions low or zero). **Can exist on maritime regions too** (offshore drilling) —
   this resolves an open question from an earlier session. **Deliberately not gated by political Control** —
   if a faction has sea/air superiority access to a region with sufficient Energy, trade happens even against
   the nominal controller's wishes (shadow-fleet/black-market flavor); genuine denial requires an actively
   enforced blockade, not just a land border claim. *(Whether Control ever applies to this resource at all is
   an open design thread Eric may defer indefinitely, not just for this epoch.)*
2. **Demand/sourcing mechanic** — Fossil Fuel Plants (not necessarily co-located with Energy reserves) create
   demand; Renewable and Fusion plants generate their own Energy, no external sourcing needed. Sourcing
   priority: **same-country regions first**, then search outward; **pathing-clear-of-attrition prioritized
   over proximity** when choosing among viable sources.
3. **Global scarcity, fair-share model (resolved, worked example confirmed):** total demand vs. total supply
   computed first — if global demand exceeds global supply, **every faction gets the same percentage of their
   own demand met**, regardless of size (1000 global demand, 900 global supply → everyone gets 90% of *their
   own* demand, whether that's one Fossil Fuel Plant or fifty). **Blockade effects layer on top of, and only
   ever push below, this baseline** — a blockaded faction can fall further below their fair share after
   sourcing/pathing is calculated, never above it. **Calculated once per Pulse, not every Tick** (confirmed).
   **Explicit clarification, resolved after a fresh-eyes review flagged the interaction as ambiguous — two
   genuinely separate effects, not one rule doing double duty:** the global percentage is **flat and
   universal**, applying even to a fully self-sufficient region with adequate local reserves — grounded in
   real-world precedent (Hormuz Strait/Ukraine-Russia energy disruptions raise prices and force rationing even
   in countries with domestically adequate supply, since energy is a fungible global market priced at the
   margin). **Self-sufficiency protects a region from the *blockade* layer specifically** (there's no import
   route to interdict), **never from the shared baseline itself** — a self-sufficient region sits exactly at
   the global percentage, no better and no worse, while an actively blockaded region (the Cuba case: a severe,
   *additional* penalty layered on top of the shared baseline, not just "somewhat below" it) can fall further.
   **Deliberately not modeled with more granularity or unevenness than this** — a fully realistic market would
   distribute scarcity less evenly, but Fusion tech is the actual long-term resolution to the whole Energy
   problem once researched, so further precision in the pre-Fusion economics isn't worth the added complexity
   right now (the same reasoning already applied to Population's flat 1% growth rate, §1.4 below).

**Stability** — floating point, 0.0–100.0, both extremes effectively unreachable in practice. Represents how
"well-behaved" the population is; higher benefits the controlling faction. Determines effective tax rate
(Money actually collected from GDP) and effective Research collection rate.

- **Drifts toward a computed anchor value, not manually set.** Anchor = mean of currently-active inputs:
  - **Popularity** — direct 1:1 conversion (a faction at 60% Popularity pulls the anchor toward 60).
  - **Per-capita GDP** (computed fresh as GDP ÷ Population, never stored) — linear interpolation:
    `10 + 80 × clamp((PerCapitaGDP − 1000) / 199000, 0, 1)`. At ≤$1,000/capita → 10 (widespread poverty); at
    ≥$200,000/capita → 90 (widespread affluence); exact midpoint (50) at **$100,500**, not $95,000 (checked
    and corrected from an initial estimate).
  - **Task Force presence** (deferred to the Task Force epoch, captured here for later): a TF with 10+ land
    units defaults to **passive policing** — pulls the anchor toward 60, but *only* if current Stability is
    already below 50; contributes nothing otherwise. Switched to **active suppression**, it always pulls
    toward 70 regardless of current Stability — meaning it can genuinely *lower* Stability if used in an
    already-stable region ("rolling in and cracking skulls" where it wasn't needed). Needs a player-facing
    warning when suppression is actively working against the player's own interest.
- **Drift mechanic (resolved, both worked examples verified):** once per Pulse, if current Stability differs
  from the anchor, move **10% of the delta**, with a **floor of 0.1** so a small delta still eventually
  closes rather than asymptotically stalling. *(60 actual, 50 anchor → moves to 59. 39 actual, 40 anchor →
  moves to 39.1, since 10% of 1.0 is 0.1, exactly at the floor.)*
- **Immigration (resolved):** a Stability delta between adjacent land regions drives net-zero population
  transfer from low- to high-Stability regions. **Nearest-neighbor-first**, expanding outward (including
  across maritime regions) only if fewer than 4 land neighbors have been checked *and* are producing
  immigration — specifically to prevent island regions from rarely or never experiencing immigration.
  Faction-specific population-growth perks (e.g. the Hive's) are separate from this mechanic, not folded into
  it.
- **Trend display (new, resolved):** the panel must show current Stability alongside where it's currently
  trending — the live-computed anchor — as an arrow notation, e.g. `50.0 → 63.5`. **Arrow color: green if the
  anchor is above current Stability (rising), red if below (declining).** This is a display requirement, not
  a new mechanic — the anchor was already being calculated every Pulse; this just surfaces it so the player
  knows whether a region needs intervention without checking back Pulse over Pulse.
- **Agent Stability-push missions (deferred to the Agent epoch, captured here):** a one-time push to *actual*
  Stability (not the anchor), scaling by 10-point band — strongest (±20) at the extreme being moved away from,
  weakest (±2) at the extreme being moved toward, symmetric between raise and lower missions. Critical success
  doubles the push.

**Weather** — NEW/expanded this session. Stateful, not a static baseline: an active/inactive toggle with a
per-tick activation chance (exact probability model, including region- and season-specific modulation —
e.g. Scandinavian winters firing more often than a US West Coast summer — explicitly deferred). Once active,
lasts roughly one day's worth of ticks. While active: degrades laser combat effectiveness (already in the
GDD) **and now also degrades Renewable-to-Production conversion efficiency** (new this session).

**Popularity** — RESOLVED, land-only, confirmed this session (does *not* apply to maritime regions at all).
Per-faction, per-region, 0–100%, displayed with one decimal (e.g. "49.3%"), non-summing across factions. The
region panel shows only the **active player faction's** Popularity by default; hovering it opens a tooltip
showing **every** faction's Popularity in that region, kept out of the main display to avoid clutter.
**Colored with simple three-band flat colors** — red below 25%, yellow across the 25–50% friction zone, green
above 50%, matching §6.4's existing bands directly (those bands are labels on one continuous underlying curve,
but the *display* deliberately uses flat colors rather than a gradient): the color's job is answering "should
I look closer at this region" at a glance while scanning the map, not conveying precision — the tooltip's
exact number already handles precision, and a continuous gradient would just reintroduce ambiguity ("is this
more yellow or green") that the discrete bands avoid entirely.
**Mechanical consequence of being land-only:** agent missions run in a maritime
region get **no popularity-based roll modifier at all** — not a reduced malus, a complete absence of one,
since there's no value to modify the roll with. **RBO** (§6.9) is not a separate stat — it's the US faction's
own display label for this same value, communicating their partial-income-without-Control perk. **Moved
primarily by:** the Agent Propaganda mission (localized, big boost, deferred to the Agent epoch) and spending
Legitimacy (global, small boost) — confirmed directly against §6.4's existing "two popularity levers" text.

**Legitimacy** — NOT a regional stat; a **global faction currency**, similar in kind to Money. **Collected
passively each Pulse**, computed as `Σ (Popularity_fraction × Population / 1,000,000)` summed across every
region the faction has any Popularity in (regardless of Control, matching §7.4's existing "earned via
popularity × population... regardless of control" framing). **Worked example confirmed:** Region 1 at 10%
Popularity / 10M Population, Region 2 at 50% / 20M → `0.1×10 + 0.5×20 = 11` Legitimacy that Pulse. Accumulates
and spends like Money. **Because Popularity is land-only, Legitimacy income is entirely a function of land
holdings** — maritime dominance alone contributes nothing to it. *(Assumed Pulse cadence, matching every other
Popularity-derived economic conversion specified so far — flag if this should instead run on Ticks.)*
Deferred: Events and Agent Missions that spend or grant Legitimacy directly (Agent epoch / Events epoch).

**Defensibility** — NEW, resolved this session; the first time this stat has gotten actual numbers rather
than just the natural+built structural description already in the GDD (§8.6.4). Additive:
- **10 baseline**, every region.
- **+10 per stackable terrain trait** (e.g. "Rugged," "Mountainous" — a region can carry more than one).
- **+5 per Fortification level**, built the same way as other buildings, same escalating-cost curve (§7.7).
- **Tentative cap: Fortification level 10** (+50 max from that source) — specifically to prevent a
  Hive-style indefinite-stacking strategy from making a region unconquerable by Fortifications alone; final
  cap value deferred to the buildings discussion, not locked yet.
- Higher Defensibility favors the defending Task Force; exact combat-modifier formula deferred to the Task
  Force epoch — the stat and its build-up mechanics are ready now, its combat application isn't yet.

### 1.5 Region Flags / Identity Fields — RESOLVED

- **Faction Control** (if any) — land-only, confirmed.
- **Country affiliation** — land-only, confirmed.
- **Popularity** (per-faction, per-region, non-summing, 0–100%) — **land-only, confirmed this session.**

**Open questions — all four from the previous session now resolved, one new one added this session:**
1. ~~Starting stat values for all 13 regions~~ — **Resolved, see §1.6 below.**
2. ~~Does Popularity apply to maritime regions?~~ — **Resolved: no.**
3. ~~Training Facility — confirm it's real?~~ — **Resolved: yes**, a formal military-training building (boot
   camps, flight school, academies). Not required to convert Population→Manpower, but significantly more
   efficient with it, throughput scaling with building level. Full specifics deferred to the buildings
   discussion.
4. ~~Population growth-rate formula~~ — **Resolved, deliberately simple:** flat 1% annual growth,
   `Population × 0.01 / 52` per Pulse, with faction-specific bonuses (e.g. the Hive's) and immigration effects
   (§1.4 above) applied on top. Explicitly *not* modeling real-world differential growth by development level
   — a deliberate scope decision to avoid unnecessary complexity right now, not an oversight. Invasion-vs-
   fire population-loss ratio remains genuinely deferred to whichever epoch needs it.
5. ~~Maritime regions had no Energy assigned~~ — **Resolved: SW Maritime gets 1,000 Energy**, see §1.6 below.

### 1.6 Region Starting Values — RESOLVED

**Default for every land region**, unless overridden below: Population 10M · Popularity 75% for all factions
· GDP $500B (per-capita $50K) · Stability 50.0 · Research 250 (per §1.4's formula: `GDP/1B × Stability/100` =
500 × 0.5) · Production 100(100) *(base-only; full value including buildings arrives with the buildings
discussion)* · Energy 100 · Defensibility 10.

**Maritime regions** carry no Population/GDP/Stability/Research/Production/Popularity/Control/Country (all
land-only, per §1.5) — Energy defaults to 0 for three of the four. **SW Maritime: Energy 1,000** — the one
maritime region carrying offshore Energy, resolved this session (previously an open gap — all four defaulted
to zero). Adjacent to NW Maritime, SE Maritime, SW Land, W Land, S Land — notably adjacent to SW Land, whose
Faction Control (Mankind United) gives that faction a convenient, geographically-adjacent path to this
reserve once sourcing logic is live, an interesting strategic wrinkle for testing rather than something
deliberately engineered. NW Maritime, NE Maritime, SE Maritime remain at 0.

| Region | Deviations from default | Purpose |
|---|---|---|
| **NW Land** | Country: **United States**, Faction: **United States** | — |
| **N Land** | Country: **United States**, Faction: **United States**; traits **Rugged + Mountainous** (Defensibility 10+10+10 = **30** pre-Fortification); Energy **1,500** | Amphibious-pincer defense test (double maritime access, §1.1); future Energy-surplus source for shortage-sharing test |
| **NE Land** | Country: **France**, Faction: **Unaffiliated** | Independent-region autopilot test (§6.6) |
| **W Land** | Country: **United States**, Faction: **United States**; Gamer Popularity **40.0%** (all other factions default 75%) | Agent-mission testing |
| **C Land** | Country: **Taiwan**, Faction: **The Hive**; traits **Rugged + Mountainous** (Defensibility **30** pre-Fortification); Energy **10** | Land-blockade test — landlocked (§1.1), so any blockade here is necessarily land-based, not naval, despite the "Taiwan" name |
| **E Land** | Country: **China**, Faction: **China**; Gamer Popularity **5.0%** (all other factions default 75%) | Agent-mission testing |
| **SW Land** | Country: **Mexico**, Faction: **Mankind United**; Population **100M**, GDP **$100B** (per-capita **$1,000**, exactly the anchor formula's floor), Stability **25.0**; **every faction's Popularity individually authored**: MU 75, Red Queen 0, LaserWard 10, China 20, Hive 30, Widows 40, US/RBO 50, Gamer 60 | Immigration test (low per-capita GDP) + full diverse-Popularity display test. *(Note: starting anchor = mean(Popularity, GDP-input) = mean(75, 10) = 42.5 — Stability will drift upward from 25 toward 42.5, not stay depressed; the initial 65-point gap versus SE Land narrows toward a 40-point equilibrium gap over time, not a bug.)* |
| **S Land** | Country: **China**, Faction: **China** | — |
| **SE Land** | Country: **China**, Faction: **China**; GDP **$2T** (per-capita **$200,000**, exactly the anchor formula's ceiling), Stability **90.0** | Immigration test (high per-capita GDP) — same drift caveat as SW Land applies: anchor = mean(75, 90) = 82.5 |

---

## 2. Component: UI & Interaction Model

*NEW component this session — genuinely cross-cutting, not specific to Regions even though Regions are the
only entity type that exists to populate it yet.*

### 2.1 Map — RESOLVED
Occupies the center/majority of the screen. Scrollable via WASD, zoomable via mouse wheel or +/−. Global
stats and time controls displayed top-right.

### 2.2 Generic Hover/Pin Panel System — RESOLVED, this is the core UI architecture for the whole game, not just Epoch 1
**Hovering any entity** (Region now; Task Force and Agent in later epochs) opens its associated display.
**Left-clicking pins it** — the display persists and becomes independent of further hovering, so a player can
hover through several regions to preview them, then click the one they want to keep open. A pinned display
stays open even if the player scrolls the map away from that entity.

**Built generically from the start, deliberately** — this interaction model needs to work identically for
Regions, Task Forces, and Agents, none of which should require their own bespoke panel implementation later.
Same "general system, small seed data" principle as the region/adjacency model, applied to UI instead of game
state.

**Nested tooltip pinning (resolved):** within an open entity panel, hovering any individual stat shows a
tooltip explaining what it means and how it's used/calculated. **Left-click pins that tooltip as its own
independent floating window**, closeable only manually (an explicit "×"/close control — it does *not*
auto-close when the parent panel changes or closes). Multiple pinned tooltip windows can coexist. **New
windows attempt to find open screen space first**; once space runs out, new windows are allowed to overlap
older ones — the player retains full manual control over what stays open and what gets closed, no automatic
eviction.

### 2.3 Region Panel — RESOLVED
Triggered by hover (preview) or click (pin) on a Region.

- **Background image**: the region's dominant terrain type, shown as a full-panel background image with
  stats/info overlaid on top. For the dummy map specifically: a generic ocean image for Maritime regions, a
  mixed forest/plains image for Land regions. **`RegionType` is never separately displayed as text** — it's
  already obvious from both the map's color-coding and the panel's background image.
- **Top section — control/identity/domain info, always from the *active (player) faction's* perspective:**
  Faction Control (or "Unaffiliated"), Country Identity *(land-only, per §1.5)*, any active tags (Weather,
  terrain tags, faction-specific modifiers like an Arcology), then **Air Superiority** and **Sea Superiority**
  (where applicable) — for Epoch 1, both **default to 100%**, since real domain-control computation doesn't
  exist until the Task Force epoch, but both are **dev-editable** here specifically to let blockade behavior
  be simulated early.
- **Stats section below**: the full stat block from §1.4 above, each with its own hover tooltip (pinnable per
  §2.2). **Stability specifically displays as a trend arrow** (`50.0 → 63.5`, green if rising, red if
  declining, per §1.4). **Popularity specifically displays with three-band flat coloring** (red/yellow/green
  matching the §6.4 thresholds, per §1.4) — own-faction value shown by default, all factions' values on hover.

**Open questions to resolve together:**
1. None outstanding for the panel architecture itself — this section reads as fully resolved. Remaining work
   is purely visual/asset (the actual terrain images) and implementation detail, not open design questions.

### 2.4 Application Entry Flow & Visual Design Motif — NEW, resolved this session

**Visual design principle, governing all UI, not just this flow:** a dark-web aesthetic fitting an indie
cyberthriller genre. Sound/music explicitly deferred, but the visual direction is deliberate starting now.
**This directly informs, without fully resolving, the Global Tension visualization left open in §3** — the
reactor-core and relationship-graph concepts discussed there both fit this aesthetic more naturally than a
brighter, more cartoonish treatment would; still an open art-direction choice, just a narrower one now.

**Title screen, the application's actual entry point:** modest — just the title **"Ragnorosis"** and three
buttons beneath it: **New Game** (inactive), **Load Game** (inactive), **Sandbox** (active — the only
functional path this epoch). **Load Game is deliberately meant to be format-agnostic in the future** — able
to load either a saved Sandbox session or a full game save — a forward-looking architecture note for whenever
save/load actually gets built, not something to implement now.

**Clicking Sandbox replaces the three buttons with "Choose Your Faction"** — one button per playable faction,
**seven total, explicitly excluding Red Queen** (Mankind United, China, United States, The Widows, LaserWard,
The Hive, The Gamer).

**Faction selection sets the active player perspective — a genuine architectural generalization, not just a
title-screen detail.** This takes something already established narrowly (the Region Panel's Air/Sea
Superiority explicitly shown "from the active player faction's perspective," §2.3) and extends it to
everything faction-scoped: the entire top-of-screen currency/stats display (Money, Legitimacy, Production,
§4.1/§4.3) is perspective-bound to whichever faction is currently active, never a universal or omniscient
view by default.

**Devtools additions (new items for §5.1):** the dev can change the active faction perspective at any time —
**including switching to Red Queen's perspective specifically**, even though she isn't one of the seven
selectable starting options. More useful for later epochs' testing than this one, but the underlying
capability should exist now rather than being bolted on later.

**Confirmed, no new mechanic needed: factions starting with zero region Control (the Gamer and Widows, by
default on the dummy map) naturally generate only Legitimacy income under systems already built** — Legitimacy
generates from Popularity × Population regardless of Control (§1.4), while Money, Research, Production,
Equipment, and Manpower all require actual regional Control to collect. This is intentional, already falls
out correctly from what's already specified, and is exactly the constrained-starting-position behavior
wanted for playtesting — a dev can freely reassign region Control via devtools to change it.

---

## 3. Component: Pulse/Tick Time System

*SOURCE: GDD §2.1*

- [x] **Tick = 1 hour exactly, Pulse = 1 week exactly** — resolved this session, no longer approximate.
  **168 ticks per Pulse** (7 × 24).
- [x] **Speed, resolved with exact numbers this session:** 1× = 3 ticks/second, 2× = 6 ticks/second,
  5× = 15 ticks/second. Real-world time to complete one full Pulse at each speed: 1× ≈ 56 seconds, 2× ≈ 28
  seconds, 5× ≈ 11.2 seconds (matches Eric's own target feel — "about 11 seconds" at 5×).
- [x] **Calendar display, resolved:** real calendar date format (e.g. "Jan 10, Year 1", "Mar 17, Year 2"),
  year deliberately obfuscated — the actual in-fiction year was left open in the novels. **Implementation
  approach: anchor the underlying date computation to any real non-leap year** (2025, 2026, 2027 all work) and
  only ever display "Year N" — this avoids needing any custom Feb-29-skipping logic entirely, since a
  non-leap year never generates one in the first place. Simpler than it first sounds.
- [x] **Pause/Run control, resolved this session:** a single large toggle button (pause icon / play icon).
  **Hitting "run" advances to the *next Pulse boundary only*, then auto-pauses** — unless interrupted earlier
  by a pop-up or the player manually pausing. This is *not* an indefinite continuous-run mode; every run
  action is bounded to one Pulse by default. In-fiction reasoning: this is the moment Agent Missions get
  assigned (deferred — Epoch 1 has no Agents yet, so the pause is "artificial" this epoch, but the underlying
  behavior needs to exist now for later epochs to build on). **1×/2×/5× speed selector displayed to the right
  of the pause/run button, smaller font.** Other actions (Task Force movement in later epochs, adjusting
  Production focus, constructing buildings) are allowed at any time regardless of pause state.
- [x] **Global Tension: tracked number, display-only, starting value 0** — dev-adjustable, drives nothing
  behaviorally yet (§9.2's behavioral layer is Epoch 5, per §12.5). **Visual representation: genuinely open,
  not yet decided** — candidate concepts discussed (a circuit-board motif with increasing sparks/arcing; a
  reactor/containment-core visual shifting cool-to-hot with visible stress cracks, tying directly to the
  game's actual nuclear endgame; a faction relationship-graph whose connections destabilize as GT rises,
  tying directly to GT's actual mechanical meaning rather than a generic danger signal) — deliberately left as
  an open art-direction question rather than settled now, since GT has no behavioral weight until Epoch 5
  anyway.

**Open questions — all resolved this session, none remaining:**
1. ~~Does speed change the actual Tick rate, or just render speed?~~ — **Resolved: render speed only**, and
   generalized into a universal rule, not just a combat-specific carve-out. Speed never changes what gets
   calculated — only how fast the player watches the same, always-native-granularity tick sequence advance.
   The underlying reason: any process where a later step depends on an earlier step's outcome within the same
   window (attrition-based combat being the sharpest example, but not the only one — submarine detection's
   fresh-roll-every-tick is the same shape) can produce genuinely different results if "5× speed" means "run
   one big scaled step" instead of "run five separate normal-sized steps in sequence." Always simulating at
   native Tick granularity and only varying how fast that sequence is *shown* avoids this entirely.
2. ~~Is "Run Pulse to Pulse" its own distinct control, separate from continuous play?~~ — **Resolved: yes**,
   and it's the *only* mode — there is no indefinite continuous-run option at all, every run action is bounded
   to the next Pulse boundary by design.

---

## 4. Component: Basic Economy & Buildings

*SOURCE: GDD §7 (all), §7.7 (escalating cost curve), §7.8 (Energy), §8.7 (equipment/manpower pools, resolved
this session to confirm what already exists) — fully resolved this session*

### 4.1 The Four Currencies — RESOLVED

Money, Research, Legitimacy are faction-level pools (not region-level), fed by region output, matching §7.
**Production is different in kind** — not spent at discrete decision points, but a continuous per-Pulse flow
allocated across categories (§4.3 below). **Money and Legitimacy are displayed in a separate top-of-screen
area, aggregated across all controlled regions** — not inside any individual Region panel (§2.3) — resolved
this session, a genuine UI-architecture decision distinct from how individual region stats display.

### 4.2 Epoch 1 Building Roster — RESOLVED

Five buildings, confirmed final list for this epoch (Molecular Production Facility explicitly deferred to
the Tech epoch, since it requires Molecular Machinery):

| Building | Base cost (Production) | Function |
|---|---|---|
| **Fossil Fuel Plant** | 5,000 | Energy → Production, see §4.4 |
| **Renewable Plant** | 8,500 | Energy → Production, see §4.4 |
| **Production Facility** | 7,000 | Equipment/construction efficiency, see §4.5 |
| **Training Facility** | 5,000 | Manpower efficiency, see §4.5 |
| **Fortification** | 10,000 | +5 Defensibility per level (§1.4), tentative level-10 cap |

**Escalating stack cost** (§7.7) applies per building type within a region, using the existing multiplier
schedule (1×, 1.05×, 1.1025×, 1.157625×...) against the base costs above — this is the first time an actual
base number has existed to apply that schedule to; previously only the multiplier existed, no starting value.

**The level-10 cap is Fortification-specific, confirmed this session** — no other building in this epoch's
roster has a level cap; the escalating cost curve is already each other building's natural soft-limit (the
same mechanism that makes indefinite Fusion-stacking uneconomical for everyone except the Hive).

### 4.2.1 Dummy Map Starting Building Placement — RESOLVED

**Corrected this session: Fossil Fuel Plant and Renewable Plant are each a single leveled building per
region, matching Fortification's existing precedent — not multiple separate level-1 instances.** Original
framing ("4 Fossil Fuel Plants in a region") was imprecise language for what's actually meant: a single
Level 4 Fossil Fuel Plant. **The totals below are unchanged** — flat linear per-level scaling (§4.4) means a
Level 4 plant produces the identical 400 Production / demands the identical 400 Energy that four separate
Level 1 plants would have — only the labeling needed fixing, not the numbers.

**Fossil Fuel Plants: total demand 3,100 Energy against the map's 3,210 total supply** (110 headroom —
tipping the map into shortage requires spawning 2 additional plant-levels via devtools, not 1, given the
exact numbers). Level 3 baseline in every land region, Level 4 in four specific regions:

| Region | Fossil Fuel (level) | Renewable (level) | Production Facility | Training Facility | Fortification |
|---|---|---|---|---|---|
| NW Land | 4 | 1 | 2 | 2 | — |
| N Land | 4 | 1 | 5 | — | 5 |
| NE Land | 3 | 1 | — | — | — |
| W Land | 3 | 1 | — | — | — |
| C Land | 4 | 5 | 10 | — | 10 (cap) |
| E Land | 3 | 1 | — | — | — |
| S Land | 3 | 0 | — | — | — |
| SW Land | 3 | 0 | — | 5 | — |
| SE Land | 4 | 0 | — | 3 | — |

**Renewable Plants: Level 1 in every region except the south row (SW/S/SE Land, unbuilt) and C Land
(Level 5, an outlier deliberately paired with C Land's overall build-density).**

**Emergent per-country Energy self-sufficiency, worth having on record since it wasn't explicitly engineered
country-by-country but falls out cleanly from the placement above:**

| Country | Local Energy supply | Local Fossil demand | Net |
|---|---|---|---|
| United States (NW/N/W Land) | 1,700 | 1,100 | **+600 surplus** |
| China (E/S/SE Land) | 300 | 1,000 | **−700 deficit** |
| Taiwan (C Land only) | 10 | 400 | **−390 deficit, no same-country fallback at all** |
| Mexico (SW Land only) | 100 | 300 | **−200 deficit** |
| France (NE Land only) | 100 | 300 | **−200 deficit** |

The US is comfortably self-sufficient purely because N Land's 1,500 local Energy covers its neighbors. China
needs substantial imports even at peace. **Taiwan/C Land is the sharpest case** — being the only region in its
country, it has no same-country region to source from at all, so the planned land-blockade test (§1.6) should
bite immediately and severely once all four neighbors are cut off, not need extra tuning to matter.

**C Land's resulting total Defensibility: 80** (30 from base+Rugged+Mountainous, +50 from 10 maxed
Fortification levels) — the single most fortified region on the map, fitting given C Land is Hive-controlled
and the Hive's broader faction identity is built around exactly this kind of tall, turtled defense.

### 4.3 Production Allocation — RESOLVED, the core new mechanic this session

**Aggregate Production (summed across all controlled regions) displays as a faction-level number, top-of-
screen alongside Money/Legitimacy** — not spent like a currency, but continuously allocated. Next to the
number: the faction's current **societal focus** — Equipment, Manpower, Construction, or Balanced — changeable
by clicking, no limit on how often, but **no category can ever reach 100%.**

- **Balanced:** 33% / 33% / 33% (approximately even) across Equipment / Manpower / Construction.
- **Any chosen focus:** 50% to the focused category, 25% each to the other two.
- **Calculated once per Pulse** (matching Energy's cadence, not Tick) — a mid-pulse focus change takes effect
  starting the *next* pulse, not retroactively.

**Overflow rules (symmetric, self-correcting — the design's actual point):**
- If a category hits its cap (Manpower's population cap, or — future epoch — Equipment's stockpile cap),
  its allocated share reroutes to the other two.
- If Construction has nothing queued, its share reroutes to Manpower/Equipment.
- **Overflow redistributes proportionally to the receiving categories' current relative shares**, not evenly
  — preserves the *meaning* of the player's chosen focus even during overflow (resolved this session,
  previously flagged as ambiguous).
- **If two categories are simultaneously capped/empty, 100% of Production flows to the one remaining
  category** (resolved — the natural degenerate case of the proportional-redistribution rule above, no new
  mechanic needed). **For Epoch 1 specifically, the only way to actually trigger this is Manpower capped and
  Construction simultaneously empty** — Equipment has no cap yet this epoch, so a true three-way deadlock
  isn't reachable until the Task Force epoch gives Equipment its own stockpile cap; the rule as stated already
  covers that future case without needing revisiting.
- **If all valid destinations are simultaneously capped/empty**, the player gets a warning recommending (not
  requiring) they build something — this can only actually fire if Construction has nothing queued *and*
  Manpower/Equipment are both capped at the same time.

**Rounding/remainder handling, resolved — two genuinely different rules for two genuinely different kinds of
calculation, deliberately not unified, since they solve different problems:**
- **Focus allocation itself (the 50/25/25 or 33/33/33 split): floor and discard, no carry-forward.** Whatever
  falls below a whole Production point in a given category's share is simply lost that Pulse — no rounding to
  nearest, just truncate to integers. This is safe here specifically because nothing at this step is
  accumulating toward a fixed target; it's a continuous flow being re-sliced fresh every Pulse, so there's
  nothing a discarded fraction could ever have been blocking. *(In-fiction justification, optional but
  consistent with how the rest of this design ties mechanical simplifications to flavor: frictional loss —
  contract overhead, minor inefficiency and corruption in converting raw output into allocated effort.)*
- **Equipment, Manpower, and Construction conversion (Production points → actual units/Manpower/build
  progress): floor, but bank the remainder and carry it forward to next Pulse's calculation for that same
  target.** This is *not* the same rule as the allocation step above, and the difference matters: these three
  conversions accumulate *toward a discrete threshold* (a whole unit, a whole Manpower, a building's total
  cost), and anything expensive enough to span multiple Pulses — an aircraft carrier, a high-cost building —
  would otherwise never be completable at all if its fractional progress reset to zero every single Pulse
  instead of compounding. Applied uniformly across all three (Manpower's practical impact is negligible at
  million-scale Population, but using the same rule everywhere reads as one deliberate, consistent mechanic
  rather than three special cases an implementer has to remember individually) — **Fable doesn't need to be
  told exactly how to implement this, but a single shared function backing all three will naturally produce
  that consistency.**

**Construction-completion interrupt (resolved this session, a deliberate partial exception to "everything
just flows per-pulse"):** when a building completes **mid-pulse**, the game **auto-pauses**, notifies the
player, and lets them queue a new project (or add a new building/level) before resuming — the *same*
pulse-start flow-rate continues afterward, now directed at whatever's newly queued. **This is a UI-level
interrupt, not a recalculation** — it doesn't touch Production's actual per-pulse allocation math, so it
doesn't reopen the "speed should never change what gets calculated" principle from §3. **Deliberately not
applied to Manpower or Equipment hitting their caps** — those have no real decision attached (the overflow
logic already knows where the excess goes), so an interrupt there would just be noise, especially disruptive
mid-combat when a player is already managing real decisions.

**Up to 4 concurrent building projects** (new build or level-upgrade, interchangeable against the same slot
count, confirmed this session) — Construction's allocated share splits evenly across all active projects. A
real speed-vs-breadth tradeoff: one project finishes fastest, four projects make broad simultaneous progress.

### 4.4 Fossil Fuel & Renewable Plants — RESOLVED

Both output **100 Production/Pulse per level, nominally** — matching Fortification's existing flat-additive
per-level shape (+5 Defensibility/level), *not* Production/Training Facility's multiplicative +20%/level
shape. **Confirmed this session: a Level N plant is a single building instance, not N separate plants** —
`output = N × 100` Production, `demand = N × 100` Energy for Fossil Fuel specifically. A Level 4 Fossil Fuel
Plant produces exactly what four independent Level 1 plants would have; only the earlier "N separate
buildings" framing was imprecise, not the underlying numbers.
- **Fossil Fuel Plant** consumes `N × 100` Energy/Pulse at level N; output is **curtailed 1:1** with any
  Energy shortfall — if the fair-share/sourcing system (§1.4) only delivers 90% of demand, output drops to
  90% of the level's full `N × 100`. No new mechanic needed; this plugs directly into the existing Energy
  scarcity system regardless of level.
- **Renewable Plant** outputs `N × 50` Production/Pulse at level N **while Weather is active** in its region
  (a flat halving of the level's full output, not curtailed proportionally like Fossil Fuel) — **Weather's
  effect is evaluated as a single Pulse-start snapshot** (matching Energy's own cadence): whatever Weather's
  state is at the moment the pulse-level calculation runs, that's the value used for the whole pulse, even
  though Weather itself is a sub-pulse (roughly one day's worth of ticks) phenomenon. Deliberate: keeps this
  consistent with Energy's existing Pulse-cadence rather than adding Tick-level precision for a benefit that
  doesn't seem worth the added complexity. Creates genuine unpredictable variance, which is intentional — a
  real incentive toward Fusion beyond its raw value proposition.

### 4.5 Production Facility & Training Facility — RESOLVED

**Base conversion rates**, before any building bonus:
- **Manpower:** 1 Production point → 1 Population converted to available Manpower. **Capped this epoch at 2%
  of Population** (§1.4's growth work already established this cap; further refinement — raising the cap via
  mobilization/conscription events, tentatively 2%→5%+ — deferred to the Task Force epoch).
- **Equipment:** 1 Production point → 1 unit of **Small Arms**, the only Equipment type this epoch.
  **Uncapped** — the real stockpile-vs-Task-Force-demand system is deferred to the Task Force epoch; for now,
  demand is simply unlimited.

**Building bonus, both facilities, same formula:** `output_per_point = base × (1 + 0.20 × level)` — **linear**
in level, not compounding. Worked and verified: a level 5 Training Facility converts 1 Production point into
2 Population-to-Manpower (1 × (1 + 0.20×5) = 2.0); a level 1 Production Facility converts 1 Production point
into 1.2 Small Arms, rounded to the nearest integer this epoch (1 × (1 + 0.20×1) = 1.2).

### 4.6 Military Panel — NEW UI element, resolved this session

A persistent **right-side button**, distinct from the map-entity hover/pin system (§2.2) and closer in kind
to the top-of-screen global stats display (§4.1) — opens a dedicated interface. **Partially built this epoch:**
displays current Equipment (Small Arms count) and Manpower pool values only. **Future expansion** (not this
epoch): the Unit Editor and Task Force Editor will also be reachable from here.

### 4.7 Building Grid UI — RESOLVED, new detail this session

Extends §2.3's Region Panel. Each grid square shows a building icon and level number. **Fill order: top-left
first, then left-to-right across the row, then down to the next row** — only the next available empty square
is ever buildable, specifically to prevent a scattered, gap-filled grid. **Hover behavior:** a translucent "+"
appears over any square, with a tooltip reading **"New Building"** (empty square) or **"Upgrade Building"**
(occupied square) — consistent with the generic tooltip-on-hover, pin-on-click pattern already established
in §2.2.

**Construction queue mechanic, resolved this session — closes what a fresh-eyes review correctly flagged as
an undocumented ambiguity, though the underlying design turns out to need no new mechanic once made
explicit:**

- **For a building slot, although subsequent construction can be queued, only one level of construction can
  be actively receiving progress from Production points at any time.** A slot is always either building "the
  next level" of whatever already occupies it, or a brand-new Level 1 on an empty square — there is no
  possible state where two different levels of the same building are simultaneously receiving Production in
  the same region. This is what makes §4.2.1's escalating-cost multiplier unambiguous: "next level" always
  means exactly one specific, well-defined thing.
- **A second level can be queued ahead while the first is still building**, but the queued level's progress
  doesn't begin accumulating until the current one completes — and **its cost is whatever "next level" costs
  at that future moment**, not locked in at the time it was queued. Queuing Level 3 while Level 2 is still
  under construction means paying the Level 3 price once Level 2 actually finishes, not the price that was
  current when the Level 3 order was placed.
- **A queued future level still only counts as one of the four concurrent-project slots** (§4.3) — however
  many levels are queued ahead on a single grid square, that square occupies exactly one project slot, not
  one slot per queued level.
- **Clicking an empty square opens a building-type selector**, filtered to only the types this faction is
  currently allowed to build **that aren't already present elsewhere on this region's grid** — since every
  building type occupies exactly one grid square for its whole leveled lifetime (§4.2.1's Fossil Fuel/
  Renewable correction makes this the universal rule across all five building types, not an exception for
  some of them).

---

## 5. Component: Devtools Panel

*SOURCE: GDD §12.10 ("World" group specifically) — fully classified this session against every stat/value
introduced across §1 and §4, replacing the earlier blanket "directly edit any region stat" line with an
explicit stored-vs-computed breakdown.*

### 5.1 Directly editable — stored values only

**Per region:** Population, GDP, current Stability *value* (not its anchor — see §5.2), Weather's
active/inactive toggle, Popularity (per faction), Faction Control *(land-only, §1.5)*, Country affiliation
*(land-only)*, raw Energy reserve size, terrain traits (add/remove Rugged, Mountainous, etc.), every
building's level/count (spawn directly, bypassing cost, or build the normal way spending Production).

**Per faction:** Money (accumulated pool), Legitimacy (accumulated pool — the stockpile only, its per-Pulse
income rate is computed, §5.2), Equipment pool, Manpower pool, current societal Production focus (§4.3).

**Global:** Global Tension, active faction perspective (§2.4 — new this session; switchable to any of the
seven playable factions or **Red Queen specifically**, even though she isn't a selectable starting option at
the title screen's faction-select prompt).

**Air/Sea Superiority — editable now, but only as a temporary placeholder.** Resolved this session: this is
dev-editable *specifically because* Epoch 1 has no real domain-control computation yet, needed to simulate
blockade behavior ahead of when that system actually exists. **It will move to §5.2 (computed) once a later
epoch builds real domain control** — flagged explicitly now so that transition isn't a surprise when it
happens.

### 5.2 Never directly editable — computed/derived, only their inputs are exposed

- **Per-capita GDP** — always `GDP ÷ Population`, recomputed fresh.
- **Production** (region total) — computed from power-plant count + population + building bonuses.
  **Resolved this session: no direct-override devtool**, despite the testing-convenience tradeoff raised —
  edit the underlying power-plant count, population, or building levels instead.
- **Supply** — already derived from Production, never independently stored.
- **Research** (per-Tick income) — computed from GDP × Stability × modifiers. **Resolved this session: no
  direct-override devtool**, same reasoning as Production.
- **Defensibility** — computed from base + terrain traits + Fortification level.
- **Stability's anchor** — computed from Popularity + per-capita-GDP-input + TF presence. Distinct from
  current Stability itself, which *is* stored and editable (§5.1).
- **Energy actually delivered** to a specific plant this Pulse — an outcome of the whole-map fair-share/
  pathing calculation, distinct from the raw reserve size (which is stored, §5.1).
- **Legitimacy's per-Pulse income rate** — computed from Popularity×Population summed across regions; the
  stockpile is stored (§5.1), the rate that feeds it isn't independently settable.
- **Money's per-Pulse income rate** — same shape as Legitimacy: the pool is stored, the rate isn't.

### 5.3 Explicitly resolved as out of scope this session

- **RegionType (Land/Maritime) is never runtime-editable** — fixed at map-authoring time only, no devtools
  support for changing it live.
- **No devtools support for jumping directly to a specific Pulse/Tick/date** — time only advances via the
  normal run/pause mechanism (§3).

- [ ] *(Open: does the devtools panel need its own access-control thinking yet, or is that still fully
  deferred to whenever the dev-vs-player-facing question, §12.10, gets resolved? My instinct is Epoch 1 can
  stay dev-only with no UI polish at all.)*

---

## Provides / Expects Contract

**This epoch provides, for Epoch 2 to build on:**
- A region data model with the full stat block, adjacency graph, and per-faction Popularity/Control tracking
  — Epoch 2 can assume regions exist and are queryable, but should *not* assume anything about combat-
  relevant fields (real domain control, Organization, etc.) since those don't exist yet — Air/Sea Superiority
  exist as dev-editable flat values only.
- A working Pulse/Tick clock that other systems can hook into, with an established per-stat pattern for
  deciding Tick vs. Pulse cadence rather than one blanket rule.
- A generic hover/pin panel system that Task Force and Agent entities can plug into directly in later epochs,
  without needing their own bespoke UI built from scratch.
- A fully specified building system — five building types with real costs and formulas, the escalating-cost
  curve applied to real numbers for the first time, and a general Production-allocation mechanic (societal
  focus, proportional overflow) that later epochs can extend rather than rebuild.
- **A global Equipment pool (Small Arms only, uncapped) and Manpower pool (capped at 2% of Population)** —
  Epoch 2 can assume these exist and accumulate correctly, but should *not* assume the real stockpile-vs-
  demand Equipment cap or the mobilization-based Manpower cap progression exist yet; both are explicitly
  deferred, Epoch 1 only provides the simplified uncapped/flat-2%-capped versions.
- A Military panel UI element, partially built (pool display only) — ready for the Unit Editor and Task Force
  Editor to attach to it directly in later epochs rather than needing new top-level UI built from scratch.
- **An application entry flow (title screen → Sandbox → faction select) and an active-faction-perspective
  system** that every faction-scoped display already respects — Epoch 2 can assume Task Force displays
  inherit this same perspective-binding rather than needing their own. New Game and Load Game exist as
  disabled UI, not functional yet. Visual design motif (dark-web/cyberthriller) established as a governing
  principle later epochs' UI should continue to follow, not just this epoch's.

**This epoch expects nothing from anything prior** — it's the foundation epoch.

**This epoch does *not* provide:** anything Task-Force or combat-related (Epoch 2), anything agent or
mission-related (Epoch 3), any tech content beyond the region/building system's own data structures (Epoch 4).

---

## Status: SUBSTANTIALLY COMPLETE

**All five components are now resolved.** Region Data Model & Map (§1) — every stat, flag, formula, a full
starting-value table for all 13 regions, and a complete building-placement pass with real emergent
per-country Energy dynamics. UI/Panel architecture (§2) — the generic hover/pin system, trend arrows,
three-band coloring, and the building-grid fill/hover behavior. Pulse/Tick Time System (§3) — exact numbers
throughout: 168 ticks/Pulse, precise speed rates, the calendar approach, run-to-next-Pulse-boundary as the
only run mode. Basic Economy & Buildings (§4) — the full five-building roster with real costs and starting
placement, the Production-allocation mechanic, both efficiency formulas verified, the Military panel.
**Devtools (§5)** — every stat and value in the document now explicitly classified stored-vs-computed, three
borderline questions adjudicated (no override for Production/Research, no RegionType editing, no time-jump
support), and the Air/Sea Superiority placeholder-vs-future-computed distinction flagged clearly for when
that transition happens later.

**One real open item remains, deliberately left for later:** whether the devtools panel needs its own
access-control thinking now, or stays fully deferred to the broader dev-vs-player-facing question (§12.10).
Otherwise, this document is ready to serve as an actual implementation spec.
