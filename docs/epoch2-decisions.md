# Epoch 2 — Implementation Decisions

Rulings made while turning `epoch2-implementation-skeleton.md` into code. Same role as
`epoch1-decisions.md`: where this file and the skeleton disagree, this file is the newer ruling; where
either disagrees with the GDD, see "Source-doc fixes needed" at the bottom.

## Combat resolution

- **Advantage-roll cap is universal:** `advantaged side % = min(50, 5 + point_gap)` for every combat
  role — Front Line, Deep Strike/Air Superiority, and CAS alike (Eric, 2026-09-15). The skeleton's §5.1
  text describing Front Line as uncapped "with a ceiling around a ~90-point advantage gap" is a leftover
  from an earlier iteration and is superseded. Design intent: a pushed (no-engagement) outcome always
  keeps a meaningful chance, and even an overwhelming advantage tops out at roughly 10× the other side's
  effectiveness — the weaker side can always land a lucky shot.

## Relationship Matrix (skeleton §1.6)

- **Defaults on the dummy map:** every Faction pair starts **Neutral**, every Country pair starts **At
  Peace**. The skeleton specifies the states and the cascade but not a starting configuration; the
  sandbox begins fully permissive so that blockade/combat scenarios are set up deliberately via devtools.
- **A faction is Friendly with itself**; a country is At Peace with itself. (Self-pairs are never stored.)
- **De-escalation cascades too:** the skeleton specifies War → Hostile as an automatic cascade so the
  inconsistent "War without Hostile" state is unreachable. Setting a Faction pair back to Neutral or
  Friendly therefore also sets any At-War pair between countries those factions control back to At
  Peace — the same invariant, enforced from the other direction. Cascade, not block, in both cases.
- **Countries are derived, not authored:** the country list is the set of distinct `country` values across
  land regions; a country's controlling faction is the controller of its regions (uniform by the
  skeleton's invariant, checked by a test on the dummy map).

## Domain Control (skeleton §1.1–1.3)

- **The stored, dev-editable `superiority` field from Epoch 1 is removed**, per the skeleton's own retirement
  of that placeholder. Domain control is computed fresh from the Relationship Matrix (and, once Task Forces
  exist, from presence and active combat).
- **Pre-Task-Force implementation (slice 1):** for a land region, the calculating faction has 100% if it is
  the controller, Friendly, or Neutral with the controller; 0% if Hostile. For an unaffiliated land region,
  100% unless a country the faction controls is At War with the region's country, then 0%. Maritime
  regions are 100% for everyone until a hostile Task Force is physically present — maritime denial
  requires presence (§1.1 item 3), so with no TFs a declared hostility is a paper blockade by design.
- **Display convention before naval exists:** the Region panel shows one computed value — labelled **Air**
  for land regions and **Sea** for maritime regions. Epoch 1 also showed a "Sea" figure on coastal land
  regions; that concept only becomes meaningful with amphibious landings (deferred with naval), so it's
  dropped rather than shown as a placeholder.
- **Energy sourcing** keeps its "passable if ≥ 50%" rule (epoch1-decisions.md, Energy) unchanged; the
  value it reads is now the computed one, so the C Land blockade test is set up by making the Hive
  Hostile with the United States and China (the controllers of C Land's four neighbors) instead of zeroing
  a stored number.

## Unit designs and the Unit Editor (skeleton §2, §6)

- **Designs are per-faction data on `FactionState.designs`**, each `{ id, name, platform, modules[] }`. Every
  stat is derived on demand (`designStats`) from the platform base plus the module list — nothing derived
  is stored, per "compute, don't store".
- **Name uniqueness is case-insensitive** within a faction ("Light Infantry" and "light infantry" clash).
  The skeleton only says names must be unique; treating case as insignificant avoids two visually
  identical roster rows.
- **Supply is displayed to 0.1**; the sum of module supply values is rounded to one decimal so additive
  floating point (1.1 + 0.1) shows as the skeleton's 1.2.
- **Delete, before Task Forces exist,** only removes the design from the roster. The skeleton's warning text
  (units removed from all Task Forces, Equipment lost, Manpower returned) is shown verbatim already so the
  player-facing contract doesn't change when slice 2b attaches the cleanup.
- **Duplicate loadout on Save (same module multiset):** the editor offers to rename the existing design to
  the new name instead of creating a second copy, then switches to that design. Cancelling leaves the
  draft untouched.

## The other four platforms (skeleton §3.2–3.5; slice 5)

- **Pure catalog data** — each platform carries its own module table (ids prefixed `veh-`, `art-`, `tank-`,
  `la-`), so same-named modules with different numbers (Tank's Targeting Computer at 0 AA vs Vehicle's +5)
  are simply different rows. Long-range values use the skeleton's own `X(Y)` notation in the source.
- **Roles are platform data:** Infantry, Vehicle and Tank may hold the Front Line; Artillery never (§1.5
  "Artillery and CAS aircraft can't"), it goes to Long-Range Fires by its standoff values; Light Aircraft is
  CAS-only unless it carries AGM (the one weapon with standoff reach). Auto-placement on adding units
  therefore fills the first eligible line: Front Line, else Long-Range, else CAS.
- **Artillery is read against the Vehicle column** (§3.3); Light Aircraft against the Anti-Air column.
- **Aircraft never enter the speed calculation** (§4.5); a force with no ground element has no speed and
  can't be ordered anywhere until it gets one. Aircraft-only movement waits for air basing rules.
- **Light Aircraft naming** applies the general category rule (all anti-ground → CAS Aircraft, all anti-air →
  Air Superiority Fighter, mixed → Multirole Fighter) by tagging each weapon module with its target domain;
  only CAS Aircraft is reachable this epoch, as the skeleton intends.
- **"Transporter Erector Launcher (TEL)"** with a Targeting Computer renders as "Transporter Erector
  Launcher (TEL/AFCS)" — the TEL tag joins the suffix list rather than nesting parentheses.
- **Deep Strike and CAS mechanics arrive in slice 6**; until then Artillery and aircraft sit on their lines
  without firing, and Front Line resolution is unchanged.

## Task Forces & the production pipeline (skeleton §3.7–3.10, §6, §7)

- **Task Forces live on `GameState.taskForces`** (not per faction) so devtools reassignment is a field
  change. Each holds a composition grid (`designId`, `target`, `priority`, `equipment`, `manpower`) and
  three line arrays (Front Line 12, Long-Range Fires 12, CAS 6) of design ids — one unit per slot, per §6.
- **Manufacturing banks progress toward whole units** — the skeleton makes Equipment binary *per unit*
  (§3.10); Production allocated to a SKU accumulates until a unit is affordable, exactly like construction
  progress, so a cheap allocation still builds eventually. Banks are per demand pool (design × priority)
  plus one per design for stockpile accumulation, so one tier's Production never quietly builds units
  for another tier's lines.
- **Tier budgets wrap:** after the 60/30/10 sweep, whatever the Low tier leaves is offered back to anyone
  still short, High first. The split governs contention; it never reserves Production for a tier with
  nothing to fill (a Normal-only army would otherwise strand 10% every pulse and the stockpile would start
  filling before demand was met, contradicting §3.9's "once every Task Force is at full target strength").
- **Within-tier shares are weighted by Production-equivalent of each recipient's full demand** (cost ×
  target; Manpower: target × per-unit Manpower) — the same weighting §3.9 gives for stockpile accumulation
  (250/320 vs 70/320) — with saturated recipients recycling their surplus. The loop is bounded structurally
  (every pass either spends the budget or drops a saturated recipient), the guard §3.8 asks for.
- **Equipment has "room" at allocation time:** unfilled demand plus stockpile room (target + 3× target −
  on hand) × cost, minus banked progress, divided by the Production Facility multiplier. With no room the
  Equipment share reroutes at pulse start exactly like a capped Manpower pool (§3.9's overflow rule); the
  little that still overshoots at pulse end (the facility bonus, a stranded Construction stream) goes to
  Manpower training. A brand-new sandbox with no designs therefore sends all Equipment focus to Manpower
  until the first Task Force asks for something.
- **Sourcing happens at pulse end** (stockpile → lines, then manufacture, then pool → lines), not the
  instant a +/− is clicked; the devtools "Fill to target" bypasses this for test setup. Lowering a target
  *does* return the excess immediately (Equipment to the stockpile, Manpower to the pool), as does
  disbanding.
- **Manpower drawdown draws from the whole pool** each pulse end through the same waterfall, floored to
  whole people; Manpower fill is independent of Equipment fill (§3.10 sources each independently).
- **Devtools reassignment adopts designs:** designs are per-faction, so a Task Force handed to another
  faction has each design matched into the new roster by module multiset, else copied (name suffixed
  " (2)" on a clash). This is also the primitive captured-equipment conversion (§3.11) will want.
- **Military Button:** stockpile is per SKU, so two priority lines of the same SKU show the same
  `stockpile/cap` figure. Lines sort most-under-filled first with a text filter; designs no Task Force
  wants are listed dimly as "no demand" so the Unit Editor route still exists for them. Battle Logs
  arrives with the combat slice rather than as a dead button now.

## Movement (skeleton §4, §6 map orders)

- **Distances are map data:** every edge defaults to 300 mi; the dummy map lists the maritime overrides
  (300/400/500 per §4.1's table). The real map replaces the data, not the code.
- **A Task Force with no unit types can't be ordered anywhere** — speed is the slowest ground design in its
  composition, and an empty composition has no speed. Fill state doesn't gate movement (a planned-but-
  unfilled Task Force still moves; combat strength is where fill matters).
- **Permissive = domain control ≥ 50 for the moving faction**, the same threshold Energy routing uses.
  Neutral and unaffiliated (not at war) territory is therefore Transit Speed; Hostile control is Combat
  Speed even with no defender present (§4.5).
- **Arriving in undefended hostile-controlled land captures it** (GDD §8.6.7 "conquest hands you the keys"):
  the controller flips and Stability takes a **placeholder −25** hit — the GDD says "significant" without a
  number; tune in playtesting. The consolidation lock (Organization restore + Stability floor before moving
  on) arrives with Organization in the combat slice. Country war status is left alone — invasion already
  requires the factions to be Hostile, and formal war declaration is the diplomacy epoch's business.
- **Invading a region a hostile Task Force is "in" is refused (red X) until combat exists** — deliberately
  not a half-built "waiting to fight" state. A hostile Task Force that reaches a leg's destination first
  holds the mover in place until it leaves. Both fall away when transit combat (§4.6) lands.
- **Pathing is Dijkstra on time** (distance ÷ the entered region's rate), excluding the sea and defended
  regions. Ties are broken arbitrarily. Shift-click appends: a non-adjacent leg is pathed from the previous
  leg's end, so the manual route is always contiguous.
- **Redirect (§4.4):** a replacement order owes the current leg's progress back at Combat Speed before the
  new path begins; an order that never advanced (progress 0) is replaced free — "not committed until time
  actually advances" (§4.2). Halt is simply an order back to the occupied region, so it pays the same debt.
  Leg overshoot within a tick is dropped rather than carried (at most an hour per leg).
- **Map orders:** a pinned own Task Force is Active; clicking a region then issues the order instead of
  pinning the region. Invalid destinations show a red X with the reason at the click point; the sound the
  skeleton mentions waits for an audio pass.
- **Arrows are curves through the region centres** (Catmull-Rom, with the end tangents bent so a lone leg
  is a battle-map arc), the icon travels along the curve with its progress, and a redirect shows a gray
  arrow home with the icon sliding back along it (Eric, 2026-09-15). `Movement.returnFrom` exists only so
  the map knows where the walk-back starts; the sim ignores it.
- **Speed tuning pending:** Eric's first impression (2026-09-15) is that 5(30) mph feels 3–5× too fast on
  the dummy map; to be revisited once combat testing gives a feel for pacing. Speeds are platform data,
  so it's a numbers change.

## Front Line combat & transit combat (skeleton §4.6, §5.1; slice 4)

- **One attacker vs one defender per battle.** A second hostile Task Force in the destination is fought
  in a fresh battle (its own log) once the first ends; a second attacker against a defender already
  fighting waits at the border. "Attacked while attacking" penalties are deferred, as the skeleton says.
- **A battle starts the first tick a leg advances toward a region a hostile Task Force is in**, and the
  first round resolves that same tick. The transit clock runs at Combat Speed for an invasion leg even
  into ground we control (§4.6 defines it as distance ÷ Combat Speed) and waits at the far end for the
  fight; the pathfinder treats a defended intermediate region as 3× slower so it only fights when told to.
- **The roll is one partitioned d100** per pair: [0, attacker %) attacker hits, then defender %, remainder
  push. A side with no relevant vector value is excluded but the other side's gap still counts (0 vs 5
  → defender 10%).
- **Manpower fill scales a unit linearly** (§3.10): vector, damage and its Organization contribution all
  multiply by `manpower ÷ (equipment × per-unit Manpower)`. A destroyed unit takes that share of Manpower
  as casualties and one Equipment.
- **Organization is stored as a deficit** (`organizationLost`) against the computed maximum, so units that
  arrive from the pipeline come organized, a destroyed unit shrinks the maximum (its contribution leaves
  with it, not double-counted), and a unit pushed to Reserves adds its contribution to the deficit.
- **Both sides breaking on the same tick: the defender holds.**
- **New units auto-place on the Front Line** as a type's count rises, until the 12 slots are full (Eric,
  2026-09-15: protect a new player from a Task Force with everything in Reserves). The picker and
  click-to-remove still let the player rearrange; lowering a count vacates its slots from the end.
- **Shock speed source:** the average Combat Speed of the attacker's *initial* Front Line, per the GDD; if
  the line plan is empty (the force relies on reinforcement rolls) the average is over every unit in the
  force instead, and a force with no units gets no Shock. Found live: an empty initial line produced a
  ×0 multiplier that muted the attacker's rolls entirely.
- **Beaten defender retreat target:** adjacent land it can enter (permissive, no hostile Task Force), own
  territory first, then Friendly, then anything else; it relocates immediately, at zero Organization. The
  GDD's "retreat into neutral territory" decision node (harm relations / buy off / seize) waits for the
  diplomacy epoch. No option → surrender: the Task Force is eliminated and the victor converts 25% of its
  surviving Equipment (floored, per SKU) into matching designs.
- **Attacker beaten or withdrawing** (a plain redirect, halt, or any order that drops the contested leg)
  walks the transit clock's progress back at Combat Speed — the existing backtrack, with the gray arrow.
- **Consolidation lock** is set on capture and lifts when the deficit is 0 and Stability ≥ 50. Note the
  Stability anchor can sit below 50 (C Land's does), in which case the lock never lifts on its own until
  the force-occupation mechanics (suppress dissent) exist; devtools can edit Stability meanwhile.
- **Planning clears at pulse end** if the whole pulse (168 ticks) saw no invasion combat for that Task
  Force; the tick a battle starts or runs counts, on both sides.
- **Battle Logs:** every battle stays on `GameState.battles`; the browser lists live ones first and values
  losses at today's costs when opened (§6). The crossed-swords map indicator opens the live log.

## Combat rulings ahead of the combat slice (Eric, 2026-09-15)

- **Organization regeneration out of contact: 0.5% of max per tick** (a worn-down Task Force takes about a
  week to reconstitute), uncapped until the Supply system exists.
- **Equipment seizure — 25% of the loser's Equipment, only on surrender** (nowhere to retreat to, Task
  Force eliminated). A Task Force that retreats on defeat keeps its Equipment. Seized Equipment is
  converted into the victor's designs by module multiset.
- **Consolidation lock after capture:** the capturing Task Force can't move on until its Organization is
  back to full and the region's Stability is ≥ 50.

## Source-doc fixes needed

- **Skeleton §5.1:** replace the "~90-point advantage gap" caveat paragraph with the universal
  `min(50, 5 + point_gap)` rule already stated in §5.2, so the two sections agree.
