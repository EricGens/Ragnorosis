# Epoch 2 — Pre-Implementation Questions

*Written by the implementation-side Claude after a full read of GDD §8 (Military & Combat) and the §12.2
epoch charter. Purpose: same role epoch1-implementation-skeleton.md played for Epoch 1 — flag what's
genuinely missing or ambiguous before code starts, propose defaults where I have one, and scope a slice
that's actually buildable in one epoch. Handoff target: Eric + the documentation-side Claude, to resolve
collaboratively the way epoch1-implementation-skeleton.md was resolved.*

**Overall assessment: §8 is in unusually good shape.** Posture, Shock, Organization, retreat/surrender,
occupation, terrain/fortifications, amphibious gating, and the piercing/armor concept are all marked
resolved and read as internally consistent. The gaps below are the real remainder, not a sign the section
needs another full pass.

---

## Tier 0 — blocks everything, has no formula anywhere yet

### 1. Domain control: Air/Sea Superiority computation

§8.5 says superiority comes from "fighter composition + aggregated air defenses + modifiers (stealth,
radar, EW)" and that "home turf is easier (e.g. US 80% over its own region, 40% over MU's)" — but no
section actually computes the percentage from a Task Force's composition. Every one of the following reads
on this number without it ever being derived: standoff fire delivery fraction (§8.5), the amphibious
50%-gate and linear penalty (§8.6.4), CAS's theater-air-superiority gate (§8.6.8), reconfiguration lag
scaling (§8.5.3), and supply-path contestation (§8.7, already partially stubbed in Epoch 1).

**Proposed shape, for discussion, not a claim this is right:** a simple contest ratio —
`superiority_A = A's domain-relevant power / (A's + B's domain-relevant power)`, each side's "power"
summing a per-platform Air or Sea contribution (from the platform designer stats), then a home-turf
modifier applied afterward. Needs answers to:
- What is a platform's single "Air power" / "Sea power" contribution — a new aggregate stat computed from
  its weapon/module loadout, or does it fall out of the existing effectiveness-vector system (§8.3)?
- How big is the home-turf bonus, and what triggers it — Country ownership, current region Control, or
  something else? Is it symmetric (each side gets a bonus on its own turf) or asymmetric?
- Does a region with *no* TF present from either side sit at a neutral 50/50, or does the last controller
  retain some baseline?

### 2. Weapon/defense archetype list + the effectiveness matrix itself

§8.3's "profile vectors... matched via an effectiveness matrix" is the keystone of the whole combat model,
but no section enumerates the actual archetypes (attack side: small arms, armor, artillery, air-to-air,
CAS, anti-ship, anti-sub, …? defense side: infantry, armor, air defense, point-defense, …?) or gives even
a placeholder matchup matrix. This blocks the platform designer (§8.2) — there's nothing concrete to offer
as weapon/module choices yet.

**Suggested approach:** doesn't need to be balanced or final — a first-pass list (10-15 archetypes per
side) with a rough matchup matrix (strong/neutral/weak, not exact numbers) would unblock the data model
immediately; exact multipliers are a balance-sandbox concern (§12.10) anyway, consistent with how Epoch 1
treated its own formulas.

---

## Tier 1 — needed for a minimal land-combat slice specifically

Assuming the slice recommendation below (land-only, no naval/subs), these are the concrete numbers/curves
still missing:

- **Organization:** starting/max value, drain-per-damage-taken rate, and the "**%** of the loser's
  equipment" the victor gains (§8.6.6) — currently just "a %," no number.
- **Shock bonus magnitude** (§8.6.2): "scales with speed, firepower, air superiority, combined-arms" — no
  actual formula or range. Even an illustrative one (e.g. +X% effectiveness for N pulses) would unblock
  implementation.
- **Piercing vs. armor curve** (§8.6): the ~10% floor and ~80% pierced-effectiveness figures are given, and
  "a smooth curve, steep near the crossover" is specified qualitatively — needs an actual function (a
  sigmoid, a piecewise-linear ramp with defined breakpoints, etc.) to code against.
- **Stability/partisan attacker bonus** (§8.6.3): "a scaling bonus as Stability falls" — no curve shape or
  magnitude given.
- **Production-value-weighted loss distribution** (§8.3.2): structure is resolved (inverse-weighted by
  per-unit cost) but the actual weighting function isn't — e.g. is it a straight inverse (`1/cost`), an
  inverse-square, or something tunable?
- **Saturation/throughput numbers** (§8.5.1): "per-pulse interception capacity" and "cost-per-intercept"
  per defensive archetype are structurally described but have no illustrative values anywhere, even
  placeholder ones.

---

## Tier 2 — recommend deferring past Epoch 2's first slice

The epoch charter itself already flags this risk ("this epoch's tech slice may need to be larger than
'basic tech only' implies"). My read: resolve these later rather than let them block the epoch —

- **Naval embarkation** (§8.1.1) — Weight classes, three carrier-module tiers, stacking Cargo Holds. Fully
  specified structurally but explicitly "exact weight/capacity numbers TBD like everything else this
  granular," and it's a large, self-contained system.
- **Submarine warfare & detection** (§8.5.2) — the most thoroughly resolved subsystem in §8, but it's a
  complete standalone mechanic (per-tick detection rolls, binning, the adjacent-standoff immunity rule)
  layered on top of naval combat that doesn't need to exist yet if naval combat itself is deferred.
  Genuinely ready to build whenever naval combat is in scope — no further design work needed here, it's a
  scheduling call, not a gap.
- **EW / EMP / Cyber** (§8.6.9) — Cyber specifically *is* an Agent Mission, so it can't function before
  Agents exist (Epoch 3) regardless of TF combat readiness. EW/EMP are TF-mounted but are flavor/depth on
  top of the core exchange, not load-bearing for proving combat works.
- **Counterattack stances** (§8.6.2) — a real mechanic, but additive depth on top of Posture, not required
  to validate the core attack/defend loop.

## Proposed Epoch 2 minimal slice

For discussion — matches the doc's own hints (§12.2's naval-complexity flag; land-only mechanics have zero
open Tier-2 dependencies) more than it's a unilateral cut:

- **Land Task Forces only.** No naval, no embarkation, no submarines.
- **Platform designer:** a handful of land archetypes (infantry, armor, artillery, one CAS-capable
  aircraft) — enough to exercise the block system and the effectiveness matrix once Tier 0 #2 is resolved.
- **Combat:** standoff fires (counter-force only — defer counter-value, since it touches the
  Production-suppression curve which is its own open item in §8.7), full invasion/ground combat
  (Posture, Shock, Organization, retreat/surrender, occupation).
- **Domain control:** needs the Tier 0 #1 formula even in this reduced scope, since standoff delivery and
  CAS gating both read on it — this is the one piece that can't be simplified away.
- **Deferred:** everything in Tier 2, plus Counterattack stances and EW/EMP (Tier 1's items are still
  needed even for this slice).

---

## Format note for the write-up

If it's easiest to fold answers back into the GDD directly (matching how §7.3 got its v2.2 fix), the
natural homes are: Tier 0 #1 → new subsection under §8.5; Tier 0 #2 → new subsection under §8.3; Tier 1
items → inline resolutions in their existing subsections, same pattern as this session's Research-formula
fix to skeleton §1.4.
