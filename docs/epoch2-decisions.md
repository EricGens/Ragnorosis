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

## Source-doc fixes needed

- **Skeleton §5.1:** replace the "~90-point advantage gap" caveat paragraph with the universal
  `min(50, 5 + point_gap)` rule already stated in §5.2, so the two sections agree.
