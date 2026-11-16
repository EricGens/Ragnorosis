# Ragnorosis — Art Direction (v0.2)

Status: draft, revised after Eric's review, 2026-11-15. These are working intentions, not hard rules; we
expect to adjust them as we try things. Written from Eric's notes on eight reference screenshots
(Terra Invicta ×4, HOI4 ×2, Victoria 3 ×2), which are kept locally in `docs/art-reference/` and are **not**
committed (other studios' copyrighted images). This doc records *intent*; individual features still get their own
slices and PRs.

## 1. Decisions already made

- **Flat map, not a globe** (Eric, 2026-11-15). Terra Invicta's globe serves its space theme; ours doesn't need it.
  The map renderer is a flat 2D canvas/WebGL surface. Region picking, arrows and zoom stay simple.
- **Style target: Terra Invicta** — dark, minimalist, techno-thriller. HOI4 and Victoria 3 are borrowed from for
  *specific mechanics of presentation* (below), **not** for their look. We're not aiming to imitate Victoria 3's
  painterly 3D terrain.
- **Information first.** Visual devices should carry game information where they can. Decoration comes second and
  should be optional (toggleable, or fading with zoom).

## 2. Principles

1. **Aim for a map that reads at a glance.** Who controls what, where forces are, where fighting is, and who is
   winning should be clear, as far as possible, without opening a panel.
2. **Aim for one visual language per concept.** A fill means control, a hatch means occupation, a glow means border,
   a bar means a depletable resource. Avoid reusing a device for a second meaning.
3. **Detail follows zoom, in both directions.** The further out the player is, the less the map conveys, but we
   try to keep as much *actionable* information as we can. The floor at maximum zoom-out is the minimum needed to
   take game actions: **region ownership by color, and Task Force and Agent locations**. As the player zooms in,
   more is added: borders and glow, unit frames and bars, battle indicators, facility badges, then structures.
   At maximum zoom-in the map gets the cosmetic layer: region structures, battle eye candy, and so on. The exact
   zoom thresholds, and what appears at each, are to be tuned by feel.
4. **The map shows the state of the world.** Regions look busier as they develop; fronts look hot when they're hot.
5. **Cheap first.** Prefer vector, procedural and data-driven art we can generate and revise in code. Painted
   assets are used only where vector can't carry the feeling (portraits, hero art).

## 3. Color

Existing tokens in `src/index.css` stay the base (a cool blue-black ink ramp with a green "signal" accent):

| Role | Token / value |
|---|---|
| Background / deepest | `ink-950 #06080b`, `ink-900 #0b0f14` |
| Panels | `ink-800 #121821`, `ink-700 #1b2430` (use ~85–92% opacity over the map) |
| Borders / dividers | `ink-600 #2a3644` |
| Muted text | `ink-400 #5b6b7d`, `ink-200 #aebbc9` |
| Primary text | `ink-100 #e6edf3` |
| Accent / positive / selected | `signal #35f0a8` (dim `#1f9c6f`) |
| Warning | `warn #f5c542` |
| Danger / loss | `alert #ff4d5e` |

**Faction colors** (`factionColors.ts`, unchanged for now): Mankind United `#f28c28`, China `#ff3b3b`,
United States `#3b82f6`, Widows `#a855f7`, Laserward `#22d3ee`, Hive `#eab308`, Gamer `#4ade80`,
Red Queen `#ff2d95`.

Known collisions to resolve when we skin the map:
- China `#ff3b3b` is nearly the UI "danger" red `#ff4d5e`, so a Chinese border can read as an alert. Options: shift
  the UI danger color toward a deeper crimson or add an icon to every alert. **Proposed:** keep faction colors
  saturated and move UI alerts to icon + shape + pulse rather than color alone.
- Hive yellow vs the warning yellow, and Gamer green vs `signal` green, collide the same way. Same fix.
- Where practical, don't rely on color alone (accessibility): pair it with a pattern, icon or shape.

**Map surface:** terrain stays dark and desaturated so faction colors pop (as in Terra Invicta); land is a muted
texture, sea is near-black blue. Faction fill is a translucent tint over terrain, not an opaque flat color.

## 4. Typography

- **Data and numbers:** keep JetBrains Mono (already in use): tables, resource counters, stats.
- **Headings and labels:** **Rajdhani** (Eric's pick; OFL-licensed). We'll try it on real panels and can revisit
  if it doesn't hold up at small sizes.
- **Map labels:** the map is **label-light, like Terra Invicta** (Eric's decision). Region names are small,
  uppercase, letter-spaced, light on dark, and appear only as needed (on hover/selection or at closer zoom). No
  giant HOI4-style country names.
- Fonts are self-hosted, not loaded from a CDN, so the game works offline.

## 5. Panels and chrome

- Semi-transparent dark panels with a 1px border in `ink-600` and a faint inner glow; square or lightly chamfered
  corners (no ornate frames; that's Victoria 3's idiom, not ours).
- **Layout (from Terra Invicta):** resources and clock across the top; a context panel on the left that shows
  whatever was just selected; a list/roster panel on the right; a portrait/detail card bottom-right when an Agent is
  selected. The map fills the center.
- Dense but ordered: tables with consistent columns, small tinted section headers, tabs for sub-views.
- Hover tooltips follow the existing `hoverTooltip` mechanism rendered at game-area level (no tooltips nested in
  scroll containers).

## 6. Map language

| Concept | Device |
|---|---|
| Control | Translucent faction-color fill |
| Borders | 1–2px lines with a soft glow in the controlling faction's color; thicker/brighter on faction borders |
| Selected region | Brighter fill + bright outline + subtle pulse |
| Occupied, not yet consolidated | **Diagonal hatching in the occupier's color** over the original owner's fill — and it clears when the consolidation lock lifts (Eric's idea) |
| Other states (unaffiliated, contested) | Stipple dot pattern |
| Task Force | Shield/diamond frame with unit silhouette, owner flag above, stack count, Organization bar beneath |
| Movement | HOI4-style arrow: starts fat, tapers, faction-colored, ~70% opacity, slight edge glow; curved through region centers (already curved today) |
| Invasion | Attack chevrons at the target, pointing in the direction of attack |
| Active battle | Pulsing glow + fire/particle effect along the front; Org bars on both sides readable at map level; click opens Battle Log for line details |
| Agent mission (future) | Success % shown on the map at the target (Terra Invicta style) |
| Facilities / special resources | Small badge icons with a number |

## 7. Icons and emblems

- **Style:** monoline/flat vector, 1.5–2px strokes, shield and diamond frames, readable at 16px. One consistent
  stroke and corner radius across the set. Generated and maintained as SVG in code.
- **Needed first:** platform silhouettes (infantry, vehicle, artillery, tank, light aircraft), role markers
  (Front Line, Deep Strike, CAS, Air Superiority, ISR/Radar, Long-Range Fires), resource icons, status icons
  (consolidating, routing, Shock Ready).
- **Faction flags/emblems:** real-world flags and symbols are fine to use for real nations. Fictional factions get
  original designs, one distinct silhouette each, designed to hold up as a 16px flag and as a large panel crest.
- **Agents/portraits:** portraits are **deferred**. When Agents arrive, they use **silhouettes** first.

## 8. Designer screens (Unit Designer, Task Force Designer)

Model: HOI4's Division Designer. Players should be able to *experiment*.
- A slot grid showing the loadout visually; a template/design selector at the top.
- A stats panel in grouped columns (Base / Combat / Cost) with **live change markers** against the saved design:
  green up, red down, so swapping a module immediately shows its consequences.
- A running cost/Supply estimate at the bottom; Reset, Duplicate and Save buttons.
- Everything on one screen: no step-by-step wizard.

## 9. Region development (the map gets busier)

Inspired by Victoria 3's visibly growing regions, but flat and vector:
- Buildings and Facilities add small top-down structures *inside the region's outline* — more than a badge.
- Placement is procedural and **deterministic per region** (seeded by region id) so it never jitters between
  frames or between saves; density and variety follow building levels.
- Fortifications read as defensive works; production as industrial blocks; infrastructure as roads and rails. A
  fresh region looks sparse, a developed one looks dense and layered.
- Level of detail: icons only when zoomed out, structures fade in as the player zooms.

## 10. Motion, effects and sound

- Motion is purposeful: map-level motion (moving icons along arrows, pulsing selection, combat flare) conveys
  state. UI motion is quick (100–200ms) and never blocks input.
- Battle effects scale with zoom: zoomed out, a glow and flare; zoomed in, a **later stretch** of purely visual
  eye candy: aircraft circling, ships firing, and sci-fi units (robot crabs, submarines, stealth bombers) chosen
  by the Task Forces' makeup. It is cosmetic and does not reflect the combat math.
- Particle effects need a canvas layer (PixiJS or similar); they are slated with the map renderer work.
- Sound: a deferred audio pass (UI clicks, red-X cue, battle ambience).

## 11. Sourcing

| Kind | Source |
|---|---|
| UI, icons, flags, patterns, arrows, region structures | Made in code (SVG/CSS/canvas) by us |
| Map terrain base | Public-domain or CC0 imagery (e.g. NASA Blue Marble) once the license is confirmed, darkened and tinted; or generated procedurally |
| Portraits and hero art | Deferred. Eric leans strongly toward generating art himself with AI tools, and would reconsider if Steam's rules make that a major problem. Before committing: check the generator's terms and Steam's current AI-content disclosure requirements |
| Fonts | OFL-licensed, self-hosted |
| Third-party tools (art MCPs, etc.) | Treated as an access change given the sandbox; discuss before installing |

## 12. Roadmap (each a small PR)

1. Tapered, translucent faction-colored arrows.
2. Designer screens: live change markers, grouped stats, cost estimate.
3. UI skin: fonts, panel styling, top bar, color-collision fixes.
4. Map symbols: shield-frame Task Force icons with Org bars, glowing faction borders, hatching for unconsolidated
   land, attack chevrons.
5. Region development layer (procedural structures).
6. **With Epoch 6 (full map):** flat WebGL map renderer, terrain base, zoom levels, battle effects.
7. Later: zoomed-in battle eye candy, portraits, audio.

## 13. Content guidelines

What we keep out, and what we handle carefully. These are intentions for the art and writing, not a legal review;
before release we'll check Steam's and the relevant rating bodies' current rules.

- **No gore or gratuitous violence.** Combat is shown through effects, bars and abstraction. War crimes and
  atrocities may occur in Events as *narrative*, never depicted explicitly or gratuitously.
- **No sexually explicit content.** Agents may be implied to seduce or manipulate; nothing is shown.
- **Real-world flags and national symbols are allowed** (for the nations themselves).
- **No real, living people.** No likenesses of politicians, celebrities or other living individuals, including
  AI-generated lookalikes, and no naming them in art. **Fictional characters from the novels are fine in any role**,
  including real-world offices (e.g. President Powell / Virtual Powell, who is also an Agent). The rule is against
  real-world political figures and celebrities, not against fictional characters holding those positions.
- **No extremist or hate symbols** and no real terrorist-group insignia. This applies to real-world symbols.
  Fictional factions are separate: **Mankind United** is regarded by some groups in the novels as a hate group
  (anti-AI extremists). It is portrayed *as a fictional faction within the story*, with an original emblem and
  look that don't borrow iconography from real extremist movements.
- **No caricatured or stereotyped depictions** of ethnic, national or religious groups.
- **No specific real individuals as religious figures.** Events may refer to the role generically ("The Pope
  denounces the war", "a prominent preacher at a megachurch") but not to a named real person ("Pope Leo
  denounces...").
- **No harm to children**, including in imagery. In Event text, atrocities and mass-casualty events may be
  described, but generically: they don't single out or target children. (A sterilization-virus Event or other
  mass-casualty Event naturally affects children, but the text need not call them out.)
- **No real company names in Events** (or elsewhere). The world uses stand-in names (Rayshot Dynamics, LaserWard,
  OnlyCamSesh, and so on). No real brand names or logos.
- **No imitative art of specific works.** *Genres* of art are fine: for
  example anime-style or animated-style faces are OK, but not Evangelion-style mechs or characters, and not
  characters in the style of Batman: The Animated Series, or any other specific franchise's look.
- **Practical rule for AI-generated art:** don't name artists, franchises or characters in prompts. Describe the
  qualities wanted instead (line weight, palette, mood, era). Review outputs for accidental resemblance to
  specific works or real people before using them.

## 14. Still open

- Portraits: deferred (silhouettes first). Revisit after checking Steam's AI-content disclosure rules.
- Zoom thresholds: what appears at each level is to be tuned in play.
