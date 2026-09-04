# Epoch 1 — Implementation Decisions

Rulings made while turning `epoch1-implementation-skeleton.md` into code. Where this file and the
skeleton disagree, this file is the newer ruling; where either disagrees with the GDD, see the
"GDD changes needed" section at the bottom.

## Formulas

- **Money income (per Pulse, per controlled land region):**
  `Money = (GDP / 52) × (Stability / 100) × popularityCut`, where `popularityCut = 0` when the
  controlling faction's Popularity is below 50%, and scales linearly from 0 at 50% to **0.7** at 100%.
  Perfect conditions (100 Stability, 100% Popularity) therefore yield an effective 70% weekly tax rate.
  The US RBO half-cut without Control is **not** in Epoch 1.
- **Research income (per Tick):** `GDP / 1B × Stability / 100`. Displayed as a per-Tick rate.
  *(Doc bug: §1.6 cites this as "§1.4's formula" but §1.4 never states it.)*
- **Region Production (per Pulse):** `Population / 100,000 + Σ plant output`, where a Fossil Fuel Plant
  at level N outputs `N × 100` curtailed 1:1 by Energy shortfall, and a Renewable Plant outputs `N × 100`
  (or `N × 50` while Weather is active, evaluated as a pulse-start snapshot). §4.4 supersedes §1.4's
  "100 from any power plant"; §1.6's "Production 100(100)" was population-only and is superseded.
- **Production Facility** boosts Equipment conversion only (not construction) in Epoch 1.
- **Immigration (per Pulse):** for each qualifying neighbor pair, `transfer = sourcePop × 0.001 × (Δ / 100)`
  from the lower- to the higher-Stability region. GDP moves with the people, preserving per-capita GDP on
  both sides. Both constants are dev-visible tuning knobs.
- **GDP growth:** GDP grows by the same fraction as Population each Pulse. No Epoch 1 building adds GDP.
- **Weather:** per-tick activation chance is a dev-editable constant defaulting to 0 (Weather fires only
  via the devtools toggle in the sandbox); duration 24 ticks. Real-map probabilities by region/season come
  with the full map.
- **Escalating cost:** `cost(level N) = base × 1.05^(N−1)`, locked at the moment that level starts
  building; contributed Production goes toward that locked cost.

## Energy

- Energy on the map represents **fossil fuel only**. Renewable (and later Fusion) plants are entirely
  outside the Energy calculation — their output goes straight to Production and never enters the pool.
- **Reserves are a per-Pulse supply rate**, not a depleting stock.
- **Air/Sea Superiority is per region, per faction.** Each faction has its own value in every region,
  representing that faction's level of access there.
- **Sourcing:** BFS over the region graph, same-country regions first, then outward. Maritime regions are
  transit nodes. A region is passable for faction F if F's Superiority there is ≥ 50% (Sea for maritime,
  Air for land).
- **Blockade layers below fair-share:** global fair-share is computed first; then any plant whose sources
  are unreachable drops further. A faction whose every neighboring region is set to 0% access is fully
  blockaded and its Fossil Production drops accordingly, even with no global shortage.

## Production pool & cadence

- **Production is pooled faction-wide** across all controlled regions, then allocated by focus. A building
  in any region is built from the faction's total. *(GDD §7.3 says "region's own Production" — stale.)*
- The **4-concurrent-project limit is faction-wide** (may change after playtesting).
- **Construction streams per Tick** at the pulse-start rate (1/168 of the pulse share per tick), so a
  building can complete mid-Pulse and fire the auto-pause interrupt.
- **Equipment and Manpower credit at Pulse end** as a lump. Their rates are fixed at pulse start, so
  nothing is lost; later epochs resolve TF replenishment from these stockpiles at the same boundary.
- **Overflow is resolved once, at pulse start**, with all quantities known: Manpower's share is clamped to
  its remaining cap room and the excess rerouted proportionally; an empty construction queue reroutes
  Construction's share likewise.
- **Mid-pulse construction leftover:** if a building completes mid-Pulse and nothing else is queued when
  play resumes, the remaining Construction stream for that pulse is rerouted to Equipment/Manpower
  proportionally at pulse end.
- **Facility bonuses on a pooled resource:** Production/Training Facilities are per-region but the
  pool is faction-wide, so a faction's effective conversion multiplier is the **Production-weighted
  average** of `1 + 0.2 × level` across its controlled regions — each region's facility improves the
  conversion of that region's own contribution. *(Implementation ruling; flagged for confirmation.)*
- **Focus changes** made mid-Pulse apply at the next Pulse boundary. A change made while auto-paused at
  the boundary applies as soon as play resumes.
- **Pulse-boundary ordering:** when tick 168 completes — run pulse-end resolution (Money, Legitimacy,
  Equipment/Manpower credit, Population/GDP growth, immigration, Stability drift), then auto-pause. The
  **next pulse's snapshot** (Energy fair-share and sourcing, Weather snapshot, Production total, focus
  allocation, per-tick rates) is taken on the **first tick of the new pulse**, not at the boundary — so
  anything changed while paused on the boundary (focus, a devtools edit to Superiority, reserves, or
  Weather) applies to the pulse about to run. While paused on a boundary the UI previews that snapshot
  from the current inputs, so edits show their effect immediately.

## Other rulings

- **Stability anchor for Unaffiliated regions:** no controlling faction → the Popularity input is skipped
  and the anchor is the per-capita-GDP input alone (Task Force inputs arrive in a later epoch).
- **Manpower conversion source:** Population is drawn from the faction's controlled regions proportionally
  to their population. The 2% cap applies to the pool's size against total controlled population.
- **Starting faction pools:** Money, Legitimacy, Equipment, Manpower all start at 0; focus starts Balanced.
- **Red Queen defaults to 75% Popularity** like every other faction (SW Land's authored 0 stands). SW Land
  is the intended nonpermissive-region testbed for her Agents/Task Forces in later epochs.
- **Resolution log:** the sim records what happened each Tick/Pulse and why (GDD §12.10, Time devtools).
  Built into the core from the start.
- **Art:** dark gradient placeholders stand in for terrain images until real assets exist.

## GDD changes needed

- **§7.3 Production:** change "Fueled by the region's own Production output" to state that Production is
  pooled across all faction-controlled regions and allocated across Construction, Manpower, and Equipment
  each Pulse (per skeleton §4.3).
- **§1.4 of the skeleton:** add the Research formula that §1.6 cites.
