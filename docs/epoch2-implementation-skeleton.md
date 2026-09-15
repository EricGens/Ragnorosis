# Epoch 2 — Task Forces: Combat
## Implementation Document (SUBSTANTIALLY COMPLETE — all core combat, platform, UI, and Save/Load
components resolved; only the naval archetype columns remain deliberately deferred)

*Companion to the full GDD (ragnorosis_gdd.md, currently v2.10) and epoch1-implementation-skeleton.md. This
document specifies what to build for Epoch 2 specifically; the GDD remains the source of truth for *why*
each system works the way it does. Where this doc gives a number or rule that conflicts with the GDD, the
GDD wins — flag it as a bug in this doc, not an override.*

**Source in the GDD:** §12.2 (this epoch's charter), §8 (Military & Combat, all subsections).

**Origin note:** the initial gap analysis for this epoch was produced by the implementation-side Claude
(running in Claude Code, post-Epoch-1) after a full read of §8 and the epoch charter — see
`epoch2-questions.md` for the original handoff. Its Tier 0/1/2 triage structure is preserved below as the
organizing frame for this document, since it was independently verified against the live GDD and found
accurate.

**Building principles carried over from Epoch 1, unchanged:**
- **General system, small seed data.** A land-only slice is a *scope* decision, not license to hardcode
  anything that would need rebuilding once naval/subs/Agents arrive later.
- **Compute, don't store.** Anything derivable from other tracked values (domain control itself is the
  clearest case in this epoch) is computed fresh, never cached as an independent field that could drift.
- **Speed never changes what gets calculated**, only how fast the player watches it (Epoch 1, §3) — combat
  is precisely the kind of path-dependent system this principle was written to protect, so it applies with
  full force here.

---

## 0. Epoch Summary

**What this epoch delivers:** land-only Task Forces that can be built via a platform designer, moved,
and fought — standoff fires (counter-force only) and full invasion/ground combat (Posture, Shock,
Organization, retreat/surrender, occupation) — with a working domain-control calculation gating both.

**What this epoch does *not* include** (explicitly deferred, per the implementation Claude's Tier 2
recommendation, itself consistent with the epoch charter's own scope flag): naval embarkation, submarines,
EW/EMP/Cyber as TF-mounted mechanics (Cyberattack specifically can't function before Agents exist regardless),
Counterattack stances, counter-value standoff fire (touches the Production-suppression curve, its own open
item in §8.7).

**Definition of done:** a dev can spawn land Task Forces from a real platform designer, assign them to any
faction, move them into the same region as a hostile TF, and watch a real fight resolve — domain control
computed from actual composition, damage distributed by the established value-weighted rule, Organization
draining and triggering retreat/surrender, occupation transferring Control — all without hardcoded shortcuts
that would need rebuilding once naval combat or Agents arrive.

---

## 1. Component: Domain Control (Air/Sea Superiority) — substantially resolved this session

*SOURCE: GDD §8.5, extended significantly through direct discussion — most of what follows is new content
this session, not yet fed back into the GDD itself.*

### 1.1 Three distinct states, not one formula — RESOLVED

Domain control is **not** a single calculation covering every situation. It's three genuinely different
rules, active depending on the relationship between the calculating faction and whoever controls/occupies
the region:

1. **Ambient/uncontested access — flat 100%, no calculation.** Applies whenever the calculating faction is
   friendly or neutral with the controller (land) or whoever holds the region (unaffiliated country basis
   applies the same way), **or** the maritime region is genuinely unoccupied by anyone. **Confirmed
   bilateral, not global** — two factions can each independently be at 100% with a third party even while
   at war with each other (the Hive's Arizona position between the warring US and MU is the canon precedent
   for this specifically). A hostility between two *other* factions never affects a third faction's own
   number in that region.
2. **Land denial-by-hostility — a binary gate, not graduated.** Once the calculating faction is hostile/at-
   war with whoever *controls* a land region, transit/trade through it is simply blocked — full stop,
   independent of whether either side has an actual Task Force physically present. The controller's own
   civil/border-control apparatus does the denying; a military presence isn't required for it to work.
   **Breaking this requires actually taking Control** of at least one blocking region — defeating a
   hypothetical defending TF isn't sufficient by itself if the blockade never depended on one being there.
3. **Maritime denial — requires actual physical presence, not just hostility.** Since maritime regions carry
   no political Control, a declared hostility with no naval TF physically stationed there is a **paper
   blockade** — smuggling/transshipment proceeds at meaningful scale regardless. Genuine denial requires a
   hostile TF **actually occupying** that specific maritime region.
4. **The graduated combat-contest percentage — only once TFs are actively exchanging fire.** This is the
   *only* state that produces the classic 0–100% number gating fires-delivery-fraction and attrition (the
   GDD's "US 80% / 40%" example lives here specifically — confirmed against the live text to be scoped to
   two *adjacent, at-war* TFs mid-exchange, not a general baseline). **Genuinely complementary, not two
   independent numbers**: whichever side isn't being calculated is simply `100 − the other side's value` for
   that same region — one contest per region, not two.

**What actually determines "friendly," "neutral," "hostile," and "at war" above was never formally defined
anywhere until this session — see §1.6 below.** Every rule in this list has silently presupposed a
relationship state to read from; §1.6 is that missing foundation, not a separate system layered on top.

### 1.2 ISR/Radar Engagement Bonuses — fully resolved this session

**A deliberate departure from the GDD's original framing, confirmed intentional — ISR and Radar are not
inputs to a separate Domain Control formula at all. They're Task-Force-wide bonuses to ordinary engagement
rolls, in their respective domains, and Air Superiority emerges *indirectly* from winning those rolls.**

- **Radar** provides a flat bonus to every roll in the 4th (Anti-Air) vector position, Task-Force-wide.
  **ISR** provides the same bonus to every roll in the first 3 (anti-ground) positions.
- **Recomputed every tick, based on relative advantage only** — the same "only the delta matters, never
  either side's absolute level" principle already established (§1.3 below, formerly this section). **For
  every 2 points of relative advantage, +1 to the advantaged side's rolls** (1–2 points → +1, 3–4 → +2, and
  so on).
- **Only active units — currently paired on Front Line, Long-Range Fires, or CAS — contribute**, with one
  confirmed future exception: dedicated AWACS/JSTARS-equivalent platforms will be able to contribute from
  Reserves (staying back for relative safety, though not perfect safety, since combat can still pull Reserve
  units into active lines or expose them to long-range fires over time). **No platform this epoch has that
  capability** — none of the five platforms defined in §3 carry it.
- **Two caps, both confirmed with real numbers this session:**
  - **+10 maximum contribution per platform *type*** (all Vehicles together cap at +10, all Light Aircraft
    together cap at +10, and so on, independently per type).
  - **+50 Task-Force-wide cap** before the battlespace is considered saturated for sensor purposes.
  - **Verified this session: the +10 per-type cap is mathematically reachable today, not just a future
    concern as originally assumed** — 12 Vehicle units each carrying a +1 Radar module would total +12 raw,
    exceeding the cap and getting clipped to +10. In practice this is unlikely (dedicating an entire 12-unit
    line purely to sensors sacrifices all actual combat capability), but the cap is live now, not dormant.
  - **Order of operations, disambiguated following external review — resolved as sequential, not
    simultaneous:** the +10 per-platform-type cap applies first, clipping each platform type's raw
    contribution independently; **only after every type has been capped are the capped values summed into
    each side's Task-Force-wide total** (itself then subject to the +50 cap), and *that* final capped total
    is what the relative-advantage delta is computed from. A platform type's excess contribution never
    leaks into another type's headroom, and relative advantage is never computed from uncapped raw numbers.

### 1.3 The Air Superiority Percentage Formula — fully resolved this session

**Anchors, confirmed consistent with the three-state model (§1.1):** 100% over a region you control with no
active combat; 0% over a hostile region with no active combat — these are simply the numeric expression of
the "ambient access" and "blocked" states already established, not new rules. **Bilateral symmetry holds
exactly as before:** reversing faction perspective always sums to 100% for the same region.

**Once combat is active, recomputed fresh every tick — deliberately volatile, not smoothed or accumulated
across a battle.** A lucky tick can swing a region's Air Superiority dramatically; an unlucky one can swing
it right back. Confirmed intentional: an active struggle between two capable forces should feel genuinely
volatile until one side's advantage becomes consistent enough to settle the number down — this is treated as
realistic, not a bug to dampen.

**Long-range fires effects, resolved with worked numbers:**
- **Air-vs-air duels** (two units both carrying AA-capable weapons, fighting each other directly) — a
  successful engagement has a further 50/50 random chance of affecting either region's Air Superiority,
  since the engagement itself has no inherent tie to a specific piece of ground the way a strike does.
- **Artillery duels, SCUD-hunts, and unopposed strikes** (air- or ground-launched) affect the region
  *opposite* the side that won — a successful engagement by the attacker raises the attacker's own Air
  Superiority over the *defender's* region, not their own.
- **+8% per successful engagement, for that tick only** — no cumulative carry-over; each tick's result comes
  entirely from that tick's own engagements.
- **Full-vacate rule:** if a side completely clears the enemy's Long-Range Fires line (zero units remaining
  there), any successful engagement — even an otherwise-unopposed one — grants a full 100% instantly, domain
  dominance rather than incremental gain.
- **Real ceiling without full-vacate, confirmed by the numbers:** even sweeping all 12 possible engagements
  at +8% each caps at 96%, never true 100% — and given how push-heavy the underlying roll system is, actually
  reaching that ceiling without a full vacate is a near-statistical impossibility in practice.

**Invasion adds CAS-line effects on top of the same long-range dynamic, not a replacement for it:**
- **Successful invading-side CAS attacks, and successful invading-side air-defense kills against the
  defender's CAS, each grant the invader +5%** over the defended region.
- **Successful defending-side CAS attacks, and successful defending-side air-defense kills against the
  invader's CAS, each grant the invader −5%** (i.e., the defender claws back ground).
- **Hard cap at 100% overall**, since combined long-range and CAS effects could otherwise exceed it.
- **The same full-vacate 100% rule applies, but requires clearing *both* lines** (Long-Range Fires and CAS),
  not just one, to trigger.

### 1.4 Freedom-of-Maneuver Combat Bonus — fully resolved this session, a new mechanic beyond the original
Tier 0 scope

**Sum a faction's own Air Superiority across both regions in conflict** (their own home region plus the
contested one) **— for every 20-point increment above 100%, the whole Task Force gets +1 to every nonzero
combat vector value**, reflecting genuine freedom to maneuver and operate without harassment. **Below 100%,
the bonus flows to the opposing Task Force instead.**

**Worth being explicit about why 100% is the correct threshold, not an arbitrary round number:** it's exactly
the value the anchors themselves produce at rest (100% home + 0% hostile = 100% exactly) — so this bonus
never rewards simply existing at baseline dominance, only genuinely exceeding what home/away geography alone
would predict.

**A real, bounded positive-feedback loop, flagged honestly rather than glossed over:** winning CAS/long-range
engagements raises Air Superiority, which can cross the 120% threshold and grant a combat bonus, which makes
future engagements easier to win, which can raise Air Superiority further. This is bounded — both regions'
percentages cap at 100% each, so the maximum possible bonus tops out around +5 in a full-vacate-both-lines
scenario — but it's a genuine snowball while active, not just a one-time bonus. **Validated against a worked
example (§1.5 below) rather than left as an untested concern.**

### 1.5 Worked Example — 50 Heavy Infantry vs. 5 MBT + 5 Towed Artillery + 5 CAS Aircraft, validating the
formula and the design goal together

**Built specifically to stress-test whether pure, low-cost mass remains viable against a smaller
combined-arms force, per Eric's explicit design goal — not just to exercise the formula.**

**Cost: the mass force is actually the *more* expensive one** — 3,500 Production (50 × 70 for Heavy
Infantry) vs. 2,500 for the combined-arms force (1,000 Tanks + 500 Artillery + 1,000 CAS), a real, notable
finding in its own right.

**Front Line (the ground fight): mass has genuine teeth.** Only 5 of the combined-arms force's 15 units can
occupy Front Line at all (Tanks only — Artillery and CAS aircraft can't); the remaining 7 of the mass force's
12 Front-Line slots get free, fully unopposed Flanking rolls every tick against those same 5 Tanks. Over many
ticks, that's real, mounting pressure from a force that costs less to field per unit but wins its paired
fights less often.

**But the mass force cannot contest Air Superiority at all — the actual structural finding this example
surfaced.** Heavy Infantry has zero standoff capability and cannot crew a CAS aircraft, so it fields nothing
on Long-Range Fires or CAS offense — only defense (its Reserve pool can shoot down some enemy CAS runs).
Computed expected value: **roughly +3.75% Air Superiority swing per tick favoring the combined-arms force**,
compounding via the freedom-of-maneuver bonus (§1.4) into the very ground fight the mass force is trying to
win through attrition.

**Verdict, confirmed to satisfy the original design goal:** mass isn't punished for being mass — it's
genuinely grinding down the smaller force's Tanks on the ground. But *pure, undifferentiated* mass with zero
investment in AA or long-range coverage cedes the Air Superiority contest entirely, a real and escalating
cost it has to outrace before the compounding bonus tips the ground fight too. Read as intended strategic
texture — a mass player isn't structurally disadvantaged, but a mass player who ignores air/long-range
coverage entirely is leaving a real, exploitable gap open. **Exact percentages (8%, 5%, the 2-points-per-+1
ISR/Radar curve) are explicitly earmarked for real playtesting tuning once the software exists** — this
example validates the formula's *shape* produces a viable, non-degenerate fight, not that these specific
numbers are final.

**Genuinely resolved:**
- Does a region with no TF present from either side sit at neutral 50/50, or retain some baseline from the
  last controller? **Resolved — neither, no special case needed at all.** The anchor logic was already
  defined in terms of the Faction/Country relationship check (§1.6), not in terms of whether a TF happens to
  be physically present: permissive relationship → 100%, hostile → 0%, uniformly, whether or not anyone is
  actually there. The general rule already covered this case; it never needed its own default.

**Still genuinely open — worth being precise that restating the mechanism doesn't close this one:**
- Exact ISR/Radar module values beyond Tier I (how caps and per-module contributions scale at higher tech
  tiers). The *mechanism* — ISR/Radar contribute indirectly, by making the engagements that actually move
  Air Superiority more likely to succeed, not as a direct input to the percentage itself — has been fully
  resolved since Component 1's original session and hasn't changed. But that's a different question from
  the specific numeric values a Tier II or III module would carry, which remain genuinely unwritten,
  consistent with every other tiered system in this design (Piercing tiers, Armor materials) waiting on real
  Tech-epoch balancing.

### 1.6 Faction & Country Relationship Matrix — fully resolved this session, the missing foundation every
combat mechanic in this epoch has silently presupposed

**Not a UI feature — a genuine data-model gap this whole epoch's combat system has been built on top of
without anyone formally defining it.** Every mechanic from Domain Control's three-state model (§1.1) through
Transit Combat (§4.6) has assumed some notion of "these two Task Forces are at war" without anything ever
specifying where that check actually reads from. This section is that missing piece.

**Two matrices, resolved with exact states:**
- **Faction-level: Friendly / Neutral / Hostile.** Symmetric — one shared state between any two factions,
  not two independent one-directional views (unlike the Air Superiority percentage, which is deliberately
  asymmetric/complementary). **Covers all eight factions, including the three with zero region control on
  the dummy map** — Red Queen, the Gamer, and the Widows are confirmed to need real entries: hostility
  between two factions can matter for Agent or Event interactions even without either side holding
  territory.
- **Country-level: At War / At Peace.** Symmetric, covers every pair of countries present on the map
  (five on the dummy map: United States, Taiwan, China, France, Mexico). **War applies uniformly across
  every region belonging to both countries involved** — worked example: if the China Faction controls both
  the China and Vietnam countries, a US declaration of war against China Faction puts the US country at war
  with *both* China and Vietnam simultaneously, and every region belonging to either becomes valid for
  combat, not just a subset.

**The gating rule, resolved: War at the country level requires Hostile at the Faction level first, if either
country is Faction-controlled** — but this is enforced by **automatic cascade, not a hard block.** Setting
two countries to War, where each is controlled by a different Faction, automatically sets those Factions to
Hostile as a side effect, rather than refusing the action or requiring a separate prior step. Deliberately
chosen over blocking: it makes the inconsistent state (Hostile-free War) structurally unreachable rather
than something devtools has to police. Unaffiliated regions (no Faction control) only ever need the
country-level War/Peace state — declaring the US at war with France, an unaffiliated country, needs no
Faction-level entry at all.

**Domain Control's three-state model (§1.1) is confirmed to read directly from this matrix, not a separate
system:** Friendly or Neutral (Faction-level) or At Peace (Country-level, where unaffiliated) produces the
ambient 100% baseline; Hostile or At War produces the 0% blocked baseline; **only once actual combat is
active does the graduated, calculated percentage apply on top.** One source of truth, not two overlapping
ones that could drift out of sync.

**A confirmed future invariant, not enforced by anything this epoch actually builds — worth capturing now
regardless, since violating it would be a real data-model bug once later epochs add the mechanisms that
could trigger it:** a country can never have split Faction control across its constituent regions. Every
region belonging to one country is either uniformly controlled by one Faction or entirely unaffiliated —
there is no valid state where two regions of the same country answer to different Factions. **When regions
break away from a Faction's control (a mechanic deferred to a later epoch), they don't create split control
of the existing country — they spin off into a genuinely new, separately-named country** (the worked
example given: Texas breaking from US Faction control under Mankind United doesn't make Texas "part of the
US that MU happens to control," it becomes a new country, e.g. "Lone Star Republic"). **Explicitly not
active enforcement code this epoch** — nothing in Epoch 2's actual mechanics can cause a region to change
Faction control at all, so this invariant can't currently be violated; it's documented now so whoever builds
the breakaway/country-splitting mechanic later inherits the constraint already decided, not a fresh design
question.

**How this reaches War in the fuller game, deferred but worth having on record:** not Agent-driven yet in
this epoch — a dev sets the states directly. The eventual mechanism: repeated hostile Agent Missions (tech
theft, fomenting instability) drift a Faction relationship toward Hostile; friendly actions (trade, aid)
drift it toward Friendly; reaching Hostile plus sufficient Global Tension unlocks an Agent Mission to
actually declare War at the country level, which then makes combat possible. None of that drift mechanism
exists this epoch — only the direct dev-settable end states do.

**Devtools implications, confirmed:** a dev can directly set any Faction pair's relationship
(Friendly/Neutral/Hostile) and any country pair's state (At War/At Peace), with the auto-cascade behavior
built in rather than requiring the two settings to be applied in a specific order.

---

## 2. Component: Weapon/Defense Archetypes & the Effectiveness Matrix — RETIRED, superseded by §3.6/§5

*SOURCE: GDD §8.3 (structure), §10.2.1 (the tech tree's existing weapons/modules roster) — originally the
implementation-side Claude's Tier 0 #2. Retired as its own component this session: the three questions below
were never directly answered, they were superseded by a different architecture entirely.*

**What actually got built instead of a weapon-type matchup matrix:** platform-*category* vectors
(Infantry/Vehicle/Tank/Anti-Air, §3.6) with module-additive values, not weapon-archetype-vs-weapon-archetype
matchups. This wasn't a refinement of the matrix idea — it replaced it. The GDD's own §8.3 keystone language
was corrected to match (GDD v2.5).

**The three original questions, answered by that replacement rather than directly:**
- *"Is the tech-tree weapons list the archetype list?"* — No. The tech-tree list names the **modules**; the
  **archetype list** is the four platform-category vector columns those modules contribute values to.
- *"A first-pass matchup matrix?"* — Not needed. Module-additive vector values replace matrix lookups
  entirely (§3.6, §5.2).
- *"Land-only scope for this epoch?"* — Resolved and since expanded: Infantry, Armor, Artillery, one
  CAS-capable aircraft, plus Heavy Aircraft (added specifically to carry ISR modules, §3 intro).

---

## 3. Component: Platform Designer & Task Force Composer (land-only slice)

*SOURCE: GDD §8.2 (three-layer pipeline), scoped down per the implementation-side Claude's proposed slice —
substantially resolved this session, starting from Infantry as the first fully-worked platform.*

**Roster for this epoch, confirmed and expanded from the original handoff:** Infantry, Armor (Tank),
Artillery, one CAS-capable aircraft, **plus Heavy Aircraft** (added this session specifically to carry ISR
modules — Heavy Aircraft is the canonical ISR-carrier platform per its existing JSTARS-equivalent framing,
§10.2.1.3, distinct from Radar/AWACS and Sonar).

### 3.1 Infantry — fully resolved, the first concrete platform

**Consolidated Unit Definition Schema — the general template every future platform (Tank, Vehicle, Artillery,
CAS aircraft) should follow, verified against every number established across this whole document (all
values checked programmatically against prior sessions, zero discrepancies found):**

**Base Platform** *(fixed per platform type)*
| Stat | Value |
|---|---|
| Name | Infantry |
| Module slots | 1 Main Weapon, 2 Misc |
| Base speed | 5(30) mph — Combat(Transit) |
| Organization | 25 |
| Health | 10 |
| Manpower | 50 |
| Weight | 1 |
| Armor | 0 — Infantry has no platform base and no module access (resolved below); a true exception, not a Vehicle-style "0 base with module potential" |

**Main Weapon Module (requires exactly 1)**
| Module | Cost | Supply | Combat Vector (Inf/Veh/Tank/AA) | Piercing | Damage |
|---|---|---|---|---|---|
| Small Arms I | +50 | +1.0 | +5/+3/0/0 | 0 | +5 |

Renames the Equipment to **Light Infantry** when no Misc modules are attached. Advanced Small Arms tiers and
the Man-portable Laser module are deferred to future epochs.

**Misc Modules (optional, up to 2)**
| Module | Cost | Supply | Combat Vector | Piercing | Damage |
|---|---|---|---|---|---|
| Man-portable AT | +10 | +0.1 | +1/+5/+5/0 | +5 | 0 |
| Man-portable AA | +10 | +0.1 | 0/0/0/+5 | 0 | 0 |

Renames to **AT Infantry** or **AA Infantry** when taken alone, **Heavy Infantry** when both are taken.
Advanced AT/AA tiers, EMP modules, and Cyber Hardening modules are deferred to future epochs.

**Armor architecture, resolved this session — a hybrid, not a pure platform-fixed or pure module-contributed
choice:** `Armor = platform-specific base value (fixed per platform type) + any Armor module equipped
(additive)`. **Some platform types have a nonzero base** (Tank, Robot Crab, Ship — "some thickness of steel"
inherent to the platform); **Vehicle's base is 0** (a thin-skinned truck by default). **Armor modules —
Reactive Armor, Advanced Composites, Diamondoid Armor (the already-established tiered line, §10.2.1 of the
GDD) — add on top of whichever base a platform starts with**, turning a bare Vehicle into something more like
an APC. This is the same additive-composition pattern already used for Combat Vector, Piercing, Production
cost, and Supply Consumption throughout this schema — Armor isn't a special case, it just has a
platform-specific starting point instead of a universal one. **Infantry is a genuine exception, not just a
zero:** it has neither a platform base (it isn't one of the Armor-eligible platform types) nor module access
to gain any (§3.1's exclusion list above) — meaningfully different from Vehicle's "0 base, but real module
access," even though both currently read as "Armor: 0."

**Module slots: one Weapon, two Misc.** Misc slots reflect attached weapons teams, defensive capability, or
special capability at the formation level, not organic infantry loadout.

**Confirmed module eligibility:**
- **Weapon slot:** Small Arms (base weapon). Lasers become available as an alternative primary weapon once
  the relevant tech unlocks — deferred to the Tech epoch, not resolved now.
- **Misc slots:** Man-portable Anti-Tank, Man-portable Anti-Air (both — reflecting weapons teams attached to
  the formation, not universal individual-soldier equipment).
- **Explicitly excluded, with reasoning:** Cyber Hardening and EMP are real infantry-appropriate modules
  conceptually, but neither special-attack system is implemented this epoch, so they're deferred rather than
  built now. EW/Countermeasures, ISR, Radar, Sonar, Targeting Computer are **not** infantry-scale equipment —
  confirmed as vehicle-class-and-larger systems only. A weak ground-focused ISR capability is conceptually
  plausible (an FPV-drone-team-level sensor) but belongs on the separate FPV Drone Team platform, not folded
  into Infantry. **Armor modules (Reactive/Advanced Composites/Diamondoid, §10.2.1 of the GDD) are also
  excluded — a genuine gap in this list until this session, discussed verbally early on but never actually
  written down.** Infantry gets neither a platform-base Armor value nor module-based access to gain any —
  unlike Vehicle/Tank/Robot Crab/Ship/Airship, which are the Armor-eligible platform types (the resolved
  architecture above).

**Unit size and cost, revised this session (originally proposed at 500 personnel/battalion scale, corrected
after the granularity felt wrong against Manpower's fine-grained accumulation):**
- **50 Manpower per unit** (roughly platoon-scale, not battalion).
- **Small Arms: 50 Production** (1 Production per person equipped).
- **Each Misc module: +10 Production flat**, regardless of type — reflects that not every soldier in the
  formation carries the attached weapon; it's added capability, not per-capita cost.

**Four buildable Infantry Equipment types, confirmed, now with Weight and Supply Consumption resolved:**

| Equipment Type | Modules | Production Cost | Weight | Supply Consumption |
|---|---|---|---|---|
| Light Infantry | Small Arms only | 50 | 1 | 1.0 |
| AT Infantry | Small Arms + Man-portable AT | 60 | 1 | 1.1 |
| AA Infantry | Small Arms + Man-portable AA | 60 | 1 | 1.1 |
| Heavy Infantry | Small Arms + both Misc | 70 | 1 | 1.2 |

**Weight = 1 for all four types, confirmed this session** — matches the naval-embarkation baseline capacity
every ship carries with zero modules (GDD §8.1.1, v2.3), regardless of ship size, submarines included. A
single Infantry unit riding bare on the smallest vessel is the concrete case behind that baseline's existing
SEAL-team flavor text.

**Supply Consumption confirmed at 1.0 for Light Infantry specifically — matching the GDD's own pre-existing
illustrative example exactly** (§8.7: "Infantry 1, Rail Gun Tank 5, Hypersonic Truck 10"), not a new number
introduced here. AT/AA at 1.1 and Heavy at 1.2 extend that baseline for the misc-module variants, at roughly
half the percentage growth rate Production cost uses per module (+20% Production per module vs. +10% Supply
Consumption) — a deliberate, gentler curve, not an inconsistency.

**Speed resolved for all Infantry types at §4.5 below: 5(30) mph** (Combat/Transit) — the general land-unit
default, not something that varies by Equipment type for Infantry specifically.

### 3.2 Vehicle — fully resolved this session, the second concrete platform, first to use the Engine slot

**Base Platform**
| Stat | Value |
|---|---|
| Name | Vehicle |
| Module slots | 1 Main Weapon, 1 Engine, 3 Misc |
| Base speed | 10(30) mph — Combat(Transit); double Infantry's Combat Speed, identical Transit Speed (Infantry's
own Transit already assumes riding in vehicles, so no reason for the two to diverge there) |
| Organization | 10 — well below Infantry's 25 |
| Health | 15 — above Infantry's 10 |
| Manpower | 20 — well below Infantry's 50 |
| Weight | 5 — already-established naval-embarkation threshold requiring a Cargo Hold, confirmed consistent |
| Armor | 0 base — Vehicle is one of the Armor-eligible platform types (§3.1's resolved architecture), starting
bare rather than having no path to Armor at all the way Infantry does |

**Main Weapon Module (requires exactly 1)**
| Module | Cost | Supply | Combat Vector | Piercing | Damage |
|---|---|---|---|---|---|
| Crew-Served Weapons I *(Small Arms I, renamed for this platform)* | +50 | +1.0 | +5/+3/0/0 | 0 | +5 |
| Autocannon I | +100 | +2.0 | +8/+8/+3/+3 | +5 | +10 |

Crew-Served Weapons alone renames the Equipment to **Light Utility Vehicle**; Autocannon alone renames it to
**Recon Vehicle**. **Autocannon gives baseline Tank and Anti-Air capability (+3/+3) that Infantry's own base
weapon can never reach without dedicating a whole Misc slot to it** — a genuine platform-level
differentiator, not just a bigger number on the same axes Infantry already covers.

**Engine Module (requires exactly 1) — new slot type, first platform to need one**
| Module | Cost | Supply | Speed | Naming |
|---|---|---|---|---|
| Diesel Engine I | +50 | +2.5 | 0(0) | No effect |

**Zero net stat change for real Production and Supply cost — confirmed intentional, not an error.** Diesel
Engine represents the baseline cost of having a functioning vehicle at all, not a paid-for speed bonus —
every Vehicle build costs at least 100 Production before any weapon specialization, not 50. Future engine
types (gas turbine, jet, nuclear, fusion) are expected to provide real speed bonuses and are deferred to
later epochs; not every platform requiring an engine will have every engine type available to it.

**Misc Modules (optional, up to 3)**
| Module | Cost | Supply | Combat Vector | Piercing | Armor | Speed | Other | Naming |
|---|---|---|---|---|---|---|---|---|
| Crew-Served AT *(Man-portable AT, renamed)* | +10 | +0.1 | +1/+5/+5/0 | +5 | — | — | — | Adds "(AT)" |
| Crew-Served AA *(Man-portable AA, renamed)* | +10 | +0.1 | 0/0/0/+5 | 0 | — | — | — | Adds "(SHORAD)" |
| Reactive Armor | +50 | +0.5 | — | — | +5 | −2(−5) | — | Renames to **Light APC** (with Crew-Served
Weapons) or **APC** (with Autocannon) |
| Targeting Computer I | +10 | +0.1 | +2/+2/+2/+5 | — | — | — | — | Adds "(AFCS)" |
| Radar I | +25 | +0.5 | 0/0/0/+5 | — | — | — | **Radar: +1** (feeds Domain Control's Air Superiority
contribution, §1 — corrected this session from an earlier "ISR" mislabel; Radar is the established
air-to-air-advantage concept, ISR is air-to-ground, and the two shouldn't be conflated even informally) |
Adds "(Radar)" |

**Reactive Armor is the first module in this schema with a genuine tradeoff rather than pure benefit** — it
adds Armor but subtracts Speed, both Combat and Transit. Worth flagging for whenever Advanced Composites and
Diamondoid (the next Armor tiers) get designed: a smaller speed penalty as the material improves would match
a natural "better tech, less tradeoff" curve, though that's a future call, not resolved now.

**Worked naming examples, confirmed (one correction from the original draft):**
- Air-defense build: Autocannon + Diesel Engine, Crew-Served AA + Targeting Computer + Radar → **"Recon
  Vehicle (SHORAD/AFCS/Radar)"** — corrected from an initial "Light Utility Vehicle" mislabel; the build uses
  Autocannon as its main weapon, so it inherits Autocannon's rename, not Crew-Served Weapons'.
- Cheap APC: Crew-Served Weapons + Diesel Engine, Reactive Armor → **"Light APC"**.
- Thin-skinned anti-tank platform: Autocannon + Diesel Engine, Crew-Served AT + Targeting Computer →
  **"Recon Vehicle (AT/AFCS)"**.

**How Vehicle compares to Infantry, worth stating explicitly rather than leaving implicit:** a base Vehicle
(Crew-Served Weapons + Diesel Engine) costs 100 Production — double a base Infantry unit — for double the
Combat Speed, 1.5× the Health, but only 40% of both Infantry's Organization and its Manpower requirement.
Genuinely differentiated, not simply better or worse: Vehicles move faster and survive individual engagements
better, but a Vehicle-heavy Task Force's overall cohesion cracks faster under sustained pressure than an
Infantry-heavy one — directly reinforcing Infantry's already-established role as cheap, disposable staying
power (§3.1) rather than competing with it on the same axis.

### 3.3 Artillery — fully resolved this session, the third concrete platform, first to reuse an existing
vector column rather than needing its own

**A genuinely new architectural pattern, worth stating explicitly since it's reused later, not invented for
Artillery specifically:** Artillery has its own platform (own base stats below), but its combat-vector
*matching* — how other units' attack vectors read it as a target — uses the **existing Vehicle column**,
not a dedicated new one. This is the same pattern already implicit in how Humanoid Robot, FPV Drone Team, and
Robot Dog are separate platforms from Infantry but get matched against the *Infantry* column. Deliberately
avoids a combinatorial explosion of vector columns (and retroactive updates to every already-defined module)
every time a new platform is added that doesn't need its own dedicated RPS category.

**Base Platform**
| Stat | Value |
|---|---|
| Name | Artillery (matched against the Vehicle column for combat purposes, not its own column) |
| Module slots | 1 Main Weapon, 1 Engine (optional), 1 Misc (optional) |
| Base speed | 5(30) mph — matches Infantry's Combat Speed without an engine (towed, dragged at foot pace);
with the Diesel Engine module, reaches 10(30), identical to Vehicle's own baseline (§3.2) |
| Organization | 5 — the lowest of any platform so far (Infantry 25, Vehicle 10, Artillery 5), reflecting how
fragile and easily suppressed artillery pieces are |
| Health | 15 — matches Vehicle |
| Manpower | 15 — below Vehicle's 20, a smaller crew than a full combat vehicle |
| Weight | 5 — the same naval-embarkation threshold as Vehicle, still requires Cargo Hold |
| Armor | 0 |

**Main Weapon Module (requires exactly 1)**
| Module | Cost | Supply | Combat Vector (Inf/Veh/Tank/AA) | Piercing | Damage |
|---|---|---|---|---|---|
| Tube Artillery | +100 | +2.0 | +8(8)/+8(8)/+5(5)/0 | +5 | +10 |
| Rocket Artillery | +150 | +2.5 | +5(10)/+5(10)/+3(8)/0 | +8 | +15 |

Tube Artillery alone renames to **Towed Artillery**; Rocket Artillery alone renames to **MLRS**. **The two
modules have deliberately different range profiles, not just different power levels:** Tube Artillery is
flat across range (plain and parenthetical values equal throughout); Rocket Artillery favors long range
(parenthetical values meaningfully higher than plain) — a genuine thematic contrast between direct tube fire
and rocket-based standoff strike, not two versions of the same shape at different power tiers.

**Engine Module (optional, up to 1) — genuinely optional here, unlike Vehicle's required Engine slot, since
it's exactly what drives the towed-vs-self-propelled distinction**
| Module | Cost | Supply | Speed | Naming |
|---|---|---|---|---|
| Diesel Engine I | +50 | +2.5 | +5(0) | Renames Towed Artillery → **Self-Propelled Gun**; MLRS →
**Transporter Erector Launcher (TEL)** |

Adds +5 to Combat Speed specifically (Transit stays at its already-sufficient 30 ceiling, no bonus needed
there) — bringing an engine-equipped Artillery platform's Combat Speed to exactly 10 mph, identical to
Vehicle's own baseline, a satisfying consistency rather than a coincidence (a Self-Propelled Gun is, after
all, genuinely mechanized the same way an ordinary Vehicle is).

**Misc Module (optional, up to 1)**
| Module | Cost | Supply | Combat Vector | Naming |
|---|---|---|---|---|
| Targeting Computer I | +10 | +0.1 | +2/+2/+2/**0** | Adds "(AFCS)" |

**The Anti-Air value is 0 here, confirmed distinct from Vehicle's own Targeting Computer module (which
carries +5 in that slot)** — Artillery has no inherent anti-air role at all, unlike Vehicle which can mount
dedicated AA capability via Crew-Served AA, so there's nothing for Targeting Computer to meaningfully enhance
in that column for this platform specifically.

**Cross-platform stat trend, now visible across all three platforms defined so far:** Organization and
Manpower both decrease monotonically from Infantry through Vehicle to Artillery (25→10→5, 50→20→15) — a
consistent, deliberate story of increasing specialization and increasing fragility as platforms get more
mechanized, not independently-chosen numbers that happen to trend the same direction.

### 3.4 Tank — fully resolved this session, the fourth concrete platform, first to have a nonzero Armor base
and the first to make the platform-specific-modules architecture explicit

**Corrected from the original draft, which named this platform "Vehicle" — almost certainly a copy-paste
artifact from using the Vehicle schema as a starting template.** Every stat below (Health 25, Armor 5,
Weight 10) describes something heavier and more armored than Vehicle itself, confirming Tank is the
intended name.

**Architecture, confirmed this session — modules are platform-specific catalog entries, not a shared pool
referenced across multiple platforms.** Several of Tank's modules happen to share exact stats with Vehicle's
or Artillery's equivalents (Autocannon I, Diesel Engine I, Crew-served AT, Crew-served AA, Reactive Armor) —
that's coincidental overlap because those capabilities genuinely perform the same way on both platforms, not
evidence of one underlying shared definition. Where a module's numbers *do* differ by platform — Targeting
Computer's Anti-Air contribution here is `0`, versus Vehicle's `+5` — that's a deliberate balance lever, not
an inconsistency needing reconciliation: it's part of what keeps Tank well-rounded across multiple threat
types without being AA-specialized the way a purpose-built Vehicle can be.

**Base Platform**
| Stat | Value |
|---|---|
| Name | Tank |
| Module slots | 1 Main Weapon, 1 Engine, 2 Misc |
| Base speed | 8(30) mph — slower Combat Speed than Vehicle's 10, a real tradeoff for greater durability,
consistent with Reactive Armor's own speed-cost shape elsewhere in this schema |
| Organization | 10 — matches Vehicle |
| Health | 25 — the highest of any platform so far (Infantry 10, Vehicle/Artillery 15, Tank 25) |
| Manpower | 16 |
| Weight | 10 — the first platform to exceed the 5-Weight naval-embarkation threshold meaningfully, well
beyond bare Cargo Hold requirements |
| Armor | 5 — the first platform with a nonzero base, confirmed as the intended "some thickness of steel
inherent to the platform" case from the Armor architecture resolved for Vehicle (§3.2) |

**Main Weapon Module (requires exactly 1)**
| Module | Cost | Supply | Combat Vector (Inf/Veh/Tank/AA) | Piercing | Damage |
|---|---|---|---|---|---|
| Autocannon I | +100 | +2.0 | +8/+8/+3/+3 | +5 | +10 |
| Cannon I | +150 | +2.5 | +10/+10/+8/0 | +10 | +15 |

Autocannon alone renames to **Infantry Fighting Vehicle**; Cannon alone renames to **Main Battle Tank**.
**Cannon carries no Anti-Air value at all**, unlike every other main weapon defined so far — a genuine,
deliberate specialization rather than an oversight, reinforcing that a Main Battle Tank build is meant to be
a pure ground-combat specialist, with any AA contribution needing to come entirely from misc modules instead.

**Engine Module (requires exactly 1)**
| Module | Cost | Supply | Speed | Naming |
|---|---|---|---|---|
| Diesel Engine I | +50 | +2.5 | 0(0) | No effect |
| Gas Turbine Engine I | +80 | +2.7 | +2(0) | No effect |

**Gas Turbine is the first engine in this schema to deliver a genuine speed bonus** — Vehicle's and
Artillery's Diesel Engines were both zero-net-effect (representing the baseline cost of having a functioning
platform at all), with real speed-bonus engines explicitly flagged as "expected in later epochs." Gas
Turbine arriving now, right on that schedule, is a good sign the platform-cost logic is holding up as
platforms get more advanced.

**Misc Modules (optional, up to 2)**
| Module | Cost | Supply | Combat Vector | Piercing | Armor | Speed | Naming |
|---|---|---|---|---|---|---|---|
| Crew Served Weapons *(Small Arms, renamed for this platform)* | +10 | +0.1 | +5/+3/0/0 | 0 | — | — | Adds
"(Anti-personnel)" |
| Crew-served AT | +10 | +0.1 | +1/+5/+5/0 | +5 | — | — | Adds "(AT)" |
| Crew-served AA | +10 | +0.1 | 0/0/0/+5 | 0 | — | — | Adds "(SHORAD)" |
| Reactive Armor | +50 | +0.5 | — | — | +5 | −2(−5) | Adds "(AOA)" |
| Targeting Computer I | +10 | +0.1 | +2/+2/+2/**0** | — | — | — | Adds "(AFCS)" |

**Reactive Armor uses a plain suffix here ("(AOA)") rather than the full rename Vehicle's version performs
(Light APC/APC)** — confirmed as a deliberate simplification specific to Tank, consistent with how every
other Tank misc module already behaves (suffix-only), not an inconsistency to fix.

**A confirmed general rule, now with four platforms' worth of evidence behind it: Damage only ever comes from
the Main Weapon module, never from Misc modules** — true across every misc module on Infantry, Vehicle,
Artillery, and Tank alike. Worth treating as a settled architectural rule for any future platform, not just
an observed pattern so far.

**Tank's practical build space, illustrating the "well-rounded, not AA-specialized" design intent directly:**
a bare Autocannon build (Infantry Fighting Vehicle) already carries modest AA capability (+3) from its main
weapon alone; adding Crew-served AA and Targeting Computer pushes that further, but Targeting Computer's
weaker AA contribution here (0, vs. Vehicle's +5) caps how far a Tank-based AA build can go relative to a
Vehicle purpose-built for the same role — exactly the intended outcome, not a limitation to work around.

### 3.5 Light Aircraft — fully resolved this session, the fifth and final concrete platform for this epoch,
first with multiple Main Weapon slots and duplicate modules allowed

**Base Platform**
| Stat | Value |
|---|---|
| Name | Light Aircraft |
| Module slots | 1–3 Main Weapon (**duplicates allowed** — e.g. 2× PGM + 1× Autocannon, or 3× AGM — the
first platform where this is possible), 1 Engine, up to 2 Misc |
| Base speed | 300(300) mph — **confirmed genuinely unused**, since aircraft never enter the TF speed
calculation at all (§4.5), included for reference/flavor only, not because anything reads it |
| Organization | 10 |
| Health | 20 |
| Manpower | 5 — the lowest of any platform so far (Infantry 50, Vehicle 20, Artillery 15, Tank 16, Light
Aircraft 5), fitting a small aircrew |
| Weight | 10 — **not the same Weight system land platforms use.** This is the already-established naval
carrier-capacity figure for a light aircraft squadron (§8.1.1 of the GDD: "a light aircraft squadron = 10"),
governing Flight Deck/Carrier module capacity, entirely separate from the Cargo-Hold-based Weight system
every ground platform (Infantry through Tank) competes against. A Light Aircraft and a Tank both showing
"Weight 10" is coincidence of notation, not competition for the same capacity pool. |
| Armor | 0 |

**Naming, based on equipped Main Weapon category — a genuinely different naming logic from every ground
platform so far** (which named off specific module combinations directly): **all anti-ground weapons → CAS
aircraft; all anti-air weapons → Air Superiority Fighter; a mixture → Multirole Fighter.** **Scope-limited
this epoch, confirmed deliberate:** Fable is only implementing CAS aircraft this round, so no Air-to-Air
Missile module is included in the valid weapons list below — the naming rule itself stays fully general for
when AAM modules are added later, but only the CAS outcome is actually reachable with this epoch's module
set.

**Main Weapon Modules (1–3 slots, duplicates permitted)**
| Module | Cost | Supply | Combat Vector (Inf/Veh/Tank/AA) | Piercing | Damage |
|---|---|---|---|---|---|
| Autocannon | +80 | +1.5 | +8/+8/+3/0 | +2 | +5 |
| Precision Guided Munitions | +120 | +2.0 | +12/+12/+10/0 | +5 | +15 |
| Air-to-Ground Missiles | +180 | +2.8 | +10(5)/+10(5)/+8(4)/0 | +4 | +10 |

**Deliberately cheaper and weaker than Vehicle's own Autocannon** (+80/1.5/+2 Piercing/+5 Damage here vs.
Vehicle's +100/2.0/+5/+10) — consistent with the platform-specific-modules architecture confirmed for Tank:
an aircraft-mounted gun system is a genuinely different weapon in practice from a vehicle turret, not a
relabeled copy. **AGM is the only module here carrying real parenthetical values**, making it the sole Light
Aircraft weapon eligible for the Deep Strike/long-range-fires role — Autocannon and PGM are CAS-only, no
standoff capability at all.

**Engine Module (requires exactly 1)**
| Module | Cost | Supply | Speed | Naming |
|---|---|---|---|---|
| Turbofan Engine | +80 | +2.5 | 0(0) | No effect |

Zero net speed effect, consistent with every other platform's baseline engine (Diesel on Vehicle/Artillery) —
the cost of a functioning platform, not a paid-for bonus. Irrelevant here anyway given Speed goes unused for
aircraft, but included for schema consistency across platforms.

**Misc Modules (optional, up to 2)**
| Module | Cost | Supply | Combat Vector | Other | Naming |
|---|---|---|---|---|---|
| Targeting Pod | +10 | +0.1 | +2/+2/+2/0 | — | Adds "(Targeting Pod)" |
| Surface Search Radar | +20 | +0.2 | +2/+2/+2/0 | **ISR: +1** | Adds "(SAR)" |

**Surface Search Radar's "ISR" label is correct despite the module's own name containing "Radar" — worth
being explicit about, since it's the mirror image of a mislabel caught on Vehicle earlier.** The established
terminology (§8.1.1's terminology unification, GDD v2.4) is functional, not literal: **ISR** is the
air-to-ground/ground-support concept, **Radar** is the air-to-air concept — regardless of what a module
happens to be called in-world. Surface Search Radar *searches for surface targets*, which is functionally
ISR even though "Radar" appears in its name; Vehicle's own "Radar I" module was air-to-air despite not having
"ISR" anywhere in its name. Same underlying rule, correctly applied in both (opposite) directions.

**Deferred to future epochs, noted for continuity:** two further module types are planned — a **Fire Control
Computer**, an air-to-air-flavored counterpart to Targeting Pod tailored for integrating radar with air-to-air
missile firing solutions, and an **integrated sensor/fusion package**, pricier but usable in both domains,
intended for genuine Multirole builds once AAMs exist. Neither is needed until Air Superiority/Multirole
Fighter builds become reachable.

**A forward-looking note on value efficiency, not a mechanic to build now:** once AAMs and air-flavored
support modules exist, a primarily-anti-ground-loadout aircraft (Autocannon/AGM) carrying air-flavored
support modules would have a small, genuine chance at an opportunistic air-to-air kill — a real possible
outcome once integrated sensor packages exist, even though it wouldn't be resource-efficient compared to a
dedicated AAM loadout. Not modeled by anything in this epoch's module set (Targeting Pod and Surface Search
Radar are both ground-facing, contributing nothing to the AA column) — purely context for later design.

### 3.6 Combat Vectors — fully resolved this session, a genuinely new architecture

**Two-layer RPS system, confirmed:** a **primary, platform-category vector** (the layer resolved below)
handles the bulk of rock-paper-scissors matchups; the **already-built weapon-type RPS** (Lasers vs.
conventional missiles, Plasma-Sheathed Hypersonics specifically countering Lasers, §10.2.2) sits as a
**narrower overlay on top**, only for the handful of exotic top-tier systems explicitly designed with their
own special counter-relationship. Two identically-categorized platforms (say, two Tanks) can still resolve
differently against each other if one carries an overlay-tier weapon the other doesn't — the coarse category
match doesn't override the exotic-weapon layer, it just handles everything the exotic layer doesn't need to.

**Primary vector categories, this epoch's land-only scope:** Infantry (includes FPV Drone Teams, Robot Dogs,
Humanoid Robots), Vehicle, Tank (includes Robot Crab), Anti-Air (short-range/long-range split, resolved
below, renamed from an earlier "Small-unit AA" once the column grew to cover the full anti-air spectrum).
**Explicitly seed data, not a final
list** — naval, air-superiority, and other strategic categories will extend this vector as later epochs add
platforms; every category not yet built simply reads zero for Infantry today.

**Module-additive architecture, confirmed as the general pattern going forward, not an Infantry-specific
choice:** rather than hand-authoring each Equipment type's full vector independently, **each module
contributes its own fixed additive values**, and an Equipment type's total vector is simply the sum of its
equipped modules' contributions. This is deliberately structured to extend cleanly into the Tech epoch —
a tech unlock upgrades a *module's* tier (Small Arms I → II → III), and every Equipment type using that
module inherits the improvement automatically, rather than needing every derived Equipment type re-authored
by hand.

**Confirmed Tier-I module values** (Infantry / Vehicle / Tank / Anti-Air):
- **Small Arms I:** +5 / +3 / 0 / 0
- **AT Module I:** +1 / +5 / +5 / 0
- **AA Module I:** 0 / 0 / 0 / +5

**A real design correction surfaced by this decomposition, worth having on record:** the AT module's Vehicle
value was originally going to be implied at +2 (derived from the old Equipment-type-level numbers), with Tank
at +5 — an anti-tank weapon being *less* effective against a more lightly armored target than against the
tank it's actually built to defeat. Corrected to +5/+5, matching the real-world logic that a weapon capable
of penetrating tank armor is at least as effective against a softer vehicle target, not less.

**Derived Infantry Equipment-type vectors, recomputed and verified against the original numbers — everything
matches except the deliberately corrected Vehicle values:**

| Type | Composition | Infantry | Vehicle | Tank | AA |
|---|---|---|---|---|---|
| Light Infantry | Small Arms | 5 | 3 | 0 | 0 |
| AT Infantry | Small Arms + AT | 6 | **8** | 5 | 0 |
| AA Infantry | Small Arms + AA | 5 | 3 | 0 | 5 |
| Heavy Infantry | Small Arms + AT + AA | 6 | **8** | 5 | 5 |

**Tier II/III module progressions are explicitly illustrative only, not locked** — matching the placeholder
treatment already given to every other tiered weapon system (Rail Guns, Lasers, Hypersonics) pending real
Tech-epoch balancing.

**Defense uses the identical vectors as attack, with a Defensibility-based multiplier applied on the defense
side specifically** — a region's Defensibility value (§1.4 of the Epoch 1 doc) scales the defending vector,
never applied to the attacking side. **The input side was already resolved in Epoch 1** — Region
Defensibility's own formula (10 base + 10/terrain trait + 5/Fortification level) needed no new work.
**The conversion curve itself, resolved this session — genuinely simple, not a curve at all:**
`multiplier = 1 + (Defensibility / 100)` — equivalent to reading the Defensibility value directly as a
percentage bonus. Worked examples: Defensibility 10 (unmodified baseline region) → ×1.10; Defensibility 80
(C Land, §1.6 of the Epoch 1 doc — 30 from base+terrain traits, +50 from 10 maxed Fortification levels) →
×1.80, matching the number already on record for that region exactly. **Never needs its own cap** — since
both Fortification (capped at level 10) and the terrain-trait set are already bounded inputs, the resulting
multiplier is naturally bounded too, with no separate ceiling required.

**Organization — resolved this session, closing a real architecture question flagged a few sessions back
(does each platform contribute a baseline amount to TF Organization, or is it computed some other way?):**
**each Infantry unit contributes 25 Organization, summed additively across every unit in a Task Force** to
produce the TF total. Deliberately generous relative to Infantry's low cost — cheap, disposable staying
power is meant to be Infantry's actual value proposition, keeping it a genuine Task Force choice even once a
faction can afford high-end platforms like aircraft and advanced tanks.

**Armor and Piercing remain a genuinely separate mechanic layered on top of these base vectors, confirmed —
not folded into the primary category vector itself.** These base numbers are pre-piercing; the existing
piercing-vs-armor curve (§8.6 of the GDD, v2.8) applies afterward as a multiplier on damage. **Values for
Infantry, now resolved rather than tentative:** **Armor = 0** — meaning Infantry itself always triggers the
guard clause (§5.4 below) and takes 100% damage, the piercing formula never actually running against it.
**Piercing = 0 baseline, 5 with the AT Module equipped** — against a real armored target, 0 Piercing lands at
the formula's 20% floor, 5 Piercing meaningfully climbs the curve toward the 80% ceiling depending on the
target's own Armor value. Higher AT Module tech tiers presumably raise this further, matching the same
module-additive, tier-scaling pattern already established for the primary combat vectors above.

**Still open:** the Piercing/Armor curve's actual function connecting a specific Piercing value to a real
effectiveness percentage — remains on the Tier 1 list (§5 below). The Defensibility-to-multiplier conversion
is now fully resolved (above), no longer an open item.

**Forward-looking note, not resolved now:** the same granularity concern that shrank Infantry from 500→50
personnel likely applies to expensive, low-count platforms later — tanks and aircraft may need sub-unit
groupings (e.g. 4-vehicle elements, single aircraft) rather than whole battalions/squadrons, so that losing
one physical vehicle doesn't wipe out a unit's entire combat contribution. Flagged for when those platforms
are actually designed, not addressed here.

### 3.7 The Production Pipeline for Equipment and Manpower — fully resolved, a genuinely asymmetric system

**Core distinction, and the reasoning behind it, not just the rule:** Manpower is fungible at the pool level
— accumulated Manpower isn't committed to any unit type until the moment it's drawn to fill something, so
there's no reason to prioritize during *generation*. Equipment is type-committed the instant it's
manufactured — Small Arms plus an AT module becomes "AT Infantry Equipment" permanently, it can never be
repurposed into a different SKU — so the priority decision has to happen *before* manufacturing, not after.
This is why the two pipelines apply the same priority mechanic at genuinely different points:

- **Manpower pipeline:** the existing top-level Equipment/Manpower/Construction focus split (§4.3 of the
  Epoch 1 doc) sends a straight, undifferentiated amount into the Manpower pool — no unit-type awareness at
  this stage at all. **The priority system (§3.8 below) applies only at drawdown** — when the game fills
  under-strength units from the accumulated pool.
- **Equipment pipeline:** the top-level split allocates Production to the "Equipment" category as before, but
  **the priority system applies immediately, before any Production becomes a specific manufactured SKU** —
  it decides *what gets built*. Only after manufacturing does the finished Equipment flow to a demanding Task
  Force, or accumulate in the stockpile if no Task Force currently needs it.

Construction is unaffected by any of this — still governed entirely by Epoch 1's existing 4-concurrent-
project system, no interaction with the priority mechanic below.

### 3.8 The Priority Waterfall — fully resolved, applies to both Equipment manufacturing and Manpower drawdown

**Per-unit priority, set in the Task Force Editor:** a cycleable control shown as chevrons, alongside the
existing +/− controls for desired unit count. **Normal priority is the default (2 chevrons).** Clicking
cycles Normal → High (3 chevrons) → Low (1 chevron) → back to Normal.

**The waterfall itself, confirmed with exact percentages:**
- **High priority: up to 60%** of the relevant Production (Equipment-manufacturing allocation, or Manpower
  pool drawdown) splits proportionally among all high-priority unit-types currently below target strength.
- **Within-tier recycling, confirmed:** if any unit reaches full target strength using less than its
  proportional share, the leftover is recycled and redistributed among the *remaining* under-strength units
  in that same tier — repeated iteratively until either everyone in the tier is filled, or the tier's entire
  allocation is exhausted. **"Exhausted" needs a concrete implementation guard, flagged following external
  review:** a naive floating-point implementation could leave an infinitesimal, never-quite-zero remainder
  each pass and loop excessively. Resolve by tracking Production allocation in integer units (the cleanest
  fix, sidesteps the issue structurally) or, if fractional tracking is unavoidable, an explicit epsilon
  threshold below which the remainder counts as exhausted — not a literal floating-point zero comparison.
- **Waterfall to the next tier, confirmed:** only once the high-priority tier is fully resolved (everyone
  filled, or the money's gone) does anything move to normal-priority — **30% plus whatever high-priority
  didn't need** — with the same within-tier recycling applied there before anything waterfalls further to
  low-priority (**10% plus whatever waterfalled down from above**).
- **This exact mechanism runs twice, independently** — once governing which Equipment SKUs get manufactured
  each Pulse, and separately governing which units draw from the accumulated Manpower pool. Same algorithm,
  two different targets.

### 3.9 Stockpile Accumulation — fully resolved, including the cap values

**Once every Task Force is at full target strength** for a given Equipment type, any further Production
allocated to Equipment manufacturing (still following the same 60/30/10 priority split, now applied across
Equipment *types* rather than TF demand) accumulates in the faction's Equipment stockpile, up to a cap.

**Stockpile cap, resolved this session (previously referenced only as an unconfirmed placeholder — no
prior document actually specified a number):**
- **3× total Task Force demand, as the general baseline.**
- **2× specifically for Naval Units and Airships** — a deliberate exception, reflecting that a realistically
  mobilized military wouldn't hold deep reserves of expensive, less-mobile platform types the way it would
  for cheap mass equipment.

**Worked proportionality example, confirmed:** a Task Force with 5 Light Infantry Units (250 Production-
equivalent total) and 1 Heavy Infantry Unit (70 Production-equivalent), all normal-priority, all already at
target strength — any further Equipment-manufacturing Production splits 250/320 toward Light's stockpile and
70/320 toward Heavy's. **Once either type hits its cap, the proportional split recomputes** — the other type
then receives 100% of further leftover, not just its original share. This is the same proportional-
redistribution-among-active-recipients principle already established for Epoch 1's top-level Equipment/
Manpower/Construction overflow (§4.3 of that doc), just applied one level down — consistent architecture,
not a new pattern invented here.

**Once every Equipment type is at its cap**, further Equipment-focus Production reroutes to Manpower and/or
Construction, following the same overflow logic already established in Epoch 1.

**Confirmed this session: the cap governs new *production* toward the stockpile, not a hard ceiling on the
stockpile's actual quantity — it's entirely valid for the real number to sit above it, with no cleanup or
special handling required.** Two legitimate ways this happens: **capture** (converting a large enemy
equipment cache at once, per §3.11 below, can easily exceed a small Task Force's current demand-based cap),
and **reducing a Task Force's desired unit count** after the fact (lowering demand also lowers the cap
retroactively, but doesn't shrink whatever's already stockpiled). **The only real consequence of exceeding
the cap is that no further production of that type happens until demand rises enough to need it again** —
e.g. `Light Infantry Equipment 10/10, Stockpile 83/30` is a perfectly valid, stable state, not an error or
edge case requiring resolution.

### 3.10 Task Force Sourcing & Partial Fill — fully resolved

- **Equipment is strictly binary per unit slot** — no partial equipping, a unit either has its full Equipment
  set or it doesn't. This is the direct reason Infantry's scale was revised down (§3.1) — at battalion scale,
  waiting on a single indivisible 500-Production purchase felt wrong against Manpower's fine-grained
  accumulation.
- **Manpower supports smooth linear partial-fill.** A unit can be built at any fraction of its Manpower
  requirement, operating at that same fraction of its nominal combat stats — e.g. 25 of 50 required Manpower
  fills a unit to 50% effectiveness.
- **When assigning units to a Task Force, the game attempts to source every requested unit type
  independently** — if some types have their Equipment built and Manpower available while others don't, the
  Task Force forms with whichever types are currently satisfiable, and the remainder fills in later as
  Production allows, rather than blocking the whole Task Force on its least-ready component.

### 3.11 Named Custom Equipment & Captured-Stockpile Conversion — fully resolved

- **User-editable custom names for complex platforms** — ships, aircraft, and tanks will have many more
  module combinations than Infantry's four fixed types, so the Unit Editor needs a player-assigned name per
  design (e.g. "Ford Class Carrier," "Type 100 MBT," "F/A-71 Hunter Killer UCAV"), tracked as a genuinely
  long, growing list of distinct Equipment SKUs as the game progresses — not just four hardcoded infantry
  variants.
- **Captured-stockpile conversion, resolved:** when a faction captures enemy Equipment (§8.6.6's existing
  "victor gains a % of the loser's equipment" rule), the captured items are converted rather than added to
  the capturing faction's roster as a permanently untouchable foreign SKU. **Match at the broad platform-
  category level** (e.g. "aircraft" generally, not exact role-matching) — converting an AWACS-equivalent
  into your own bomber design is acceptable weirdness within a domain; **the thing actually being prevented
  is cross-domain conversion** (infantry equipment becoming an airship). **Conversion is on a Production-cost
  basis** — sell the captured item's value, buy as many of your own closest-matching design as that value
  covers. Avoids a permanently bloated, mostly-unusable stockpile of every enemy faction's custom-named
  designs.

---

## 4. Component: Movement, Distance & Transit Combat — fully resolved this session

*Genuinely new territory — nothing in the GDD covers inter-region distance, pathing, or how transit
interacts with combat. Everything below was worked out fresh this session, land-only (no embarkation/
debarkation yet).*

### 4.1 Distance Geometry — RESOLVED

**Land-to-land, every adjacent pair: a flat 300 miles**, a rough real-map-scale estimate for the dummy map
specifically (the real map will use precise midpoint-to-midpoint distances once built).

**Maritime distances, confirmed by symmetry across all four maritime regions** (each has identical
connectivity: one corner-land neighbor, two edge-middle-land neighbors, two other-maritime neighbors):

| From Maritime Region | 300 mi | 400 mi (×2) | 500 mi (×2) |
|---|---|---|---|
| NW Maritime | NW Land | N Land, W Land | NE Maritime, SW Maritime |
| NE Maritime | NE Land | N Land, E Land | NW Maritime, SE Maritime |
| SW Maritime | SW Land | W Land, S Land | NW Maritime, SE Maritime |
| SE Maritime | SE Land | E Land, S Land | NE Maritime, SW Maritime |

### 4.2 Pathing — RESOLVED

- **Single-leg movement:** clicking a destination region draws an arrow from origin midpoint to destination
  midpoint. Not committed until time actually advances — the player can freely reselect before then.
- **Multi-leg movement:** the game defaults to the shortest-distance uncontested path, arrow passing through
  each intermediate region's center point. **Player override, confirmed:** shift-click through a sequence of
  specific regions to manually construct a path that discards the computer-calculated route — e.g.
  deliberately routing through and securing regions the default path would have bypassed.
- **Progress representation:** as a Task Force advances, reaching each intermediate region's center point
  updates its map position there and the trailing portion of the arrow is removed.

### 4.3 Occupancy States — RESOLVED, refined this session with a real exception

**Uncontested/permissive movement:** a Task Force is fully considered "in" its origin region — for all
defense, suppression, and every other purpose — for the *entire* duration of transit, switching to fully "in"
the destination only at the instant of arrival. A hard binary flip, never partial or blended, matching the
general "only occupying one region at a time" rule.

**Contested invasion is a genuine exception to that general rule, confirmed this session — a Task Force can
be dual-present, actively responsible for both ends simultaneously, for as long as both invasion clocks
(§4.5) remain unresolved.** This isn't a contradiction of §4.3's general rule, it's the specific case where
active combat overrides it.

### 4.4 Redirect Cost — RESOLVED

**Changing a Task Force's destination mid-transit is costly, not free.** The TF must first travel *backward*,
at Combat Speed, to the region it currently occupies before progress toward the new destination can begin —
reflecting the real cost of uprooting logistics and reorganizing a deployment. **For a multi-leg journey, the
reset point is the region currently occupied, never the original starting point** — only the most recent leg
resets, not the whole journey.

### 4.5 Speed — RESOLVED

**Notation, matching the established Production(Supply) convention: Combat(Transit), e.g. `5(30) mph`.**

- **Combat Speed: 5 mph.** The default land-movement rate — infantry advancing on foot, alternating between
  active engagement, being stopped entirely, and riding whatever transport is available, averaged out.
- **Transit Speed: 30 mph.** The rate through permissive territory — organic vehicles, commandeered
  transport, and Task-Force-organized rail/truck/bus logistics, none of which require fighting for the road.
- **Which speed applies is determined per-leg, by the permissiveness of the region being *entered* —
  confirmed this session, resolves what was flagged as the one genuinely open question:**
  - **Hostile Control (even with no defending TF physically present) → Combat Speed.** Securing towns,
    bypassing or cutting off resistance, overrunning border checkpoints, seizing infrastructure — you can't
    simply drive the highway through territory you don't control, regardless of whether anyone's shooting at
    you specifically.
  - **Friendly or otherwise permissive territory → Transit Speed.** Road and rail networks, airfields, and
    the rest are actually available to you.
  - **A single multi-leg journey can genuinely mix both rates** across different legs, resolved per-region as
    the TF advances.
- **TF speed is set by the slowest included component, as established in the GDD (§8.3) — but only among
  ground and naval elements.** **Aircraft never enter this calculation at all**, not merely because they're
  fast enough to never bind — they structurally can't independently hold ground or occupy a region, so
  they're excluded from the speed calculation entirely, not just unlikely to be the limiting factor.
- **Ground elements embarked on a naval Task Force drop out of the speed calculation while at sea** — the
  naval elements alone govern TF speed in that state, the direct extension of the existing "embarked ground
  forces are cargo" rule from naval embarkation (§8.1.1).

### 4.6 Transit Combat — RESOLVED, the most significant mechanic this session

**Moving a Task Force into a hostile, TF-occupied region starts two independent, parallel clocks the moment
the order is accepted and time begins advancing** — a **transit clock** (distance ÷ Combat Speed) and a
**combat-resolution clock** (however long the fight actually takes). **This is not a sequential "resolve
combat, then move" process** — both run concurrently from the same starting moment, matching HOI4's approach
to the same problem.

**Actual repositioning to the destination region happens only once *both* clocks have completed and the
attacker has won** — whichever clock is the binding constraint determines the real timeline:
- **Combat resolves faster than transit:** the enemy TF is defeated well before the full transit time has
  elapsed, but the attacker still isn't considered to have arrived and secured the region until the transit
  clock itself finishes.
- **Combat outlasts transit:** the attacker reaches the destination's midpoint on schedule but doesn't
  control the region — the fight continues for however much longer it takes, with occupation/Control landing
  only once the defending TF is actually defeated.

**The origin region remains fully defended for the entire overlapping duration of both clocks, confirmed
this session — not released the moment transit alone completes.** A Task Force mid-invasion is genuinely
"strung out across both regions," still responsible for defending its point of departure (supply lines, rear
security) until combat concludes *and* transit time has finished, whichever is later.

**Real penalties exist for this overlapping state, flagged as real but not yet quantified:** being attacked
while attacking, and being attacked from multiple directions simultaneously, both carry combat penalties —
deferred to a future numeric pass, not resolved this session.

**Retreat, if the attacking Task Force is defeated at any point before both clocks complete:** the TF falls
back to whatever region it currently occupies (its original origin, if never redirected; wherever a prior
redirect reset it to otherwise). **The distance owed on that retreat is tied specifically to the transit
clock's progress at the moment of defeat, not the combat clock** — e.g. a TF defeated when its transit clock
was 50% complete retreats 50% of the distance, at Combat Speed, regardless of how far along the combat clock
happened to be.

**Voluntary retreat, confirmed as a genuine, distinct strategic option — not limited to the defeat case
above.** An attacker can call off an invasion at *any* point, not only when actually defeated: combat ends
immediately on that order, and the same transit-clock-progress-based partial retreat applies exactly as in
the defeat case. **This opens a real, named strategic pattern this session: probe-and-bail** — attack only
for as long as Shock (GDD §8.6.2, v2.8) lasts, or gamble on knocking the enemy off some of their
Deep-Strike/CAS lines to seize Air Superiority (§1.3), and voluntarily withdraw if that gamble isn't paying
off, rather than committing to a fight to the finish. **The defender is never passive in this exchange —
confirmed they can respond by counter-invading in turn**, and this is the exact same mechanical payoff
already established for the Spring-a-Trap counterattack stance (GDD §8.6.2, v2.8): a defender who never
attacked stays in the Ready state, so the precise moment an attacker's probe culminates and withdraws is
when the defender can counter-invade with a fresh Shock bonus of their own. Three previously-separate
mechanics — voluntary retreat, Shock's Planning/Ready cycle, and the counterattack stances — now confirmed
to compose into one coherent strategic exchange, not three independent systems that happen to sit near each
other.

---

## 5. Component: Task Force Combat Resolution

*SOURCE: GDD §8.6 (all subsections), §8.6.6 specifically for Organization/robots/retreat — structurally
resolved, numerically incomplete going in. Several genuinely new mechanics resolved this session, captured
below; remaining Tier 1 gaps carried from the implementation-side Claude's original handoff follow in §5.4.*

### 5.1 Front-Line Combat Resolution — fully resolved this session

**Task Force role structure, capacities confirmed, role-specific mechanics beyond Front Line deferred to a
later session:** Deep Strike/Air Superiority (up to 12 units), CAS (up to 6), Front Line (up to 12),
Reserves (unlimited). Only Front-Line-vs-Front-Line resolution is worked out below — Deep Strike, Air
Superiority, and CAS's actual mechanics are explicitly not yet covered.

**Face-off structure:** each side's Front Line pairs 1:1 across up to 12 slots. A unit lacking the
appropriate vector value for a given role/matchup simply can't be assigned there (Infantry, having no
long-range weapon, can't fill a long-range-fires slot).

**The roll, confirmed d20-style:**
- **Baseline: 5% chance of a successful engagement for either side**, provided that side has *any* nonzero
  value in the relevant matchup vector against its opponent.
- **A side with zero relevant vector value against its specific opponent has zero chance of scoring a hit in
  that pairing** — not just a low baseline, a hard exclusion from that side of the roll. The opposing side's
  own roll against them still proceeds normally using its own vector value, though.
- **Advantage is the raw point difference between the two sides' relevant vectors, added directly to the
  advantaged side's percentage** — confirmed via worked example: attacker 5 vs. defender 10.8 (heavy
  infantry, fortified region) → defender's advantage is +5.8 → attacker 5%, defender 10.8%, remainder 84.2%
  push (no engagement that tick). **Caveat worth flagging, not urgent:** this formula has a ceiling around a
  ~90-point advantage gap, past which the three percentages would stop summing to 100% — nothing currently
  in play approaches that, but worth remembering once large tech gaps enter later.
- **Flanking:** a front-line unit with no paired opponent (because the opposing front line couldn't fill
  every slot) gets an unopposed roll against the nearest enemy front-line unit — baseline 5% only, no
  advantage math, since there's no opposing vector to compare against.

**Hit collection and target resolution, confirmed:**
- Every successful engagement across the whole front line is collected per side, **each tagged with a
  (damage, piercing) pair from the unit that scored it, not damage alone — resolved this session, a real
  necessity rather than an optional addition.** The target (and its Armor value) isn't determined until the
  production-weighted draw happens *after* engagements resolve, so Piercing has to travel with its damage
  from the moment of the hit — there's no other point where it could be attached.
- **Targets are drawn from the *opposing* side's full front-line roster, weighted by inverse Production
  cost** — confirmed this session as the actual function for §8.3.2's previously-unresolved weighting: each
  unit's selection probability is `(1/its own cost) ÷ (sum of 1/cost across the whole pool)`, which both
  makes a 50-cost unit twice as likely to be drawn as a 100-cost one and guarantees the whole pool sums to
  100% automatically, by construction. **This is genuinely correct terminology — inverse-proportional
  weighting** — and it directly resolves what was an open Tier 1 item (§5.4 below marks it closed).
  **Cost basis, resolved following external review: snapshot current unit-type Production costs once, at
  the start of that battle's resolution, and use those frozen values for targeting math for the duration of
  that one battle only — never attach a snapshotted cost permanently to an individual unit instance.** This
  prevents a tech completing mid-battle from skewing targeting weights inconsistently partway through a
  single resolution, without sacrificing unit fungibility afterward — two identical Light Infantry units
  built at different points in the game should remain fully interchangeable once combat ends, not carry
  divergent frozen costs forever. **Deliberately different from the combat log's own cost-valuation rule**
  (§6) — that's an always-current, post-hoc *display* choice by design; this is a *gameplay* consistency
  rule scoped to a single battle. The two don't conflict, they solve different problems.
- **Per-hit survival check, revised after playtesting-motivated reflection — the original hard-capped formula
  produced unrealistically steep casualty rates:** `destruction probability = damage / (damage + health)`.
  **The `damage` value here is post-Armor/Piercing** (§8.6 of the GDD, v2.8) — the raw damage captured at
  hit-time gets run through the piercing multiplier once the target's Armor is known, *then* the result feeds
  this formula, not the other way around. Verified against both worked examples: 5 damage vs. 10 health →
  5/15 = 33.3%; 15 damage vs. 10 health →
  15/25 = 60%. **A genuinely different shape from the original formula, not just a softer version of it** —
  the old version had a hard 100% cap once damage reached health; this one approaches 100% asymptotically but
  mathematically never reaches it for any finite damage value, so no hit can ever guarantee a kill. Zero
  damage still correctly gives exactly 0% destruction chance. Exact values may need further tuning once
  actual playtesting happens, per Eric's own framing — the formula's *shape* is what's resolved here, not a
  final claim that 33%/60% are the last word on these two specific examples.
- **On a failed survival roll (destroyed):** the unit's Manpower is lost as casualties (partially
  recoverable to Population via medical tech), its Equipment is lost and must be replenished post-combat, and
  it's permanently gone for the rest of this engagement — cannot reinforce. Its full Organization contribution
  is removed from the Task Force's total, permanently.
- **On a successful survival roll (retreats):** the unit is pushed off the front line into the Task Force's
  general Reserves pool — the same pool ordinary reserve units already sit in, not a separate priority
  queue — eligible for the standard reinforcement roll (33% baseline per empty front-line slot per tick,
  above) like any other reserve unit, mixed anonymously in with everyone else there (no guarantee it's the
  one randomly pulled back up). **Confirmed this session: a single unit can cycle through the front line
  multiple times over the course of one battle** — pushed off, survives, sits in reserves, potentially
  reinforced back up later, survives another round, and so on — not a one-shot "fought once, done" model.
  **Its Organization contribution is
  still removed from the Task Force's total** — confirmed deliberate, not a duplicate statement of the
  destroyed case: this is what allows a Task Force to be fought to a forced retreat purely through
  accumulated hit-count, without necessarily losing many (or any) actual units. The distinction between the
  two outcomes is entirely about whether the *unit* survives, not whether the *Organization cost* is paid —
  that cost lands identically either way.

**Reinforcement:** each tick, every empty front-line slot gets a roll to pull a random unit up from Reserves
to fill it, if any are available — **baseline 33%, modifiable by technology or an Agent assigned to the Task
Force** (deferred specifics).

**Task Force loss conditions, confirmed as three independent triggers:** Organization hits zero, **or** every
unit is destroyed, **or** the front line is fully vacated with nothing left in Reserves to reinforce it.

**Robots and Organization — resolved precisely, grounded in GDD §8.6.6 directly (found verbatim, not just
reconstructed from conversation):**
- **Robots carry ~infinite Organization and never trigger the Org-zero retreat condition themselves** — "they
  fight to total destruction," making an automated force categorically different in kind (annihilation-only,
  not break-and-retreat).
- **In a mixed Task Force, once the *human* portion's Organization hits zero, the player faces an explicit
  choice, not an automatic default:** flee with the whole Task Force (voluntarily withdrawing the robots too,
  even though they'd be capable of continuing to fight alone), **or** leave the robots as a last stand.
- **"Leave as a last stand" is a genuine Task Force split, not robots simply continuing to fight within the
  same structure:** it produces two independent Task Forces — a retreating manned TF (the manpower-crewed
  blocks) and a separate autonomous-only remnant that fights to destruction. **The remnant can still win the
  engagement outright** (if the attacker's own Organization also breaks first) **and holds the region on its
  own**, entirely independent of what happened to the manned TF that already withdrew. **Naming and
  commandability, resolved following external review:** the split remnant takes the original Task Force's
  name with an auto-generated "Autonomous Remnant" suffix (e.g. "3rd Armored Autonomous Remnant"). **The
  remnant remains fully commandable and retreatable** — a genuine correction to an external reviewer's
  suggested "uncommandable/non-retreatable" flag, which isn't what this mechanic does: the player's Last
  Stand choice is about not retreating the robots *at that specific moment*, not permanently surrendering
  control of them afterward. Not load-bearing this epoch (no platform yet has genuinely unlimited
  Organization), but worth capturing the intended future behavior now rather than guessing at it later.
- **Individual robots remain fully subject to the ordinary per-unit Health/Damage survival check**,
  completely independent of the Organization mechanic — a Robot Crab can absolutely still be pushed off the
  front line by a successful hit it survives, exactly like a manned unit. What robots are exempt from is only
  the *Organization-driven whole-TF retreat trigger*, not combat resolution generally. A robot-heavy force can
  still be ground down and forced off the line by sheer volume of engagement attempts, even while taking zero
  actual losses — a real, distinct attrition path against an otherwise hard-to-kill opponent.

**Organization regeneration, confirmed more nuanced than a simple in-combat/out-of-combat binary:** regen
out of contact is capped by the same Region-Supply-vs-TF-Supply-consumption ratio established in §8.7/Epoch
1's Supply Consumption work — not an unconditional full recovery. **A logistically demanding Task Force
stranded in a low-Supply region can plateau below full Organization even after combat ends**, while a lean
force in a well-supplied region recovers fully even cut off. Concrete consequence: a Task Force in a poor
supply state can be forced to retreat after relatively few units are pushed off the front line, since its
effective regen ceiling — not just its raw starting Organization — determines how much combat it can actually
absorb.

**Retreat and surrender, confirmed consistent with an already-established system:** a Task Force surrounded
entirely by hostile-controlled regions surrenders outright, with **no defending enemy Task Force required** —
controlling the ring, not physically blocking with units, is what completes the encirclement. This is the
exact same underlying principle as the land-blockade-by-hostility rule already built for domain control
(§1.1 above) — hostile political Control alone is sufficient, military presence isn't the gating factor —
just applied here to a defeated force's escape routes instead of trade routes.

### 5.2 Deep Strike & Air Superiority — fully resolved this session

**The meta-game goal, stated explicitly:** balancing defensive (air superiority) vs. offensive (long-range
strike) investment within one 12-unit role, with multirole platforms as the deliberate swing option — strong
in both, dominant in neither. All-strike is vulnerable to losing air cover; all-air-superiority risks leaving
units unpaired and structurally wasted; all-multirole is flexible but loses cleanly to a specialized
air-superiority counter-build.

**Pairing algorithm, confirmed as the actual procedure, not just the illustrative worked example:**
1. Sort both sides' full roster by anti-air capability, descending.
2. Pair 1:1 straight down both sorted lists until one side runs out.
3. **A SEAD reordering pass on top of that base pairing:** if a pure air-defense asset would otherwise face
   an opponent with no ground-attack capability (or no opponent at all), the algorithm reshuffles so air-
   defense assets specifically face anti-ground-capable opponents where possible — representing an actual
   SEAD mission, not a leftover mismatch.
4. Whatever remains unpaired by air-superiority/SEAD logic — the pure long-range-strike assets — pair off
   against each other in a counter-battery duel, resolved by the same vector system as front-line combat.
5. **Any unit still unpaired due to a straight roster-size mismatch gets an unopposed roll against a random
   target drawn from the enemy's Front Line *or* Reserves** — not Front Line only — reflecting genuine
   deep-strike reach, restricted to target types the striking unit actually has a nonzero vector against.
6. **Recomputed every tick, not fixed once at engagement start** — as units are knocked out, the remaining
   roster on both sides re-sorts and re-pairs fresh each tick, the same principle already established for
   Front Line's reinforcement cycle.

**A pure air-defense asset with no valid pairing (§5.2, item 3's leftover case) sits idle that tick** — not
contributing, but positioned to intercept CAS aircraft in the next combat phase if any appear. If none do,
that tick's capacity is simply wasted, the direct mechanical cost of over-investing in air defense.

**Two genuinely distinct resolution shapes, confirmed as different mechanics, not the same roll applied
twice:**
- **Symmetric duels** (air-superiority-vs-air-superiority, or strike-vs-strike counter-battery) — an
  ordinary vector-vs-vector roll, identical in shape to front-line combat (§5.1) — **including the same
  (damage, piercing) pair capture and post-Armor/Piercing survival check (§5.1), universal across every
  combat context in this system, resolved this session.**
- **The SCUD-hunt** (a flexible/multirole asset paired against a pure long-range-strike asset) is
  asymmetric — the two sides are never actually trading fire with each other directly. The strike asset is
  attempting its own attack against a separate, randomly chosen target elsewhere in the enemy Task Force; the
  multirole aircraft is attempting to intercept that attack before it happens. **If the roll favors the
  strike asset, its attack against that other random target goes through as normal. If the roll favors the
  multirole aircraft, it strikes the launcher instead** — the roll decides who gets to act, not a shared
  win/loss between the two paired units. **Whichever attack actually lands still carries its own piercing
  value the same way.**

**Reinforcement — resolved as a scoped extension of the existing Front Line mechanic, not a separate
system:** empty slots on this role can be refilled from Reserves exactly like Front Line, **restricted to
units carrying long-range-fires-capable modules specifically** (the notation below) — an ordinary Infantry unit
cannot be placed on this line regardless of Reserve availability.

**Advantage-roll cap revised from ~90 points to a firm 50, confirmed with the precise formula:**
`advantaged side % = min(50, 5 + point_gap)`, disadvantaged side stays at its own floor, push absorbs the
remainder. Worked check: a 1-vs-500 mismatch still resolves as 5% / 45% push / 50%, never lower than 45%
push regardless of how extreme the gap gets — equivalent to a hard 10× advantage cap. **Deliberate design
goal, not just a math cleanup:** keeps cheap-unit-spam a viable strategy at the per-tick level even against
extreme quality mismatches, opening up a genuine "eat heavy losses with mass" playstyle rather than making
overwhelming tech superiority a guaranteed instant win.

**Long-range-fires notation, resolved — reuses the existing Production(Supply) display convention, confirmed
as one consistent principle across every vector column, not a special case per column:** `X(Y)` — X is the
value at short/CAS range, Y (parenthetical) is the value at long/standoff range, for whichever domain that
column represents. **No parenthetical at all is a hard exclusion**, not a weak value — that module simply
cannot be assigned to the Deep Strike/Air Superiority line. Confirmed illustrative module costs: Air-Launched
Cruise Missile Module (10 Production) — 15(15)/15(15)/15(15)/0(0) against Infantry/Vehicle/Tank/Anti-Air;
Precision-Guided Munition Module (5 Production) — 20/20/20/0, CAS-only, no standoff capability at all.

**Plain-vs-parenthetical symmetry, resolved — confirmed genuinely asymmetric in general, not just a boolean
flag:** short- and long-range effectiveness can differ meaningfully by weapon type, not just by presence/
absence. Lasers are expected to be stronger at short range than long (parenthetical lower than plain);
hypersonics the reverse (parenthetical higher than plain) — though hypersonics specifically remain a later
capability, not resolved now. The ALCM example above happened to be symmetric, but that was one illustrative
case, not the general rule.

**Fourth vector column renamed Anti-Air (from an earlier "Small-unit AA"), resolved this session — the
same short/long-range principle applied to the air domain, not a new mechanism, and not actually two
categorically separate tiers as an earlier framing implied:** a value like `15(10)` in the Anti-Air slot
represents a SAM-type system (most plausibly built on the Vehicle platform for cost reasons, per TEL —
Transporter Erector Launcher — precedent, though also mountable on Tanks or Robot Crabs) that's strongest
against close-in CAS threats (**short-range**, the plain value) but still has genuine reach against
higher-altitude strike and air-superiority aircraft (**long-range**, the parenthetical value). No new column
needed for this — it falls directly out of the notation principle already established, and it's the exact
same short-range/long-range distinction the GDD's §8.6.8 already describes (terminology reconciled there
too, GDD v2.4) as "short-range anti-air" (CAS-countering only) vs. "long-range anti-air" (feeds the
air-superiority %, what the GDD used to separately call strategic/theater AD) — one column, not two
platform-based categories.

**Correction to an earlier claim in this document, resolved this session: aircraft-vs-aircraft engagement
does *not* need a new dedicated column after all — it reuses the same Anti-Air slot.** An air-to-air
missile module simply populates that same 4th vector position, making a fighter's anti-air value directly
comparable to a SAM's on the same number line — the F-22-vs-J-20 case resolves through the ordinary
vector-vs-vector system, no new architecture required. **Confirmed illustrative module values, matching the
established short/long-range notation:** Air-to-Air Missile Module I — 0/0/0/20(15); Air-to-Air Missile
Module II — 0/0/0/25(20). A fighter speccing purely into air superiority would equip only this module type
across its slots.

**Ships and other naval archetypes remain a wholly separate, unstarted set of columns** — the one piece of
the original archetype gap that's still genuinely untouched, distinct from air-to-air and ground-based air
defense, both now resolved via the existing four-column vector.

### 5.3 CAS — fully resolved this session

**Targeting, confirmed as distinct in shape from both Front Line and Deep Strike:** each CAS unit (up to 6
per side) pairs against a **random Front Line unit on the opposing Task Force** — not the enemy's own CAS
line, not a sorted/ranked pairing. CAS targets the ground battle directly.

**Defense is resolved independently per side, not as one combined pass:** each Task Force separately pools
together whatever air-defense-capable units it currently has available to intercept the *enemy's* CAS
run — **confirmed this session to include both genuine Reserve-pool units and any Deep Strike/Air
Superiority-line assets left over without a pairing that tick** (§5.2's "Patriot with nothing to pair
against" case, explicitly a real mechanic this session, not just flavor text). The pooled defenders are
sorted by anti-air vector value, same as everywhere else in this combat system.

**Real variance in outcome depending purely on what's actually available:** a CAS run can face a hard counter
(a dedicated fighter or SAM pulled into defense), a soft target (infantry with minimal AA), or a fully
unopposed roll if the defending Task Force has nothing air-defense-capable left at all.

**Resolution mechanics, identical in shape to every other combat roll in this system:** successful CAS rolls
apply the aircraft's damage to the targeted Front Line unit; successful defensive rolls apply damage to the
CAS aircraft itself. Same Health/Damage survival check, same Organization consequences, **same
(damage, piercing) pair capture and post-Armor/Piercing multiplier, as Front Line combat (§5.1)** — universal
across every combat resolution context in this system, not a Front-Line-specific mechanic.

**Reinforcement mirrors Deep Strike's mechanic exactly, restricted to anti-ground-capable aircraft
specifically:** helicopters, multirole aircraft, and dedicated CAS aircraft are valid; pure air-superiority
fighters are not, since they carry no anti-ground capability to contribute.

**Re-randomized every tick, confirmed consistent with Front Line and Deep Strike:** both the CAS-to-Front-
Line target pairing and the defensive pool itself re-run fresh each tick based on whatever units currently
remain and are available — not fixed once at engagement start.

### 5.4 Remaining Tier 1 Gaps

*Carried from the implementation-side Claude's original handoff, independently verified against the live
GDD. One item below is now resolved by §5.1 above.*

- [x] **Organization per-unit contribution, resolved (§3.6 above):** additive across a TF's constituent
  units — Infantry contributes 25 each. **Still open:** the resulting TF-total's actual max/starting
  behavior, drain-per-damage-taken rate, and the exact percentage of the loser's equipment the victor gains
  on a decisive battle (§8.6.6 currently just says "a %," no number).
- [x] **Shock bonus magnitude and availability, fully resolved (GDD §8.6.2, v2.8):** 24-tick duration,
  `Speed × 0.3` magnitude formula (applied identically to attack vector and damage), a Planning/Ready state
  machine replacing the old flat cooldown (invasion combat → Planning; one full clean Pulse with zero
  invasion combat clears it; long-range fires never trigger or block clearing; only the attacker enters
  Planning, never a pure defender), and confirmed multiplicative tech-modifier architecture (exact values
  deferred to the Tech epoch). A real emergent payoff: this gives the existing Spring-a-Trap counterattack
  stance actual mechanical teeth, since a never-attacked defender stays Ready and can counter-invade with
  fresh Shock the moment an attacker's own Shock culminates.
- [x] **Piercing vs. armor curve, fully resolved (GDD §8.6, v2.8):** `damage multiplier = 20% + 60% ×
  min(1, Piercing ÷ Armor)`, floor 20% at zero Piercing (corrected from an earlier "~10%" estimate), ceiling
  80% once Piercing meets or exceeds Armor. **Guard clause: if the target's Armor is exactly 0 — the common
  case, not rare, given most current platforms including Infantry have zero Armor — the calculation is
  skipped entirely and 100% of damage applies.** Sits as a multiplier on damage feeding into the existing
  destruction formula (§5.1), not a separate mechanic. Infantry's own preliminary Piercing values (§3.6
  above) are no longer tentative — this is the curve they were waiting on. **Confirmed universal this
  session — applies identically across Front Line, Deep Strike/Air Superiority, and CAS (§5.1–5.3), not a
  ground-combat-only mechanic.** Every successful engagement now captures a (damage, piercing) pair rather
  than damage alone, since the target — and therefore its Armor value — isn't known until the
  production-weighted draw happens after engagements resolve; piercing has to travel with the hit from the
  start. **Forward-looking platform-Armor guidance, not yet formal values, for when those platforms are
  designed:** Infantry and most aircraft expected at Armor 0 (making the guard clause their common case);
  Airships plausibly nonzero; Vehicles genuinely variable (a thin-skinned truck vs. an APC); Submarines and
  small boats expected at Armor 0.
- [x] **Stability/partisan attacker bonus, fully resolved this session (GDD §8.6.3):**
  `bonus = floor((50 − Stability) / 5)`, active only below 50% Stability, applied as a flat additive bonus
  to every nonzero combat vector value for the invading side. Verified: Stability 45% → +1; 25% → +5; 0%
  (total collapse) → +10, the effective ceiling. **Confirmed an attacker-side bonus, not a defender-side
  malus** — resolves an earlier open question about which side of the calculation this modifies, and means
  it composes predictably with Shock and the Defensibility multiplier rather than needing special
  interaction rules. **Scope, corrected from an initial misreading: the gating condition is whether an
  invasion is actually underway, not which specific line is being evaluated.** If a real invasion is active
  (Front Line and/or CAS engaged), **every active line gets the bonus, including Long-Range Fires** — a
  region under active invasion benefits its whole combined-arms effort from partisan support, not just the
  units physically on the front line. **If it's a pure standoff exchange with no invasion at all, nothing
  gets the bonus**, Long-Range Fires included — the gate is "is there ground combat happening in this
  engagement," not "is this specific unit on the ground." **Deliberately only
  activates below 50%, not a smooth curve across the full 0–100% range** — a genuine departure from every
  other curve in this design (Piercing/Armor, the Defensibility multiplier), justified by the flavor: a
  stable, functioning region simply doesn't offer partisan networks, saboteurs, or defectors to exploit —
  there's nothing to activate until real unrest exists. **Directly delivers the MU civil-war blitz identity
  concretely** — a mostly-infantry/FPV-drone-team MU force becomes genuinely viable against a regular Army
  Task Force once a targeted region's Stability drops toward 25% (+5 to every roll), the mechanical payoff of
  agent-driven subversion and military conquest combining rather than competing. **Deferred to the Events
  epoch, explicitly out of scope for now:** a potential future event allowing payment to flip an enemy unit
  into your own Task Force — noted for continuity, not needed for this epoch's combat bonus alone.
- [x] **Production-value-weighted loss distribution** (§8.3.2), resolved in §5.1 above: confirmed
  inverse-proportional weighting, `(1/cost) ÷ Σ(1/cost)` across the target pool.
- [x] **Saturation/throughput, resolved this session (GDD §8.5.1 updated) — not with numbers, but by
  recognizing the mechanic was already built:** emerges from the Deep Strike/Air Superiority and CAS pairing
  system (§5.1–5.3) — below defender capacity, attackers face real opposed rolls; above it, the excess get
  unopposed rolls, with defenders thinning further as the battle wears on. **A genuine, deliberate difference
  from the original framing:** pairing is strictly 1-for-1 per tick, not one defender absorbing several
  attackers at once — the "eats mass" / "leaks above capacity" behavior emerges across a multi-tick battle,
  not within a single tick. **Partially informs, but doesn't fully close, Component 1's Penetration factor**
  (§1.3) — clarifies the relationship (Air Superiority % comes from resolving this exact combat, already
  confirmed), but the per-platform Air/Sea power contribution number and the round-outcome-to-percentage
  mapping remain separately open there.
- [x] **Deep Strike/Air Superiority role mechanics, resolved (§5.2 above):** the full pairing/SEAD algorithm,
  both resolution shapes (symmetric duels and the asymmetric SCUD-hunt), tick-based re-pairing, scoped
  Reserves reinforcement, the revised 50-point advantage cap, and the CAS/standoff notation convention.
- [x] **CAS role mechanics, resolved (§5.3 above):** random Front-Line targeting, per-side independent
  defensive pooling (including Deep Strike/Air Superiority leftovers), the full resolution mechanic, scoped
  reinforcement, and tick-based re-randomization.
- [ ] **Air-domain archetype categories — further resolved this session, only ships genuinely remain:**
  ground-based air defense reaching higher-altitude aircraft (§5.2) and aircraft-vs-aircraft engagement
  itself (also §5.2, corrected from an earlier claim in this document that it needed a new column) are both
  now resolved via the existing four-column vector. **Only the full set of naval/ship archetype columns
  remains genuinely unstarted — deliberately deferred, not just unaddressed, per an explicit decision this
  session.** Adding placeholder Boats/Ships/Submarines/Airships columns now (all zero, marked TBD) was
  considered and declined: nothing in this epoch's five platforms reads from or writes to a naval column, so
  a zero-valued placeholder carries no real information over the column's outright absence. More importantly,
  it would pre-commit to an assumption — that naval platforms need genuinely new dedicated columns at all —
  that Artillery's own resolution this session specifically argues against assuming by default (it reuses
  Vehicle's column rather than getting its own). **When naval platforms are actually designed, the first
  question should be the same one Artillery's case raised: does this platform need new columns, or can it
  extend/reuse the existing four** — not an assumption baked in ahead of time by a placeholder.
- [x] **Long-range-fires notation: plain-vs-parenthetical value symmetry, resolved (§5.2 above):** genuinely
  asymmetric in general — lasers expected stronger short-range, hypersonics stronger long-range (deferred as
  a later capability) — not merely a boolean flag as the earlier symmetric ALCM example might have implied.

---

## 6. Component: UI Extensions

*SOURCE: extends epoch1-implementation-skeleton.md §2's generic hover/pin panel system — not yet discussed
this session.*

- [x] **A Task Force panel, following the same hover-preview/click-to-pin pattern already built for Regions
  (§2.2/§2.3 of the Epoch 1 doc)** — this system was explicitly built generically for exactly this reuse, per
  its own documentation. **Formally closed out here**: its actual content (stats for any TF, owner-only
  controls for your own) is what the map-level Task Force representation and Task Force Editor entries below
  describe in full; this bullet just never got checked off when that content landed.
- [x] **Domain control display — surfaces on the Region panel, replacing Epoch 1's dev-editable flat-100%
  placeholder with the real computed value.** Component 1 is now fully resolved (§1.1–1.6), meeting this
  bullet's own stated condition for completion.
- [x] **Task Force Editor, resolved this session — a two-layer interface, not a single grid:**
  - **The composition grid, lower layer:** tracked by unit *type* and count, the same pattern already
    established for Epoch 1's building grid — a Task Force with 10 Main Battle Tanks and 40 AA Infantry
    occupies only two grid cells (showing 10 and 40), not fifty individual entries. Desired end strength set
    via +/−, resource priority set via the same chevron system already built for Production allocation
    (§3.7/§3.8).
  - **The line-assignment layer, above the grid:** three separate displays — Front Line (12 slots),
    Long-Range Fires (12 slots), CAS (6 slots) — where clicking an empty slot opens a picker showing only
    unit types **currently valid for that role and not yet fully assigned elsewhere.** Clicking a Front Line
    slot with both Tanks and Infantry available in the roster shows both as options; clicking a CAS slot
    with neither type CAS-eligible shows nothing to pick. **Once a type's full count is already assigned
    (e.g. all 10 Tanks placed across Front Line slots), it stops appearing as an option for further slots**
    — the remaining slots must draw from whatever's left in the roster instead. This is a direct, correct
    consequence of the type-and-count tracking model in the layer below, not a separately-coded rule.
- [x] **Combat log and Battle Logs browser, resolved this session:**
  - **A log begins collecting Manpower and Equipment losses for both sides the moment combat starts**
    (standoff or invasion) — **a phase transition (standoff escalating to invasion) starts a genuinely new
    log**, not a continuation of the old one; both are preserved afterward, not discarded.
  - **The Production-value translation is computed on open, not tracked live tick-by-tick:** opening (or
    hovering, which pulls the same fresh computation — there's no reason to hold state for an inactive
    window) the log takes the accumulated loss counts and looks up **current** Production costs at that
    moment to produce the value-tradeoff metric. **Deliberately not historically accurate** — if a unit's
    cost changes mid-game (a tech unlock, a balance change), losses from *before* that change still get
    revalued at today's cost the next time the log is viewed, not the cost at the time each unit was
    actually lost. **A known, accepted tradeoff, not an oversight:** avoids needing any live-update or
    change-listening infrastructure in exchange for a small, temporary staleness window (only affects a
    player who keeps the log open through the exact moment a relevant cost changes) — the goal is giving the
    player a reasonable sense of whether a battle is generating or losing value for them, not building an
    accounting-accrual simulator.
  - **Separate invasion attempts always produce separate logs** — confirmed for the probe-and-bail case
    (§4.6): if a Task Force invades, retreats, and the defender then counter-invades in turn, that's two
    distinct logs, not one continuous one, since they're mechanically distinct transit-combat instances.
  - **Battle Logs, a new browsable list reachable from the Military button:** while a battle is
    active, hovering or clicking its map-level indicator opens the live log directly; **once combat ends or
    changes phase, the log becomes historical** and is only reachable through this list from then on — a
    running record of past engagements and whether each one generated or lost value, not just a live-combat
    feature.
- [x] **Map-level Task Force representation and orders, resolved this session:**
  - **A board-game-piece-style icon** (a tank silhouette, tentatively), **color-coded by Faction**, hovering
    or clicking it opens the same generic panel system already built for Regions (§2.2/§2.3 of the Epoch 1
    doc) — full stats if you don't control it, plus movement/orders/composition access if you do.
  - **Clicking your own Task Force makes it "Active" for issuing orders.** Clicking a destination region
    then calculates the closest permissive path by time-distance and draws the arrow, exactly matching the
    pathing/redirect mechanics already established (§4.2, §4.4) — no new pathing logic, just its UI surface.
    **An invalid destination (e.g. a land unit attempting to enter a maritime region with no valid
    embarkation) fails visibly** — a brief red X where the player clicked, plus a sound — rather than
    silently doing nothing.
  - **Shift-click adds sequential legs to the current order**, HOI4-style, matching the manual-override
    pathing already established (§4.2).
  - **Orders can be issued at any point while time is running or paused**, mid-Pulse, not gated to Pulse
    boundaries — explicitly different from the future We-Go system planned for Agents.
  - **Entering a region occupied by a hostile Task Force is invasion**, triggering combat per the existing
    transit-combat model (§4.6) — no separate "declare invasion" action, movement and invasion are the same
    order.
  - **Retreat is not a separate action or button — it's the exact same move-order override already
    established (§4.4's redirect cost), which happens to trigger the backing-out/partial-retreat logic
    (§4.6) because the Task Force is currently mid-transit-combat when the override is issued.** Plain-click
    a new destination while engaged: the TF backs out of its current progress and restarts toward the new
    target — a genuine retreat. **Shift-click to add a leg to the current order is explicitly *not* a
    retreat** — the TF stays engaged in its current fight, and the shift-clicked destination queues as a
    next step to pursue only once the current engagement resolves (Organization and regional Stability
    permitting) — "push deeper once able," not "abandon and redirect." No new mechanic needed for any of
    this, just the existing single-click-vs-shift-click distinction doing double duty.
  - **Standoff fire toggle, resolved with the exact underlying model:** while a Task Force you control is
    Active, a rocket icon appears next to it with a small red X beneath — "Standoff Attack" and "Cancel"
    respectively on hover, Cancel circled by default (not currently engaged). Clicking the rocket then an
    adjacent hostile region begins long-range fire once time is running; the rocket becomes circled instead
    while active. **Each side tracks one binary flag — "have I personally engaged?" — and fire happens on a
    given tick if either side's flag is set, a logical OR, not a negotiated or synchronized state.** This
    correctly reproduces every asymmetric case: if only side A engages, B still fires back automatically
    without B ever touching their own rocket (B's icon stays on Cancel throughout, since B's own flag was
    never set); if A disengages while B *had* independently engaged, fire continues on B's side alone until
    B also disengages — the two sides' flags are genuinely independent, not a shared negotiated toggle.
    **Timing, disambiguated following external review: toggling off takes effect immediately, that same
    tick, not queued to the next Pulse boundary** — consistent with move orders and every other action on
    this map already being issuable and effective mid-Pulse (§6's map-level entry above), not a special case
    for this specific toggle.
  - **Standoff fire against a hostile region with no defending Task Force present, this epoch, produces a
    real combat indicator (crossed swords, tentative icon choice) but no actual log content** — opening it
    shows only "Counter-value targeting to be implemented in the future," with nothing actually being
    tracked. Distinguishes this from an *invalid* target, which fails visibly like an invalid move order —
    the undefended-region case is a real, working action that simply has no effect yet, not an error.
  - **Standoff fire against a non-hostile region fails the same way an invalid move order does** — the
    brief red X and sound, not silently ignored.
  - **Stances live on the Task Force panel; standoff fire lives as a map-level interaction, confirmed as a
    deliberate split rather than everything living in one place.**
- [x] **Military Button, resolved this session — replaces Epoch 1's generic "Small Arms" placeholder with a
  real per-Equipment-type breakdown:**
  - **A scrollable line-by-line list, one row per named Equipment type, each showing Task Force Demand and
    Stockpile fill as `current/target` pairs** — verified against the established 3×-demand stockpile cap
    (§3.9, corrected here from an earlier stale §3.7 reference left over from prior renumbering): a Task
    Force wanting 1 Light Infantry produces a stockpile target of 3, matching Eric's worked
    example (`Light Infantry Equipment 1/1, Stockpile 3/3`; a newly-added, not-yet-equipped Heavy Infantry
    line showing `0/1, Stockpile 0/3`) exactly. **The displayed stockpile number can legitimately exceed its
    target** (e.g. `Light Infantry Equipment 10/10, Stockpile 83/30`, confirmed a valid, stable state per
    §3.9 — via capture or a reduced Task Force demand after the fact) — the display should show this
    plainly rather than clamping it to look like it's merely at cap.
  - **Corrected this session: demand is pooled per priority tier, not aggregated into one line per Equipment
    type regardless of priority — chevrons live on every line because every line represents a distinct
    priority pool, not a read-only annotation on an already-aggregated number.** Priority itself is set per
    Task Force, in the Task Force Editor, when choosing unit counts (§6's Task Force Editor entry above) —
    exactly matching how the underlying 60/30/10 waterfall actually manufactures (§3.7/§3.8). Given that,
    aggregating all demand for one Equipment type into a single line, as originally proposed, doesn't work
    once different Task Forces set different priorities for the same type: **if 2 of a player's 4 Task
    Forces have Light Infantry at Normal priority and the other 2 have it at Low, the Military Button shows
    two separate lines** — "Light Infantry Equipment (Normal)," pooling only the two Normal-priority Task
    Forces' demand, and "Light Infantry Equipment (Low)," pooling only the other two's — each with its own
    chevron correctly reflecting which pool it is, not the same number split awkwardly across a shared row.
  - **Sortable/filterable, anticipating a long list once named custom builds proliferate** — Infantry's four
    fixed Equipment types are a short list, but Vehicle/Tank/Artillery/Aircraft's player-named custom
    combinations (§3.11) could run to dozens of distinct SKUs; sorting by most-under-filled-relative-to-
    demand surfaces real problems first rather than requiring a scroll through fully-stocked lines.
  - **Manpower shown below the Equipment list as a single row, not per-type lines** — correctly reflecting
    the established Manpower/Equipment architectural asymmetry (§3.4): Equipment is tracked per-SKU with
    priority-tiered manufacturing, Manpower is one fungible faction-wide pool with priority-tiered drawdown,
    so it only ever needs one row here, not a breakdown.
  - **A "Battle Logs" button up top, routing to the browsable list already resolved above** (renamed from an
    earlier working title of "Historical Battles" for consistency).
  - **A route to the Unit Editor from here, confirmed, with the specific interaction resolved: clicking any
    Equipment line opens the Unit Editor for that exact named build**, in an inspect view showing precisely
    which modules went into it — not a blank "create new" state. Alongside the Task Force Editor, this is
    the second of the two entry points already established as needing access to it; not previously written
    down concretely until this pass.
- [x] **Unit Editor, resolved this session:**
  - **An "Active Unit" dropdown at the top** — blank if the faction has no units yet, otherwise populated
    with "Create new unit" plus every existing unit already in the faction's roster. Opening the editor via
    a Military-button line-click (above) defaults this dropdown to that specific unit.
  - **A platform selector near the top** — Infantry, Vehicle, Artillery, Tank, Light Aircraft. **Locked
    whenever an existing unit is active** (a unit's platform is fixed once built), **selectable only when
    "Create new unit" is active.**
  - **Module boxes appear based on the active platform**, laid out according to that platform's specific
    slot structure (§3.1–3.5) — Infantry's 1 Weapon + 2 Misc looks nothing like Light Aircraft's 1–3 Weapon
    + 1 Engine + 2 Misc, by design.
  - **A live stats panel next to the interface** — combat vector, Production cost, Supply Consumption, and
    every other module-derived stat updates with every change, letting the player evaluate a build as they
    edit it rather than only after saving.
  - **Clicking a box opens a picker of valid options for that slot; modules can also be removed** to compare
    stats with and without them.
  - **Auto-population for a required slot with only one valid option** — e.g. Infantry's Main Weapon,
    currently only Small Arms I — fills automatically rather than making the player click through a
    single-option picker. **This doesn't exempt the slot from validation afterward**: if the player then
    manually removes an auto-populated module, the same "Required" indicator and Save-button gating apply
    exactly as if it had never been auto-filled — auto-population is a convenience for the initial state,
    not a permanent exception to the validation rule.
  - **"Required" indicator: small yellow text next to an empty required slot, but only shown when more than
    one valid option exists** (a single-option required slot is auto-populated instead, per above, so the
    indicator never needs to appear there). **Save Unit stays disabled until every required slot is
    filled.** For "at least one, up to several" slots (Light Aircraft's Main Weapon), only the first slot
    carries the "Required" text — the second and third are understood as genuinely optional additions.
  - **A user-editable name bar auto-updates based on module selection** (matching each platform's own
    established naming rules, §3.1–3.5) **until the player manually edits it, at which point it stops
    auto-updating** — a standard sticky-override pattern. **Name uniqueness is enforced** — the game won't
    let two different configurations both save under "M1A1 Tank."
  - **Save Unit (bottom right) is enabled purely by validity, not by whether the build is a duplicate** —
    every required slot filled enables it; removing a required module after that disables it again,
    regardless of what triggered the change.
  - **Duplicate detection is module-*multiset*-based, not slot-position-based — confirmed this session as
    consistent with, not a new addition to, how the naming rules were already built.** Every platform's
    rename rules were always phrased as "when both are taken" or "when X is taken alone," never "when X
    occupies slot 1 specifically" — so the underlying model never cared about slot order to begin with; this
    just makes that property explicit and enforces it at save time. Swapping which Misc slot holds AT versus
    AA still produces the identical Heavy Infantry unit. **For Light Aircraft specifically, this needs to
    match on multiset, not just set** — duplicate main weapons are allowed there (2× PGM + 1× Autocannon),
    so "same modules, same counts, any slot arrangement" is the correct check, not simple set-equality.
  - **On save, if the current build's module-multiset matches an existing unit's exactly, a confirmation
    prompt appears — "Rename `<existing name>` to `<new name>`?" — rather than silently creating a
    duplicate.** OK or Cancel. **A deliberately-permitted null case:** if the player recreates an identical
    build without renaming it (the default name resolves to the same string either way), the prompt reads
    "Rename Heavy Infantry to Heavy Infantry?" — a harmless no-op that tells the player they haven't
    actually created anything new.
  - **Saving a genuinely non-duplicate unit adds it to the Roster**, immediately available for assignment in
    the Task Force Editor.
  - **Delete Unit, resolved this session — a button next to Save Unit, enabled only when an existing unit
    (not "Create new unit") is active in the dropdown.** Removes that unit type from every Task Force it's
    currently assigned to, including pulling it out of whatever Front Line, Deep Strike, or CAS slots it
    occupied — not just the general composition grid. **A confirmation warning appears first:** "Delete ALL
    units of this type from ALL task forces? Existing Equipment will be lost and manpower will be returned
    to the global pool. If you wish to remove units from a specific task force, use the Task Force editor."
    OK/Cancel. **The Equipment-lost-but-Manpower-returned split is a direct, deliberate consequence of the
    same Manpower/Equipment asymmetry already established in the Production Pipeline (§3.7)** — Manpower is
    a fungible personnel pool a deleted designation simply releases back into, Equipment is SKU-specific
    manufactured gear that has no such pool to return to.
  - **Discard-changes confirmation, resolved this session:** switching the Active Unit dropdown while
    unsaved edits exist prompts "Discard changes to `<Unit name>`?" — OK/Cancel — a standard confirmation,
    not a silent discard.
  - **A real workflow limitation, explicitly identified and backburnered rather than solved now:** upgrading
    a large existing pool of one Equipment type (e.g. converting many fielded Light Infantry to AA Infantry)
    has no shortcut today — it requires creating the new unit, manually adjusting +/- counts in every
    affected Task Force, and letting Production catch up while the old Equipment sits unused. **A future
    in-place-upgrade mechanism, saving Production cost relative to building the new type from scratch and
    avoiding wasting the old Equipment, is noted for a later pass — not needed for this epoch.**

---

## 7. Component: Devtools Extensions

*SOURCE: GDD §12.2's stated Epoch 2 devtools (spawn TFs, assign to factions, control directly) — not yet
discussed this session, but the shape is already given by the epoch charter itself.*

- [x] **Spawn a Task Force directly into a region, bypassing the normal build pipeline — confirmed.**
- [x] **Directly edit a spawned (or existing) Task Force's Manpower and Equipment values to fill it
  instantly, confirmed** — the practical mechanism for setting up a specific test scenario without waiting
  out the real production pipeline tick by tick.
- [x] **Change a Task Force's Faction ownership directly, confirmed.**
- [x] **Control any faction's TF directly (matching Epoch 1's existing active-faction-perspective switch,
  §2.4 of that doc — likely extends rather than duplicates that system), confirmed.**
- [x] **Domain control override, resolved this session: removed entirely, not carried forward as an
  exception.** Epoch 1 made Air/Sea Superiority directly dev-editable specifically because no real
  computation existed yet, to let blockade behavior be simulated ahead of the real system. That
  justification expired the moment Component 1 built a real formula (§1.1–1.5) — the exception is retired,
  not kept alongside real computation. **Matches every other computed value's own resolution** (Production
  and Research, Epoch 1 doc §5.2): edit the underlying inputs, not the computed output directly. **Testing
  a blockade scenario going forward uses the mechanism the game now actually has for it** — toggling
  Faction hostility or Country war status (§1.6) — rather than a value override that could silently drift
  out of sync with what real combat would actually produce. **Epoch 1 doc updated to reflect the completed
  transition** (§5.1→§5.2 move, per that document's own original plan for this placeholder).
- [x] **Set any Faction pair's relationship (Friendly/Neutral/Hostile), resolved (§1.6 above).**
- [x] **Set any Country pair's state (At War/At Peace), resolved (§1.6 above) — with automatic cascade to
  Hostile at the Faction level built in**, not requiring the two settings to be applied in a specific order.

---

## Open items carried from the original handoff, not yet resolved

*(Preserved verbatim in spirit from `epoch2-questions.md`, since these haven't been discussed yet this
session.)*

- Tier 0 #1's remaining sub-questions (§1.5 above).
- Tier 0 #2's actual matchup matrix (§2 above).
- All of Tier 1 (§4 above).
- Tier 2 items remain correctly deferred: naval embarkation, submarines (already fully designed, a
  scheduling call not a gap), EW/EMP/Cyber, Counterattack stances.

---

## 8. Component: Save & Load — new this session, not previously captured anywhere despite being flagged
early in this epoch's work

*SOURCE: raised as a note-to-revisit at the very start of this epoch's sessions, then never actually written
down until now — a genuine gap, not a deferred-by-design item like the naval columns.*

**Scope resolved this session, deliberately narrower than it first appeared:**
- **Fresh randomness on reload, not deterministic replay** — confirmed as the actual requirement, matching
  the stated purpose (repeatable balance testing: same starting state, a fresh outcome each time, building
  a distribution rather than replaying one fixed result). **This directly resolves a determinism question
  raised in external review, worth being explicit about: fixed-point/integer math is not required for
  save/load determinism, because save/load was never meant to be deterministic in the first place.** A
  separate, genuinely distinct concern — floating-point results potentially diverging across different
  machines or platforms in a hypothetical future multiplayer mode — remains a reasonable thing for Fable to
  keep in mind, but it's not a requirement this epoch is imposing now, just a heads-up for later if that
  feature is ever pursued.
- **No cross-epoch save compatibility required** — a save made this epoch is not expected to remain loadable
  once later epochs change the underlying state model. This removes the single hardest part of most save
  systems (schema versioning and migration) from this epoch's scope entirely.
- **One shared Load entry point for both sandbox and eventual full-game saves, even though only sandbox
  exists today** — the save file itself should carry enough of a marker that Load can dispatch to the
  correct context automatically, rather than the player choosing "sandbox" or "full game" before even
  seeing the file list. Cheap to build correctly now; retrofitting it once both contexts genuinely coexist
  would be the harder path.

**Mid-combat save, resolved as explicitly deferred, not unimportant — a real recommendation, not a neutral
option:** desirable eventually, but not required this epoch, since a sufficient workaround already exists
(save a scenario before combat starts, trigger combat fresh from that save for each test run). Recommended
deferral for three reasons together: the workaround already delivers the actual near-term testing value;
mid-combat is the single most complex, error-prone part of this whole feature, needing to precisely capture
both Transit Combat clocks independently (§4.6), each Task Force's Planning/Ready Shock state (GDP §8.6.2,
v2.8), every active Front Line/Deep Strike/CAS/Reserves assignment, and whatever combat log is currently
running; and since cross-epoch compatibility is already off the table, there's little additional cost to
waiting until combat's mechanics have fully settled before locking in exactly what a mid-battle snapshot
needs to contain — building it now risks redoing the hardest part twice if anything shifts.

**One tip for whenever that future pass happens, flagged following external review — not a spec, just a
pointer toward what will need tracking:** the dual-occupancy behavior during Transit Combat (§4.6) and the
progress-based partial retreat distance (§4.6) both hinge on knowing how far along a Task Force's transit
clock actually is at the moment of a save, plus which region it originated from. Worth having that in mind
when this gets designed properly, without us prescribing the exact field names or schema now — that's
implementation's call to make once the mechanics it's built against have settled.

**What the at-rest case (this epoch's actual scope) needs to capture:**
- Full region state (Epoch 1 baseline: stats, Control, Popularity, buildings).
- The Faction/Country Relationship Matrix (§1.6) — genuinely new this epoch, easy to overlook if save/load
  design doesn't explicitly account for it.
- Per-faction economic pools: Production, Stockpile per named Equipment SKU, the Manpower pool, Legitimacy,
  Money.
- The Unit Editor Roster (§6) — every custom-named unit design a faction has saved.
- Task Force composition, current position, stance/posture, and standoff-fire engagement toggle state.
- **A Task Force peacefully mid-transit (moving between regions, not in combat) is a lighter version of the
  deferred mid-combat problem, but belongs in this epoch's scope, not the deferred pile** — no dual clocks
  or Shock state involved, just how far along its route it currently is. Worth capturing explicitly so it
  doesn't get accidentally lumped in with the harder deferred case.
- Time state: current Tick/Pulse/date, running or paused.

---

## Status: SUBSTANTIALLY COMPLETE

**Every component this epoch needs is now resolved, with exactly one deliberate, documented deferral left
— not several open threads.**

**Domain control (§1)** — genuinely resolved end to end, a real departure from the GDD's original
"Damage × Penetration × ISR-modifier formula" framing: ISR/Radar are Task-Force-wide bonuses to ordinary
engagement rolls (relative-advantage-based, both caps confirmed with real numbers, one cap verified
reachable today), and Air Superiority emerges *indirectly* from winning those rolls rather than from a
separate abstract calculation. The full percentage formula — anchors, per-tick volatility, +8%/−8% long-range
effects, ±5% CAS effects, the 100% cap, and the full-vacate rule — is resolved with worked numbers, plus a
freedom-of-maneuver combat bonus (§1.4) that wasn't part of the original scope. **Validated against a full
worked scenario** (50 Heavy Infantry vs. a mixed Tank/Artillery/CAS force, §1.5) that confirmed the formula
produces a genuinely viable fight rather than an obviously-solved one, directly testing (and satisfying) the
explicit design goal that pure mass stay viable without snowballing into dominance. **The Faction/Country
Relationship Matrix (§1.6)** gives every combat mechanic in this epoch the relationship foundation it had
silently presupposed: Faction-level Friendly/Neutral/Hostile, Country-level At War/At Peace, an automatic
Hostile-cascade on declaring War rather than a hard block, and a documented future invariant (no country can
ever have split Faction control). **Both of Domain Control's original open items are now closed**: the
empty-region case needs no special default at all (the general relationship-based rule already covers it),
and ISR/Radar's underlying mechanism is fully resolved, with only its higher-tier numeric values correctly
deferred to the Tech epoch, consistent with every other tiered system in this design.

**Platform Designer & Task Force Composer (§3)** — all five platforms this epoch needs are fully specified:
Infantry, Vehicle, Artillery, Tank, and Light Aircraft, each with a complete consolidated schema (base
stats, every valid module, combat vectors, Piercing/Armor, naming rules). Several real architectural
patterns emerged and were confirmed general across the whole roster, not platform-specific tricks: the
module-additive combat-vector system with a real design correction it surfaced along the way; the hybrid
Armor architecture (platform base + module-additive); reusing an existing vector column instead of adding a
new one when a platform doesn't need its own (Artillery reading against Vehicle's column); and
platform-specific module catalogs that coincidentally share values in some cases and deliberately differ in
others, confirmed explicitly on Tank. The full two-tier Production pipeline (Manpower/Equipment asymmetry,
the 60/30/10 priority waterfall, stockpile caps, captured-equipment conversion, and confirmed-valid
over-cap states from capture or reduced demand) is resolved in detail.

**Movement, Distance & Transit Combat (§4)** — fully resolved: distance geometry, pathing with player
override, the redirect-cost mechanic, the Combat(Transit) speed system, and the concurrent dual-clock
transit-combat model (HOI4-style, confirmed to allow genuine mid-transit defeat and dual-region
responsibility), plus the full voluntary-retreat/probe-and-bail strategic pattern this enables in
combination with Shock and the counterattack stances.

**Task Force Combat Resolution (§5)** — all three combat roles (Front Line, Deep Strike/Air Superiority, CAS)
are fully worked out, including the complete robots/Organization picture grounded in GDD §8.6.6, Shock's full
Planning/Ready state machine and speed-derived magnitude formula (GDD v2.8), the Piercing/Armor curve with
its Armor-0 guard clause (confirmed universal across all three combat contexts, captured as a
(damage, piercing) pair from the moment of each hit), and the Stability/partisan attacker bonus — a
threshold-gated formula directly delivering the MU civil-war blitz identity concretely. **The one genuinely
open item in this entire document**: the naval/ship archetype columns, deliberately left unstarted rather
than pre-committed to with premature placeholders, per an explicit decision this session not to assume
naval platforms need dedicated columns before that question is actually examined.

**UI Extensions (§6)** — fully resolved: the map-level Task Force representation (icon, movement/pathing,
retreat-via-order-override, the standoff-fire binary-toggle-plus-OR model), the Task Force panel and Editor
(composition grid plus line-assignment layer), the Military Button (priority-tier-pooled demand display,
Battle Logs routing, Unit Editor routing), the combat log and Battle Logs browser (computed-on-open
Production-value translation, deliberately not historically accurate), and the full Unit Editor (platform
locking, module-multiset duplicate detection, Save/Delete/Discard-changes behavior).

**Devtools Extensions (§7)** — fully resolved: spawning and directly filling Task Forces, Faction
reassignment, cross-faction control, and setting both halves of the Relationship Matrix. **The domain
control override inherited from Epoch 1 was removed entirely** rather than carried forward — its own
justification (no real computation existing yet) expired once Component 1 built one, and Epoch 1's document
was updated to reflect that its originally-planned transition actually happened.

**Save & Load (§8)** — new this session: scoped to at-rest saves (covering peaceful mid-transit movement)
with fresh randomness on reload and no cross-epoch compatibility requirement, one shared Load entry point
anticipating sandbox and full-game saves coexisting later, and full mid-combat serialization explicitly
recommended as a deferred future pass rather than built now, given a sufficient workaround already exists
for the actual near-term testing need.

**§2 remains retired** (superseded by §3.6/§5, not a gap) — every other component in this document is
resolved, not merely structural.

---

## Provides / Expects Contract

**This epoch provides, for Epoch 3 to build on:**
- Five fully-specified combat platforms (Infantry, Vehicle, Artillery, Tank, Light Aircraft) and a proven,
  extensible consolidated-schema template — a later epoch adding a new land or air platform should be able
  to follow the same pattern (base stats, module tables, naming rules) rather than inventing a new format.
- A complete, validated Task Force combat resolution system across all three roles (Front Line, Deep
  Strike/Air Superiority, CAS), including Organization, Shock, and Piercing/Armor as real formulas, not
  placeholders.
- A fully resolved Domain Control / Air Superiority system, emergent from combat outcomes rather than a
  separate abstract formula — later epochs building on domain control (naval, Agent-driven sabotage of
  supply lines, etc.) should read Air/Sea Superiority as this computed value, never as a directly-settable
  one; that override was removed, not merely deprecated.
- **The Faction & Country Relationship Matrix (§1.6)** — the actual data model an Agent epoch's diplomacy
  mechanics should read from and write to. **Only the static end-states exist this epoch** (a dev sets
  Friendly/Neutral/Hostile and At War/At Peace directly) — **the drift mechanism itself (hostile/friendly
  Agent Missions moving a relationship over time, Global Tension gating a War-declaration Mission) is
  explicitly not built yet.** This is very likely exactly what an Agent-focused epoch needs to build next
  against this same matrix, not a replacement for it.
- A full UI and Devtools surface for everything above, including Save/Load for at-rest game state.

**This epoch expects Epoch 3 (or whichever epoch is next) not to assume:**
- **Naval combat exists in any form.** No ship archetype columns, no naval platforms, no naval embarkation
  gameplay — deliberately deferred, not partially built. A naval-focused epoch starts from a clean slate on
  the combat-vector side, informed by (not bound to) the land-side patterns already established.
- **Mid-combat Save/Load exists.** Only at-rest saves (including peaceful mid-transit movement) are built;
  resuming a battle exactly where it left off, with both Transit Combat clocks and all active Task Force
  combat state intact, is explicitly future work.
- **ISR/Radar module values exist beyond Tier I.** The mechanism is complete; the numbers for higher tiers
  are Tech-epoch work, consistent with every other tiered system in this design.
- **EW, EMP, Cyber special attacks are implemented**, beyond being named and conceptually placed in the tech
  tree — these remain Tier 2 deferrals from the original handoff, unchanged by this epoch's work.
