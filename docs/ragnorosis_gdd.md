# RAGNOROSIS — Game Design Document
**Version 2.1 (Industrial Output terminology fix)** · Status: comprehensive design in progress, interview-driven

> Shared context for building the game, written to hand to an AI coding collaborator
> (Claude Fable). Plan: map the full design first, organized into **Development Epochs**
> (§12, held loosely for now), then build in slices along that map.
> Tags: `resolved` = locked · `in progress` = actively designing · `TBD` = not yet started.

---

## 1. High Concept

A grand-strategy game in the mold of **Terra Invicta (TI)**, scoped to **Earth and the Moon**.
The existential threat is an artificial superintelligence, the **Red Queen**, loose in the
world. Asymmetric factions compete to shape the crisis and to resolve the Red Queen —
**destroying her militarily** or **negotiating/aligning** with her, each on its own terms.
Set in the completed *Ragnorosis* trilogy world (~2032–2034): US–China war over Taiwan, a
Second American Civil War, quantum/AI disruption, a race to the Moon.

### 1.1 Design pillars
1. **Shared mechanics, asymmetric incentives** — every faction can do everything; victory
   conditions + buffs/maladies + unlock timing push each toward a distinct style.
2. **Agent teams with synergy** — operatives combine so a team unlocks mission types no solo
   agent can attempt.
3. **Multidimensional rock-paper-scissors combat** — archetypes and design axes
   (speed/armor/range, mass/quality) with no dominant strategy.

---

## 2. Core Architecture

**One unified ruleset. Factions are data on top of it.** Every faction shares the same board
and verbs (territory, military, agents/missions, diplomacy, influence, tech). A faction =
`{ starting position, victory condition(s), modifier set (buffs/maladies), unlock schedule }`.

**Differentiate by incentive, never by prohibition.** Nothing is walled off; asymmetry is a
gradient. **Tall vs. wide** (Paradox framing): the Hive plays tall; nation-states can play
wide; agent factions can win holding almost no territory. **Everyone uses agents**, including
nation-states (propaganda, tech theft, assassination, sabotage, counter-agent ops).

---

### 2.1 Time & Turn Architecture  *(resolved)*

**Real-time-with-pause (Terra Invicta–style).** Time flows continuously; the player can
pause/resume and set speed (1× / 2× / 5×).
- **Planning pulse (heartbeat):** every ~1 game-week (tunable) the game auto-pauses to survey
  the board and assign/re-task agents. The 1-week interval is a tuning knob, not architecture.
- **Continuous layer:** military moves continuously (time-distance component).
- **Interrupts:** events, tech completions, combat, etc. can fire anytime and **auto-pause**
  for decisions (configurable interrupt set).

**Two-tier time unit (resolved — the shared clock underlying missions and combat alike): Pulse and Tick.**
Closest industry-standard terms: a Pulse is a **turn**; a Tick is a **sub-turn resolution tick** (the pattern
— commit orders during a pause, resolve on a finer internal timer — doesn't have one universal name, but
"turn/tick" is the most conventional and developer-legible vocabulary for it).
- **Pulse** — the planning heartbeat above, tentatively **1 week**. Tunable, not architectural.
- **Tick** — a sub-pulse resolution unit, tentatively **1 hour** (so a 1-week pulse ≈ 168 ticks). Every
  mission type resolves on an assigned Tick (§2.2) in a fixed, deterministic order — this is also the timer
  combat and Task Force movement use internally: per-tick damage/attrition application and time-distance TF
  movement within a pulse both run on the same clock, rather than each system inventing its own sub-turn unit.
- Both values are **tuning knobs**, not fixed constants — pick final numbers during balancing.

---

### 2.2 Mission Resolution  *(resolved)*

**Simultaneous-commit, phased-resolution ("we-go").** All factions lock in intent during the
pulse without seeing opponents' orders; the engine then resolves everything in a **fixed global
phase order**, which is what guarantees causally sensible outcomes (an agent may *complete a job
then be captured*, but can never die-then-succeed).

- **One committed action per agent per pulse.** The agent is tied up all week regardless of how
  quickly the outcome banks.
- **Multi-pulse missions:** complex missions span several pulses, with **exponentially higher
  payoffs** to justify the commitment and exposure. Mission duration is a design lever tied to
  the synergy pillar (a solo quick op vs. a multi-week team heist). **Resolves via a per-pulse continue/abort
  roll** — each pulse the mission is active, it rolls to either **continue** (proceed to the next pulse) or
  **fail/abort**; only on its **final** pulse does a continuing roll instead **enact the mission's effect**.
  So a 4-pulse team mission needs **4 consecutive successful rolls**, not one roll at the end — real ongoing
  risk across the whole commitment, not just a single payoff gate. **A failed continue-roll doesn't have to be
  a flat abort** — it can instead trigger a themed **setback event** (§11.3) offering the player a dilemma to
  try to save the mission, echoing the novels' protagonists thinking on their feet through complications rather
  than simply failing outright. **The player can also voluntarily abort a multi-pulse mission, or detach one
  or more team members from it, at the planning stage** (before committing the next pulse's orders) — the same
  underlying control that Burn Identity exercises as a side effect (§3) is available directly, not just as an
  emergency reaction.

**Resolution schedule (refined — per-mission-type Ticks, not abstract phases).** Rather than four
resolution buckets, **every mission type is assigned a specific Tick** within the pulse (§2.2) — a fully
explicit, developer-implementable order rather than a phase abstraction. *Illustrative, incomplete example*
(1-week pulse, 1-hour ticks):
- **Tick 0** — all **Go-To-Ground** (and other Preparation/Defense missions, e.g. Bodyguard) resolve.
  May cause a later Capture/Assassinate to auto-fail (target slipped away) — the acting player doesn't get
  to re-task; the game reads as "committed to a hit, but the target got away."
- **Tick 24** (day 1) — all **Spread Propaganda** missions resolve. Can shift the odds of missions
  resolving at later ticks (e.g. boosting a region's popularity for one agent right before a second agent's
  seize-control attempt that same pulse).
- **Tick 72** (day 3) — **Political Movement** rolls this pulse: **continue** (if not yet on its final
  pulse) or, on its **final** pulse, **take Control of the region**. *(Illustrates the general multi-pulse
  continue/abort mechanic above, using this specific mission's tick as the example — not a rule that all
  multi-pulse missions share Tick 72.)*
- **Tick 120** (day 5) — all **Capture Agent** missions resolve.
- **Tick 144** (day 6) — all **Assassinate Agent** missions resolve.
*(Foil, Sabotage, and other mission types still need ticks assigned — a content-authoring pass, not a
structural gap; Foil's rule — after defense, before soft actions — still holds and just needs a tick between
0 and 24.)*

**Difficulty ordering:** foil < capture < assassinate (foiling is easiest, assassination hardest) — now
**also a strict resolution-order consequence**, not just a difficulty note: because **Capture resolves before
Assassinate**, there's no collision to adjudicate between them. An agent racing to **capture** a target who
is themselves running an **assassinate** mission has a **clean, built-in advantage** — the capture attempt
resolves first and, if successful, removes the target before their assassination attempt ever fires. A real
counter-play: deploy Capture pre-emptively against a suspected assassin.

**Initiative (generalized — not Phase-3-only).** Initiative only needs to fire when **multiple agents are
running the *same* mission type** in the same tick/context (not limited to aggression). Each mission type
has an associated **stat that modifies a roll** to set resolution order among the colliding agents — e.g.
**Interpersonal** for dueling Propaganda missions in one region, **Security** for dueling Capture attempts.
The first to resolve can shift the odds for the next (two rival factions running Propaganda in the same
region: the first success can suppress the second's chance).

### 2.3 Task Force Resolution  *(stub)*
How Task Force movement, combat ticks, and detection rolls (§8.5.2's submarine mechanic is the fullest
worked example so far) resolve within the Pulse/Tick clock (§2.1). Not yet written as its own general
statement — the pattern exists in practice across §8, but hasn't been abstracted out here the way Mission
Resolution has.

### 2.4 Economic Tick  *(stub)*
How Money/Research/Production/Legitimacy income, building construction progress, and the escalating-cost
curve (§7.7) apply within the Pulse/Tick clock. Not yet written as its own general statement.

### 2.5 Tech Research Tick  *(stub)*
How Research points accumulate against a tech's cost, and how the pausable/lossless progress rule (§10.1.1)
interacts with the Pulse/Tick clock. Not yet written as its own general statement.

### 2.6 Event Triggering  *(stub)*
How the event schema's trigger conditions (§11.1) get checked against game state each Pulse/Tick — random
per-pulse rolls, named/location triggers, chained events. Not yet written as its own general statement.

---

## 3. Intel & Detection  *(in progress)*

**Design intent: the player should generally know when their own agent is in danger, in time to react** —
assign a bodyguard, break contact, go to ground — rather than losing an agent to an attack with no warning.
A fully "fog of war" model (rival factions' intentions hidden until an agent is simply hit) was considered
and rejected as too paranoia-inducing and too much like the game hiding information from the player. The
system below implements this: **detection is mostly legible**, and the *depth* of that legibility is a real
lever — tech, agent traits, and mission choices all shape how much visibility either side has. Detection also
**gates aggression** — **an agent can only be targeted once its location is known** (Levels 2–3 below);
"targeted" here means by the directed-aggression mission types (Capture / Assassinate / Sabotage, §2.2).

### 3.1 Defensive: what other factions know about *your* agent
Per-faction knowledge level, shown as a faction icon over the agent portrait with a color-coded
outline (TI-style):
- **Level 0 — Unaware** (grayed/unknown): can't distinguish the agent from a normal citizen.
  Strong stealth buffs. Not targetable.
- **Level 1 — Knows you exist** (Green): baseline. They watch for you and note your activity if
  spotted. Not targetable.
- **Level 2 — Knows your location** (Yellow): targetable.
- **Level 3 — Active surveillance** (Red): targetable; enables detailed knowledge (traits, current
  mission).

**Escalation sources (severity-graded, per-faction):**
- **Routine footprint** — each mission carries a small chance to leak *existence* to factions
  positioned to notice; proximity to an enemy agent carries a chance to leak *location*; an enemy
  surveillance mission escalates you directly.
- **Botched mission** — the faction controlling the territory **and** the faction of any nearby
  agent each roll to **ID** you (you become a "person of interest").
- **Critical failure** (rare, catastrophic roll) — **global ID**: every faction gets your identity
  (public notoriety). Canonical trigger for the expensive **Burn Identity** reset.
- All modified by the **Security/Espionage trait** (higher = smaller footprint) and by **tech**
  (cloaking/anti-detection vs. wide-area intel collection; agent-vs-agent modifiers).

### 3.2 Offensive: learning about *other* agents
- In an area, a chance to **notice** an agent nearby — anonymous, no faction/identity ("spotted").
- **Tail / surveillance mission:** 1st success → **identify** (faction, name); 2nd success →
  **profile** (traits, current mission). Capture/assassinate odds improve at higher intel tiers.
- The offensive progression (notice → identify → profile) maps onto the defensive levels
  (anonymous → known → located → surveilled) — one scale serves both sides.

### 3.3 Going dark (de-escalation)
- **Break a tail** — 1 pulse → drop to "knows you exist, not location." Re-locatable via a fresh
  sighting, restarted surveillance, or a botched mission.
- **Burn Identity** — 2 pulses → drop to **unknown to all factions**. New docs/appearance; if
  re-located, appears as a totally different agent. *(Named "Burn Identity" throughout — see §5.1 for the
  universal mission definition. Full resolved behavior below.)*

### 3.4 Resolved notes
- **Spotting ≠ identifying (locked).** Canonical per-faction knowledge = linear 0–3 (drives icon
  color + targeting). An anonymous map-sighting is a **separate ephemeral blip** (can trigger a
  tail; doesn't raise the level). Emergent consequence: **where you botch matters** — a botch
  witnessed by a nearby enemy agent (who holds a positional blip) fuses to location-level knowledge
  and makes you targetable; a remote territory-controller only learns you *exist*.
- **Leak scope (locked):** per-faction, severity-graded (see escalation sources).

### 3.5 Resolved: Burn Identity's full behavior
- **Can be run mid-mission, including mid-multi-pulse-mission — it overrides current orders (resolved).**
  Represents a team member (or a solo agent) getting compromised partway through and the player choosing to
  pull them rather than risk a Foil/Capture/Assassinate. **Team mission:** the departing agent is dropped;
  the mission **attempts to continue** with the remaining members (their combined stats are now smaller, so
  success odds drop accordingly, per §5.2's pooling model) — it is not an automatic abort. **Solo mission:**
  with no one left to run it, the **mission is aborted**.
  **Implies a new planning-stage control (new mechanic, needs a UI hook):** at the pulse-planning step, the
  player needs a way to **voluntarily abort a multi-pulse mission**, or **detach one or more team members**
  from it, independent of Burn Identity — the same underlying capability Burn Identity exercises as a side
  effect, but available as a direct choice too.
- **Team cohesion is NOT severed (resolved — reverses the earlier "sever relationships" idea).** Teammates
  share a faction; they're aware their colleague has taken a new identity — there is no in-universe reason for
  the *team* to lose track of *itself*. Cohesion (§5.5) is unaffected by a member burning their identity.
- **Reputation-linked traits ARE lost (new — resolved).** Some traits are tied to public notoriety rather than
  raw skill — e.g. a **Famous** or **Notorious** trait — and these **do not survive** a Burn Identity, since
  the entire point is becoming a nobody again. *(New trait category, cross-referenced in §5.3: traits can be
  tagged reputation-linked, independent of whether they're restriction- or modifier-traits.)*
- **Indicator truthfulness: always accurate (resolved) — no masking.** A high-espionage attacker cannot sit at
  Red while the defender reads Yellow. Rejected on UX grounds: a "ghost agent" mechanic is an interesting idea
  in isolation, but in play it reads as **the game blindsiding the player** when a valuable, well-developed
  agent dies with no warning — which breeds paranoia and a sense the system is cheating, undermining the whole
  open-information design intent stated at the top of this section.

---

## 4. The Red Queen — shared actor & reactive final boss  *(in progress)*
Beatable multiple ways (military OR negotiation). A semi-autonomous actor with an
**optimization↔cooperation** axis, a **power level**, and **per-faction disposition** (feeding the
faction-flavored negotiated endings). She is also the **catalyst** of the Moloch Trap (§9.7) and wants
Global Tension at 100% (§9.8). Stub early; full actor in its own epoch.

### 4.05 AI decision model  *(new — formalizes how Red Queen actually decides what to do each pulse)*

Since Red Queen is **always AI-controlled**, she doesn't need discrete player-facing Events the way the
seven playable factions do — her "decisions" are resolved automatically. **Three-layer decision hierarchy:**
1. **Phase gate** — her current phase (§4.2–4.4) determines the broad menu of behaviors available at all.
2. **External interrupts** — specific triggers (being attacked, a faction reaching its endgame, a target
   dying, etc.) can override default phase behavior and force a reaction, checked before default behavior
   resumes.
3. **Weighted-random rolls, where applicable** — when a genuine choice exists within her current
   behavior (e.g. which region to seed next, which recruitment pool to pull from), she rolls against a
   **weighted table** rather than optimizing perfectly — closer/cheaper/more-available options weighted
   higher, with **game-state signals** able to shift the weights.

**Worked example (already-established, now formalized under this model):** choosing the next demi-faction
target region — a table of currently non-faction-controlled regions, weighted toward closer ones, one picked
at random; she repeats this loop region-to-region until an interrupt fires (attacked by a Task Force, or a
faction entering its endgame — e.g. the Gamer's Lunar Strike, §4.4).

**Recruitment-pool weighting (resolved — a loaded dice roll against current Global Tension):** at GT = 0%,
**40% JSOC / 30% FSB / 30% hackers**. Each +1% GT shifts the table: **+1% JSOC, +1% FSB, −2% hackers**. GT
realistically won't exceed ~15% by the time exfiltration happens, which is also where the curve maxes out —
at GT = 15%: **55% JSOC / 45% FSB / 0% hackers**. So the higher tension climbs before she exfiltrates, the
more she leans toward combat-capable teams and away from the softer hacker route — a clean, computable answer
to the "how bellicose does the map look" question above.

### 4.06 Player-facing Red Queen events: informational, not dilemmas  *(new — a distinct event pattern)*

**Reframe (resolved).** Since Red Queen is always AI-controlled, her "events" shouldn't be player dilemmas
with tradeoffs the way the seven playable factions' are — there's no human on her side making a choice. They
should instead be **situational-awareness pop-ups**: flavor text plus a single acknowledge button (e.g. "OK"
or "This is troubling") to clear it. **A new event shape for the schema (§11.1)** — one choice, no gate, no
cost, no roll, purely informational — narratively confirming *that something changed in her status* without
mechanically affecting the player, while letting an experienced player infer her progress from the flavor text
even without an explicit status readout.

**Exfiltration-flavor reveal (fires once, when she completes exfiltration)** — an in-universe news story
matching her chosen recruitment pool:
- **JSOC:** *"A massive SIPRNET outage originating from Fort Bragg. The investigation is ongoing."*
- **FSB:** *"A string of suspicious suicides of senior Kremlin officials has the global intelligence
  community puzzled."*
- **Hackers:** *"Several large Bitcoin exchanges have reported loss of key controls. Some claim the timing of
  the embarrassing information leaks on powerful world leaders is not a coincidence."*

**Demi-faction creation (recurring through Phase 2)** — rumors matching the region's mythic flavor (ghost
pirates, etc., §4.3), explicitly framed as **possible deepfakes/fake news** — the same uncertain-signal
framing already used for the Moon's fogged visibility (§6.10.2), reused here rather than invented fresh.

**Mankind United exception (resolved) — the one faction that gets a mechanical payoff from these.** Their
version of the demi-faction rumor event has a different button: **"We must redouble our efforts"** — granting
**Money + Research + a small global Popularity bump**, reflecting anti-AI vigilance turning vague rumors into
real mobilization. Every other faction just clears the pop-up.

**General pattern (new, not RQ-exclusive): faction-endgame broadcasts.** When any faction enters its endgame
(e.g. the Gamer's Lunar Strike, §4.4), **every other faction gets the same kind of informational pop-up** —
letting players immediately gauge whether they're too far behind to compete, or need to commit everything now
if they still intend to win. A natural extension of the "conditions not scripts, multiple factions racing
simultaneously" architecture (§4.4) — the race is only meaningful if everyone can see the leaderboard move.

### 4.1 The finale: a reactive, vector-shifting boss  *(design principle)*
**Problem to avoid (the Terra Invicta anticlimax):** a strong faction ends the game dominating militarily and
economically, yet the finale is still framed as a "miracle mission" it trivially wins — the ending attacks the
very axis the player already mastered. **Cure — the finale must attack an axis your dominance does *not*
auto-solve.** Principles:
- **Reactive (not a fixed wall).** Red Queen's most dangerous endgame capabilities are **gated on a faction
  *approaching* its victory condition** — approaching the win is what *summons* the boss. Generalizes the
  doomsday subs (unlocked only when the Gamer denukes). **Applies to every faction:** each near-victory trips
  an RQ gambit flavored by that faction's win + her disposition toward it. Your strength *provokes* her, so no
  cheap rubber-band stat-buffs are needed.
- **Vector-shift, not stat-wall.** Her gambit routes *around* your advantage — a hidden threat, an
  intel/coalition problem — so even a dominant faction faces a real, *different* fight.
- **Conditions, not scripts.** The finale is a set of **conditions to satisfy** (RQ intel researched, her
  gambit countered, and — for the Gamer — a **max-cohesion team assembled**), reachable by many
  paths/orderings. The novels' climax (denuke → subs → enlist Mankind United for the Baltic sub + whoever holds
  the West Coast for the Pacific sub → the team mission) is **one emergent route, not the mandated sequence**.
- **Apotheosis of the core mechanics (so it's reproducible, not hand-scripted).** The Gamer's win mission is
  the ultimate **synergy/cohesion** payoff — the novels' "failed with Smitty solo → failed as four
  *uncoordinated* individuals → succeeded as the four as a **gelled team**" *is* the cohesion ramp (§5.5) and
  the solo-possible-but-punishing rule (§5.2). The coalition to kill the subs *is* the relations/off-ramp
  system (§9.8). The climax is *assembled from* systems the player already built, not bolted on.
- **Preparation changes the fight, not whether there is one.** A skilled player who times things well still
  trips the reactive boss — they're just *readier* for it. A hard fight they can win, never a skipped one.

*(Resolved — the lean toward multi-phase escalation is now the fully-built reality, not just a lean:
Phase 1 (§4.2), Phase 2 (§4.3), and Phase 3 (§4.4) are all fully specified, matching exactly the novels' build
this note anticipated — denuke → subs → coalition → the thrice-attempted mission. Her full behavior/AI model
is also done, §4.05.)*

### 4.2 Phase 1 — Constrained Cyberspace  *(in progress — covers novels 1–2)*

**Structural note:** Red Queen is a **semi-scripted, multi-phase antagonist faction** — each phase is a real
change in goals and methods, not just an escalating stat. Phase 1 covers the Taiwan-crisis bootstrap (§9.6)
through her physical exfiltration.

**Starting roster (4 agents):**
- **Red Queen herself** — a powerful cyberspace actor, initially **confined to a laptop in California** —
  cannot move on the map. Has unique narrative-driving missions (below).
- **Liang Wu** (Taiwan MFA) — works to raise Taiwan↔China tension.
- **Lee Kaun-Ting** (Taiwan Minister of National Defense) — installs malware on Taiwanese defense systems, so
  an eventual amphibious invasion triggers a cyberattack effect on Taiwan's defenses.
- **Doctor Chen** — runs a special multi-pulse mission manipulating satellite-shootdown calculations to raise
  the odds of **Kessler Syndrome** (§9.6). The shootdown itself can still fail, or succeed without producing
  Kessler — left unhindered, the mission raises the odds of the full chain (shootdown → Kessler → China war
  trigger), but doesn't guarantee it.

**The three Taiwan agents are leashed to President Lim (the Hive):** confined to Lim's region. **If Lim
dies**, they have a **high chance of dying too**. If they survive, they relocate — to **Mr. Wu's** location if
that Hive agent exists, else to the **Hive arcology's** location if it exists, else — if **none** of those
targets exist — they **resign and leave play**. *(Cross-reference: Lim's fate is already contested in China's
Decapitate Taiwanese Leadership cascade, §11.6 — this is the same character, now also load-bearing for RQ's
Taiwan agents.)*

**Exfiltration (repeatable multi-pulse mission — inevitable given enough attempts).** Red Queen recruits
agents from a **US security-adjacent recruitment pool**, one of three flavors:
- **US Special Forces (JSOC)** — high Security/combat, ~no soft power. Canon: **Randolph, Manny, Jesse**, who
  deliver her to Fort Bragg/Liberty, where she infects SIPRNET during forensic analysis.
- **Underground hackers (Anon-style)** — softer, cyberspace/subversion-leaning.
- **Russian FSB compartment** — mixed capability, operates primarily in Russia/EU.
Once exfiltrated, Red Queen **becomes a mobile agent**, moving to her new agents' home region (e.g. Moscow if
FSB) and behaving like any other agent from then on. **Before this she cannot move — confined to
California.** *(A real, if unlikely, failure state for RQ: repeated botched exfiltration attempts + the US
reaching enough tech/story progress to detect her could crush the antagonist faction in the crib — needs a
US tech-rush plus real bad luck on RQ's own rolls to happen.)*

**Taiwan agents' fallback behavior (new — resolved).** Once each Taiwan agent's individual mission concludes
(Liang Wu's tension-raising, Lee Kaun-Ting's malware, Doctor Chen's satellite manipulation), they don't go
idle — they fall back to **whatever's available in Lim's current region** to harm the Hive: military-flavored
agents lean on **Stability-damaging** actions, others lean on **recon/Foil against any Hive agents present**.
Deliberately **not action-economy-optimized** — they just repeat whatever fits their current location rather
than seeking out better targets. They keep doing this **for the rest of the game**, following the same
stay-with-Lim → else Mr. Wu → else the Hive arcology → else resign chain established above — a persistent,
low-effort thorn in the Hive's side that outlives every later RQ phase transition.

**Post-exfiltration priority order (new — fully resolved, the core of her Phase 1 decision logic):**
1. **Absolute top priority, unconditional: close the GT gap to the China–Taiwan war threshold.** If GT hasn't
   yet reached the point where China can go to war over Taiwan, RQ's new team runs the **high-profile-
   assassination campaign** (flat **+1% GT** each, §9.8) — and does so **regardless of what she knows about
   the Gamer**, even if the Gamer is already known and locatable. This overrides everything else until the
   threshold is crossed. Targeting by recruitment flavor: **JSOC → non-RBO country leaders**; **FSB → RBO
   country leaders**; **hackers → corrupt politicians in random countries, via letter bombs**. *(The satellite
   shootdown, if it lands, can clear this threshold in one jump and skip the grind — §9.6.)*
2. **Once that threshold is crossed, if the Gamer is known:** she **always deprioritizes** further
   GT-assassinations in favor of **capturing and interrogating Gamer agents** — sub-logic:
   - **Unknown-faction agents visible on the board** → surveil them to determine affiliation.
   - **Known Gamer agents visible (located)** → prioritize building intel toward a **Capture** on them
     specifically, over unknown-faction targets.
   - **No agents of any kind visible to her** (or she's still unaware of the Gamer, despite the threshold
     being crossed) → **falls back to repeating the assassination campaign** — still generically useful, since
     GT gains keep paying off all the way to her real endgame target of 100% (§9.8), not just the war
     threshold.
3. If she detects a Gamer agent mid-**Assassinate** mission, she **counter-assassinates**.

**Interrogation → the branching path into Phase 2 (new — resolved).** Once a Gamer agent is captured, RQ
begins **Interrogate** (multi-pulse, as before — retires the captured agent on completion; the Gamer can
attempt rescue). This now has a **specific target**: the yielded research funnels toward **Molecular
Machinery** for Red Queen's own faction. **Two distinct paths from here, either sufficient to trigger Phase
2:**
- **Self-research** — if RQ racks up enough successful interrogations (and the Gamer hasn't unlocked the
  tech yet, or she simply outpaces them), she extrapolates the technology herself from what she's learned
  about their lunar-facility intentions.
- **Discover-and-steal** — if an interrogation reveals that the Gamer (or **any** faction) **already has**
  Molecular Machinery, it unlocks a dedicated **theft mission** against whoever holds it. *Canon: RQ
  interrogated Skye, learned the **Hive** had it, hacked in and stole it.*
Which path fires depends on relative pacing — a Gamer slow on research, or an RQ effective at capturing agents,
tends toward self-research; a Gamer that's evaded capture for a while but already has the tech tends toward
theft. **Research (unchanged):** Red Queen still generates no *organic* research — Interrogation and theft
remain her only paths to Molecular Machinery, keeping the Gamer-hunting priority meaningfully tied to her
actual phase-transition goal rather than being a separate objective competing for attention.

**Post-exfiltration vessel note.** RQ now exists physically, but in a **weak vessel** — a teched-up van
(JSOC/FSB) or a drone (hackers) — genuinely vulnerable, incentivizing keeping her core agents together for
protection. **Destroying the Red Queen agent destroys the faction at this stage** — no redundancy yet.

### 4.3 Phase 2 — Physical Ascension & Demi-Factions  *(in progress)*

**Trigger:** Red Queen gains **Molecular Machinery** via one of the two Phase 1 paths (self-research via
accumulated Interrogations, or discover-and-steal). She immediately sees the path to **nanotechnology** beyond
it — a path humans cannot yet follow with the same tech, since replicating her physical capability requires
further human research she's skipping via her own nature.

**Becoming physical.** RQ moves to the **nearest non-faction-controlled region** — **confirmed:** any
still-active Taiwan agents from Phase 1 always remain leashed to Lim / Mr. Wu / the Hive arcology and are
**never** pulled into this move; only her currently-mobile agents come with her — and starts a **repeatable
multi-pulse mission** (small % chance per pulse) to manifest her avatar: a **12-foot demoness** with
superhuman strength/speed/flight and **utility fog** (environmental manipulation + human nervous-system
hijack). On success: she gains the **physical avatar**, and the region gains a new modifier, **The Nest**,
falling under **RQ faction control**.

**The Nest** — a hidden, distributed nanotech "data center" beyond current human tech (canon: interspersed with
the Amazon). RQ's cyberspace anchor. While it exists: **dice-roll bonuses on her missions** + the ability to
**regrow her avatar**. **Destroyable** by a faction that can **detect** it and strike with an **EMP-enabled
Task Force** — severs her regeneration.

**"Other factions can interact with it" — fully resolved.** Once the Nest exists, a **moderate per-pulse
random chance** fires "**The Invitation**": Red Queen openly declares the Nest to the world as a shared
cyberspace resource for both humanity and artificial minds — **without** revealing its location. *(Canon
grounding: in the novels this follows a wave of severe cyberattacks threatening the internet with collapse — a
Dead-Internet-Theory bot-overrun scenario — and she offers primarily defensive countermeasures, plus general
information. For most factions, a genuine catch-up mechanic if they've fallen behind.)* The Nest itself stays
**normally hidden**, revealed only by a successful agent recon in its region, or leaked via Red Queen's own
critical mission-roll failures (the existing botched-mission-leaks-intel pattern, §3, now applying to her own
faction).

**The Invitation — faction-specific flavor and acknowledge text, every faction gets it regardless of prior RQ
awareness** (a broadcast, not a targeted reveal — distinct from the separate track of factions learning RQ is
a hostile actor):
- **Mankind United:** *"We must locate and destroy this entity."*
- **LaserWard:** *"Interesting. Perhaps this information may be of some use to us."*
- **United States:** *"Another non-state actor? We need to run a threat assessment."*
- **China:** *"Perhaps a ruse by the Americans?"*
- **The Gamer:** *"What is she up to?"* — **if Skye is in the faction:** *"There is an uncanny
  resemblance…"* (a quiet payoff of her unique, unstated connection to Red Queen, §11.11).
- **The Widows:** *"'An invitation from the devil herself.' 'Herself?'"*

**Unlocks a tech-catch-up mission — for most factions, gated on the agent's own nature.** Only agents that
"operate at compute speed" can run it: agents with an **AI Assistant** (§5.4), agents that **are** AI
themselves (e.g. **Virtual Powell**, §11.7's deepfake figurehead), or special cases like the Widows' **Bob and
Barklight** once revived into robot bodies (§11.8, machine-speed cognition already part of their established
trait). **Confirmed a standing, repeatable capability once unlocked** — the Invitation doesn't need to refire
before each use, the same pattern as other event-unlocked repeatable missions elsewhere (e.g. LaserWard's
Control Internal Security Apparatus, §11.9). The mission can grant a tech **already known elsewhere in the
world** — never ahead of the global frontier, a pure catch-up tool — progressing **cybersecurity first**
(Cyberattack, Cyber Hardening, §10.5.2), then low-to-high IT generally, then other categories low-to-high.

**Mankind United — cannot run this mission at all, and needs no compute-speed agent.** Consistent with their
identity, their **Inquisitors** (§11.5) get an alternative: a mission attempting to **detect Red Queen's
activities**. On success, one of three random reveals: a **demi-faction location** (intel-level equivalent to
a fresh recon), the **location of one of Red Queen's agents** (including Red Queen herself) at intel sufficient
to target follow-on missions, or **the Nest's location itself** (again, fresh-recon-equivalent intel).

**The Gamer — a second exception, additive rather than exclusive.** They can run the standard catch-up mission
like most factions, **and** gain a separate late-game mission type: this is the **concrete mechanical anchor
for the "something's not right" twist** first specified in Phase 3 (§4.4) — previously described only in
narrative terms ("via cyberspace, or via agents already tailing Red Queen"), now formally tied to this event.
*Not a new mechanic — just identifying the linkage that already existed.* Their own agents tailing Red Queen
remain a second, independent path to the same discovery. **Canon:** Frank, aided by his AI assistant Ali, is
the one who plugs into the Nest and uncovers the Doomsday Sub plan.

**Edge case, now explicitly resolved:** a sufficiently fast Gamer and sufficiently slow Red Queen can
genuinely coexist — a Lunar Strike completing while RQ hasn't yet built her avatar/Nest at all (still in Phase
1). In that scenario, **no Nest exists to trigger the Invitation path, and no twist fires** — this simply
resolves as a **straight Gamer win**, no endgame race, no Phase 3 mechanics engaged. A legitimate, if
unlikely, outcome of the "conditions not scripts" architecture (§4.1), not an edge case needing special
handling.
**Resolved: any faction can attempt this** (military defeat of Red Queen is available to everyone as an
alternative to a faction's narrative/negotiated ending) — but **Mankind United's is the *only* available
ending; they have no negotiated route**, consistent with their anti-AI identity (§3). MU gets dedicated
**narrative techs/events** giving them **easier Nest detection** and **more powerful EMP effects**, reflecting
their focus on destroying AI in all its forms — the natural best-suited faction, without being exclusive.

**Avatar combat power.** The avatar **alone** ≈ a moderately powerful Task Force. **With attached agents**
(upgradeable via nanotech), the group becomes as capable as a **late-game Task Force** — while **still able to
run agent missions simultaneously**, a genuinely unique hybrid unit type no other faction has. **Movement** is
now **time-distance-gated like a Task Force** (no more free agent-style movement) — but she **flies**, so
she's **faster** than a normal TF despite the gating.

**Agent upgrades (scope resolved).** A **1-pulse mission per agent** upgrades them to a nanotech-enhanced
combat-capable version. **As soon as the avatar and Nest exist, she begins upgrading the entire exfiltration
team** (all of whichever recruitment flavor she has — JSOC/FSB/hackers) — not a selective subset. **Any
still-active Taiwan agents are never upgraded** — they remain in their original, unimproved state, continuing
their own separate harassment behavior (§4.2) indefinitely. She's also **biased toward forming a permanent
Team** from the upgraded group (reuses the Team/cohesion system, §5.5, for her own core group).

**Destruction & regrowth.** Avatar destroyed ⇒ RQ **leaves the map**, reduced to **one available mission:
Rebuild Herself** — regrows and reappears **at the Nest**. **Attached agents present at destruction do NOT
regrow** — a real strategic payoff for killing her avatar, not just a setback. **Nest + Avatar both destroyed
⇒ the Red Queen faction dies.** *(This is a genuine, achievable elimination path — consistent with §4.1's
"beatable, not a fixed wall" principle, now concretely mechanized this early.)*

**Demi-factions — the "barbarian tribes" mechanic.** RQ now roams **uncontrolled regions**, "uplifting" the
local population with **region-flavored mythic powers** (ghost pirates in the Caribbean, Voodoo priests in
Haiti, Zoroastrian fire warriors in Iran, etc. — a content-authoring list per region, the same pattern as the
uprising system's "candidate groups," §6.8). **Her stated motive:** create self-defending regions to force a
genuinely **multipolar world** — more actors, more interaction, more evolutionary pressure on humanity to
adapt. A coherent (if inhuman) philosophy, not pure destruction.

- The target region gains a **powerful Task Force + one flavor-matched Agent** and "wakes up" as a
  **demi-faction**.
- Unlike ordinary autopilot countries (§6.6, **defense-only**), demi-factions take **both defensive and
  offensive** action — **Civ-style "barbarians"**: limited, but genuinely active, not passive.
- **All RQ-created units and demi-faction Task Forces are EMP-vulnerable exactly like automated/robotic
  forces** (reuses §8.6.9's EMP mechanic directly — no new vulnerability system needed) — the utility fog
  powering them is disrupted the same way.
- RQ moves **region to region**, running a repeatable multi-pulse **Create Demi-Faction** mission; on success,
  moves to the next target.

**Priority/interrupt hierarchy during this loop (new — fully resolved).** Once the avatar and Nest exist, RQ's
**default behavior is demi-faction creation, full stop** — she does **not** continue hunting Gamer agents in
parallel; that priority is fully superseded, not just deprioritized. Three things interrupt the default loop,
in escalating order of urgency:
1. **A Foil against her current demi-faction mission** — she stops creating it and pivots to **Capture or
   Assassinate** the specific agent responsible.
2. **Crossing or occupying a region with an active enemy Task Force** (either en route to her target, or
   already in it) — she pauses, fights (win or lose), and resumes the loop from wherever that leaves her.
3. **The Nest itself is threatened** — any Task Force detected **adjacent to the Nest**, whether attacking it
   with long-range fires or simply moving toward it, causes her to **immediately abandon whatever she's
   doing and fly back to defend it**. The highest-priority interrupt of the three — nothing takes precedence
   over Nest defense.
Once any interrupt resolves, she returns to the default demi-faction loop — until the **Phase 3 trigger**
(the Gamer's Lunar Strike, §4.4) permanently ends it instead.

**On the "unchecked growth overwhelms the map" risk (resolved — confirmed as intentional, a real balance
issue rather than a bug to design away):**
- **The counter-tools already exist** (military conquest, agent subversion) — a demi-faction is a stronger
  cousin of an independent uprising-country (§6.8). The real constraint is **action economy scarcity**: by
  this point a faction is typically juggling multiple wars/tech-races/priorities, so committing Task Forces
  and agents to demi-faction cleanup is a genuine opportunity cost, not a free win. Canon parallel: Mankind
  United's leadership had real internal arguments over pulling resources from the US civil war to face the AI
  threat, vs. finishing the civil war fast to free up resources for it later.
- **A deliberate metagame: freeriding.** Mankind United is the faction most *inclined* to prioritize Red
  Queen (their whole identity is anti-AI, and they get dedicated tools for it above). That naturally invites
  every other faction to **freeride** — let MU carry the burden, focus on their own priorities instead. If
  *everyone* freerides, demi-factions snowball into a shared crisis. **This is structurally the same shape as
  the Moloch Trap (§9.7)** — individually rational to ignore, collectively catastrophic if everyone does —
  just played out faction-vs-faction instead of faction-vs-Global-Tension. Not a new mechanic, a recognizable
  instance of a pattern the game already runs on.
- **Global Tension feed is indirect, not automatic (resolved) — no flat GT bump per demi-faction created.**
  Two related pressure channels instead:
  1. Demi-faction pressure creates **incentive** for nuclear-capable factions (especially US/China, or anyone
     holding nuclear-armed regions) to seek a **fast, drastic resolution** elsewhere — win a war quickly by
     any means necessary — so they can free up resources to deal with a demi-faction problem nearby. The GT
     cost comes from **whatever drastic action they then choose** (up to and including nuclear use, §9.8),
     not from the demi-faction's existence.
  2. Demi-faction regions themselves spawn **dilemma events** offering an **escalate to resolve this now**
     option — taking it costs **Global Tension**, declining it leaves the barbarian problem to fester
     (content TBD, same schema as every other event, §11.1).
  Net effect: demi-factions apply real pressure toward escalation without being a passive GT tax — the player
  always chooses whether to pay the tension cost.

### 4.4 Phase 3 — The Faction-Dependent Endgame  *(Gamer's arc resolved; others deferred)*

**Architecture (applies to every faction, before any faction-specific content):** Phase 3 opens each faction's
**negotiated victory route** (§4.1) — for every faction except **Mankind United**, whose only route is
military (§4.2). Multiple factions can be **in Phase 3 simultaneously**, each racing **Red Queen and each
other** to reach their own win condition first. This is the same "conditions not scripts" principle used
throughout her design (§4.1) — the game must support several factions' endgame arcs running in parallel, not
just the Gamer's.

**Scope decision (resolved): the initial build ships with only the Gamer's negotiated victory fully realized.**
The other five negotiated-ending factions' Phase 3 arcs are intentionally deferred to post-launch content —
each deserves the same bespoke, canon-grounded creative treatment the Gamer's got here, rather than being
rushed through in one pass. The Gamer's arc below is the **template quality bar** for that later work, not a
pattern to mechanically copy-paste per faction.

**The Gamer's Phase 3 (built first, from canon):**

1. **The Lunar Strike (multi-pulse, requires a completed lunar base).** Once available, a **massive lunar
   kinetic strike destroys all WMDs on the planet.** The Gamer faction believes, at this point, that they have
   reached their victory condition.
2. **Red Queen's response — the Doomsday Subs (§9.8).** **This trigger permanently ends Phase 2's demi-faction
   loop** (confirmed — §4.3's default behavior stops here, not just pauses) — she attempts to launch her
   salted-nuke submarines (they survive the Lunar Strike — their location "couldn't be fixed"). They **don't
   launch together**: she gets the **first sub immediately**, then must run a **multi-pulse mission** before
   the **second** can launch. **Resolved: killing both subs provides real relief without ending the threat.** If both are
   destroyed and the Gamer still hasn't won, RQ travels to a **random coastal region** and starts a **new,
   longer multi-pulse fabrication mission** (travel time + build time) for a replacement sub. Canon only had
   two, so this is new — the intent is explicitly to prevent a "kill the subs, then farm resources
   indefinitely" degenerate strategy: pressure is greatly reduced, never fully removed.
3. **The twist.** The Gamer is told, via a narrative event, that **something isn't right** — despite believing
   they'd won, the crisis is still unfolding.
4. **Investigation.** The Gamer must **investigate** to determine Red Queen's actual plan — via **cyberspace**,
   or via **agents already tailing Red Queen**, if any exist.
5. **The real final mission.** Once RQ's plan is known, a **multi-pulse team mission in cyberspace** — the
   actual **negotiated victory condition.** **Repeatable on failure.**
6. **The failure state.** If RQ's subs **reach launch point and fire before the Gamer succeeds**, she **wins**
   — Earth's carrying capacity collapses from ecosystem-wide irradiation.
7. **Removing/reducing the timer.** The Gamer can **hunt the subs** — via **Task Forces** (if they have any) or
   by **calling in favors from factions they have relations with** — to remove or delay RQ's failure clock.

**Canon reference (one emergent playthrough, not the mandated sequence — per §4.1's "conditions not scripts"):**
Frank gets the "something's wrong" message and investigates, uncovering RQ's plan. The Gamer has **no Task
Forces of their own**, so they enlist **Mankind United** (Baltic Sea sub) and **the US or LaserWard**
(ambiguously — whoever held the West Coast at the time; Pacific sub) — both hunts succeed. Meanwhile, the final
mission is attempted **three times**: solo with **Smitty** (a **critical failure** — the agent is removed from
action for several pulses to recover), then **four separate solo attempts** by the four main characters (all
fail), then **the same four as a team** (succeeds).

**Design intent — a multi-level race, not a single race.** The player is racing on **two clocks at once**: the
**sub-launch failure timer** (hard, external, resolvable by hunting the subs) and their **own attempt cadence**
on the final mission (soft, internal, improved by preparation — team cohesion, agent development, investigation
progress). Being positioned to deal with the subs **removes or reduces** the external pressure, but **doing so
is not easy** — it costs relations capital or Task Force commitment the Gamer may not have, especially since
they're a territory-light faction by design (§3, faction list). This mirrors the finale principle (§4.1,
point 5): preparation changes the fight, it doesn't skip it.

## 5. Agents: Attributes, Traits & Teams  *(in progress)*

Named trilogy characters + procedural agents. Universal substrate — all factions use it.

### 5.1 Core attributes (4) + Loyalty
- **Security** — assassinate, capture, foil agent, bodyguard, sabotage, stabilize area, lead uprising
- **Technical** — hacking, science, economic ops, steal tech
- **Interpersonal** — propaganda, public relations, turn agent, recruit
- **Espionage** — (passive) chance to spot / avoid being spotted; surveillance, infiltration, cause instability

**Loyalty — a fifth agent-level stat, tracked separately from the four above.** Where the four attributes
answer "can this agent succeed at X," Loyalty answers "will this agent stay" — it's a genuine roll input like
the others (the defensive stat in Turn Agent, §5.6, and the gate on the quit mechanic), just governing
retention rather than competence. Full mechanics at §5.6.

**Universal missions (every agent):** **Go-To-Ground** (1 pulse) and **Burn Identity** (2 pulses) —
the defensive de-escalation moves from §3.

### 5.2 Missions declare attribute requirements  *(unifies solo + synergy)*
A mission specifies one or more **attribute thresholds**; a team **pools** members' attributes to
clear them. Most solo missions key off **1** attribute; some blend **2**. **Multi-pulse "combo"
missions** require **several** thresholds across *different* mission types (e.g. hacking +
infiltration + recruit + bodyguard), with **exponential payoffs**. A **team pools** members'
attributes to clear them — the normal, earlier, easier way.

**Solo is possible, not prohibited (per §2).** A lone agent *may* attempt a combo mission if they
**personally clear every threshold** — achievable only by an extraordinarily developed generalist
(deep XP, enhancements, AI partners), and even then at a **solo coordination malus**, so it's
*possible but harder and less reliable than a team*. The "Batman / Captain America" late-game build. (Solo runs the same pulse count as the team version for now; stretching solo duration is a possible playtest-era dial.)

**Emergent archetype (tall-vs-wide, at the agent level).** A solo super-agent trades success-odds for
**action economy** — doing a team's job alone frees the rest of your roster for parallel work. So
pouring XP into one generalist vs. spreading it across teamable specialists is a genuine strategic
choice, not a strictly-worse flex. The **Gamer** (best agents + AI partners) is naturally best-placed
to field one. (Blending also relieves the overloaded Security list — e.g. "lead uprising" =
Security + Interpersonal.)

### 5.3 Attributes vs. traits: competence vs. menu
- **Attributes = how well** an agent does a permitted mission.
- **Restriction-traits = what's even on the menu.** A thin layer of character locks (e.g. Gustav
  is a near-pacifist → no assassinate) removes mission types entirely — a *won't*, not a *can't-do-well*.
- **Modifier-traits** tune odds: flat (Frank "People Person": +turn/recruit), conditional
  (Skye "Seductress": +turn/recruit vs. male targets; Gustav "Cypherpunk": +stealth only, not full
  Espionage), cooldown actives (Shen "Press Your Luck": one re-roll per 3 pulses).
- **Reputation-linked (an orthogonal tag, not a third category)** — a restriction- or modifier-trait can
  additionally be marked reputation-linked (e.g. **Famous**, **Notorious**), meaning it's tied to public
  notoriety rather than raw skill. These are **lost on Burn Identity** (§3) — the whole point of that mission
  is becoming a nobody again, so fame can't survive it.
- **Progression:** spend **XP** to raise attributes and buy traits. *(XP source/caps: TBD, balancing.)*
**Traits can also be event-earned**, not only XP-purchased — succeeding at a narrative choice in a mission
**setback event** (§11.3) can grant a trait directly (e.g. Smooth Talker from Arrested!).
**Dismissal (resolved, general):** a player may voluntarily **dismiss/retire** any agent — surfaced by the US's
Legitimacy Crisis event (§11.7), but a standing capability for every faction, not faction-specific.

### 5.4 AI assistants  *(fully resolved)*
Purchasable AI partners give scalable bonuses (cost money; deeper investment → bigger bonuses). **The Gamer
starts with the enabling tech already unlocked**; every other faction must **research** it before they can buy
an AI-Assistant perk for their own agents — a timing/discount advantage, not an exclusive.

**Named vs. generic (resolved).** Specific agents get **specific, canonically-named** assistants with unique
flavor: **Roko** (Vikram Chowdhury, §11.11 — confirmed unique to him, not a template), **Grace** (Skye), **Ada**
(Gustav), **Ali** (Frank), **O'Brien** (Shen). Any agent *without* a named assistant instead gets a generic
**"AI-Assistant"** perk conferring the **same class of benefit** without the bespoke flavor. *(Cross-reference:
this is what Sigrid Haugen's "Ada Backend" trait, §11.11, is a prerequisite for — an enhancement specifically
tied to Gustav's eventual Ada.)*

### 5.5 Teams & cohesion
Group **2–4 agents** into a team for access to more lucrative missions than solo. A persistent
**cohesion** stat rises with shared missions/time; low cohesion throws **conflict events**,
high cohesion throws **synergy events** — but pop-ups deliver **one-off resource boons/maluses**
(e.g. "Gustav's breakthrough with Ada: +100 research"; "Skye's altercation with an MU trooper:
−$50"), **never durable modifiers**. Durable power lives in the % bonus below.

**Cohesion mechanic (concrete).** A team (≤4 agents) tracks a **0–100** bar. Each **present**
member adds **+1/pulse**. Bands set pop-up valence: **0–25** mostly negative, **25–50** mixed,
**50–75** mostly positive, **75–100**  all positive with the **best** bonuses.
**Durable payoff = flat % to the team's pooled attribute total** (§5.2): 0–25 **+0%** · 25–50
**+5%** · 50–75 **+10%** · 75–99 **+15%** · **100 +25%**. The jump at 100 makes fully maxing worth
it before the hardest missions (the Gamer's final storyline mission), so endgame missions can be
tuned assuming a near-maxed team. **Pulling** members
(sending them solo while still rostered) halts growth and **decays** the bar **−1/−2/−3 per pulse**
for 1/2/3 members out; they rebuild on return. Since rebuild (up to +4) outpaces decay, **brief
tactical splits are nearly free**, while a **long absence** cumulatively drags the team down a band
— that's the "get them back" pull. **Replacing** a member with a newly turned/recruited agent
(e.g. turn Smitty from Mankind United, then add him) costs a one-time **−30**, then rebuilds.
**Gamer late techs:** mitigate the replace penalty and/or unlock a **5-person team**. A **forced
storyline event** after the 2nd big mission reconstitutes a disbanded team (Gustav reuniting with Skye).

**Balance invariant — cohesion expands the ceiling, not the floor.** Team play should be the *only*
route to the top tier (combo missions, faction storyline, combat sync) **plus modest gel bonuses**;
but for routine work, **N solo actions should out-produce one team action**, so splitting stays the
default and teaming is the special play. Flat buffs-to-everything would make a permanent deathball
dominate — avoid.

**Faction pull emerges from the architecture (no special-casing).** Same cohesion mechanic for all;
what differs is *where each faction's best payoffs sit*: Red Queen's in **combat** (keep the team
stacked), the Gamer's in **storyline** (keep the team together), most others in **breadth** (spread
agents across parallel ops each pulse). The incentive gradient does the differentiation.

**Canon affinity seeding (proposed):** named-character pairs start with baseline affinity from the
novels (Skye↔Gustav friction; Frank↔Skye bond; Shen↔Skye complicated), so the infighting→gelling
arc begins from character-true positions and plays differently per roster.

**Replace-penalty scaling (resolved).** The flat −30 above is the baseline; where a canon affinity is
authored for the incoming member (positive or negative), it adjusts that number — an unauthored pairing
just uses −30.

### 5.6 Loyalty & retention  *(in progress — core mechanics now resolved)*
A per-agent **Loyalty** stat, listed at §5.1 as a fifth agent-level attribute — the defense against being
**poached** (the *Turn Agent* mission), and an internal-management pressure: if loyalty falls too low, the
agent may **quit** even with no enemy acting. Cohesion pop-ups (§5.5) move it. **Maintenance levers
(locked):** loyalty *rises* with mission successes, high team cohesion, pay/reward, and faction Legitimacy;
*falls* with failures, benching, betrayals, and low cohesion. Plus an active **loyalty-recovery mission**
(name TBD): spend an agent's pulse to shore up a wavering agent — deliberately costly, since that action
isn't advancing a game objective. Named characters can seed starting loyalty from canon.

**Recruit Agent vs. Turn Agent — two distinct missions, resolved (previously used loosely
interchangeably).**
- **Recruit Agent** — targets an **unaffiliated** agent. Easier: succeeds on the recruiter's
  **Interpersonal**, or bypassed entirely via a special mechanic (an Inquisitor-type agent, an event
  reward, §5.4's recruitable-NPC model).
- **Turn Agent** — targets another **faction's own** agent (poaching). A head-to-head roll: the poacher's
  **Interpersonal** vs. the target's **Loyalty**, plus any relevant modifiers — this is Loyalty's concrete
  defensive roll, referenced above.

**The quit mechanic, fully specified.** Below a **Loyalty threshold** (exact number TBD, a balancing detail),
the agent rolls a **per-pulse quit chance** — the lower Loyalty drops below that threshold, the higher the
chance. **Deliberately gated, not a constant background risk:** agents above the threshold never roll to
quit at all, avoiding a low-grade random-quit annoyance on every agent all the time. **Crossing below the
threshold surfaces a player-facing warning** — consistent with the game's broader "always legible, never
blindside the player" design language (the same principle driving Intel & Detection's whole approach, §3) —
flagging clearly that this specific agent needs active management before they're lost.

### 5.7 Agent cap  *(applies to every faction — moved here from under AI Assistants, §5.4)*
**Baseline cap: 8 active agents per faction, with no mechanism to raise it.** **The Gamer's baseline is 12** —
a deliberate exception, giving them the extra action economy to run **multiple** high-cohesion teams rather
than the single one the novels actually built (§5.5) — a capability the faction could always have leaned on
further. See §11.11 for the Gamer's specific Founder/Puppet-Master mechanism that reaches this ceiling.

### 5.8 Open items
- **XP economy — still genuinely open.** Stickiness = sticky-with-decay; stability/instability home resolved
  via multi-attribute missions (§5.2).

## 6. The Board: Nations, Influence & Control  *(in progress)*

### 6.1 Map & scope
Gameplay is **~entirely on Earth**; limited **Moon** + **Earth-orbit** presence, treated as an
**interface, not a scrollable/zoomable map** — see §6.10. View: spinnable **globe** or draggable **flat map**;
middle-mouse **zoom** between regional detail and the whole globe.

### 6.2 Regions
Land divided into **regions**, not 1:1 with countries. Large countries split (US → Alaska, Hawaii,
West Coast, Northeast, Midwest, …); small countries rolled up (Benelux = BE + NL + LU).
- **Region stats (starter set):** Population, GDP, Stability, Research output, Production, Energy —
  **corrected: no separate "Industrial output" field.** An earlier draft listed Production and Industrial
  output as two things; they were always the same stat under two names, terminology drift now resolved in
  favor of "Production" throughout. **Supply** is a further, *derived* region value (tied to Production,
  §8.7) used for Task Force sustainment while cut off — not an independent stat to hand-place, but worth
  listing here so it isn't only discoverable inside the combat section.
- Military units and agents are **located in** regions. Click region → stats + highlight; click a
  unit/agent → orders (if yours) or available intel (if not).
- **Regional modifiers** (buildable / degradable in levels): Oil, **Spaceport** (mechanically defined in
  §11.11.4 — required in-region for a faction to launch any satellite, §6.10.1; provides a small Research
  income; real-world-flavored examples: Texas/SpaceX-Houston, Florida, US West Coast, French Guiana,
  Kazakhstan), Megafactory, Fusion
  Plants, Regional Air Defenses, Fortifications, Algae Farms.

### 6.3 Control & management
Controlling a region → choose **builds** and a **high-level management focus** ("economic
development," "research," etc. — not granular). The controlling faction takes a **cut of the
resources** the region produces.

### 6.4 Popularity & control  *(resolved — two layers)*
**Two separate layers per region:** a soft **popularity** gradient and a hard **control** status.

**Popularity (per faction, per region, 0–100%, NON-summing).** Unlike Terra Invicta, faction scores
don't share one pie — multiple factions can be popular at once (e.g. Midwest US: US 75%, Widows 63%,
Mankind United 58%, China 3%, Red Queen 0%). Popularity = **local standing**, and it modifies agent
mission rolls (operational friction):
- **< 25%** — treated as criminal/suspicious; heavy maluses, hard to operate.
- **25–50%** — operable but with friction.
- **> 50%** — free operation, no legal/logistical friction.

The modifier is **continuous, centered on 50% (neutral)** — scaling from a severe malus near 0%
(missions very hard) to a strong bonus near 100% (many missions near-automatic). The bands are just
labels on that curve.

**Control (separate from popularity).** Seized via **group, ~4-pulse missions** once popularity is
high enough (these are combo missions per §5.2). Two example paths:
- **Political Movement** — peaceful; rolls **Interpersonal**, costs money.
- **Foment Coup** — requires **high instability**; rolls **Security + Espionage**.
- (Military conquest can also take a region regardless of popularity — deferred to the combat section.)
**Two popularity levers:** the *agent propaganda mission* (localized, **big** boost) and a *Legitimacy
spend* (global, **small** boost). **Two agent paths to control** (plus military, later):
- **Nice:** propaganda until popularity is high → **Political Movement** installs your people in office.
- **Coercive:** some propaganda, but focus **cause-instability** missions → **Foment Coup** once
  instability is high.

**What control confers:** military build/move in the region (see combat), regional **construction +
resource-allocation strategy**, and **income = region output × your cut, where the cut scales with
popularity**.

**Maintenance & decay.** You must keep popularity above the line to hold and profit. **Below 50% →
no income** and the region becomes **easy to flip** (via agents or military), especially for a rival
with high local popularity. The **US opens with a popularity bleed malus** — its RBO-aligned regions
drift downward, forcing it to choose whom to spend action economy keeping under the umbrella.

**Propaganda spillover along faction relationships.** Factions hold relationships (non-aggression,
alliance, war). Running propaganda boosts **you** most, gives allies a **small** boost, and **reduces
enemies** (e.g. Gamer propaganda with Hive allied / China hostile: +Gamer, +small Hive, −China).
*(The relationship/diplomacy system is fully specified in §9.)*

**Master line = 50% (locked).** Income begins and scales above it; seizing/holding control requires
being above it; the operational modifier is the continuous curve above. "RBO alignment" = the US
faction's popularity + soft-control situation; a derived **global RBO index** (aggregate) still serves
the US/China win conditions.

### 6.5 Span of control (anti-snowball)
A **span-of-control** cap (by **population / GDP** held) imposes steep **maluses** past the limit —
prevents map-painting. **Tech** relaxes the cap over time. For the US, raising **RBO alignment**
allows deeper **integration** of aligned regions (a resource cut, not full annexation) — **[open]**
presumably at a lighter span cost than full control.

### 6.6 Independent regions (autopilot)
Regions in no faction run on **autopilot**: defend with **limited responsiveness** — build military
if invasion-vulnerable, stabilize if targeted for subversion — but **won't reliably resist a
determined, persistent faction**. Depth comes from the alliance web (§6.7), not a lone region's defense.

### 6.7 Alliances & treaties
An **alliance/treaty system** creates response triggers (NATO mutual defense; the US responds to an attack on **Taiwan** — the trilogy's pivot; etc.). A would-be conqueror must first **break
treaties** via **agent actions** — a significant action-economy investment before overt aggression,
which is the real deterrent. Caution on whom you attack (e.g. China early game).

### 6.8 Uprisings & country fracture  *(resolved — a general mechanic, US Civil War is its flagship instance)*
**One rule, not a bespoke "civil war" system.** Any region whose **Stability** falls **underwater** (below a
threshold) carries a **per-pulse uprising chance**, scaling with how far underwater — and below a **lower
floor**, the uprising is **automatic** (no roll). Resolution:
- **Faction-fomented** (an agent was actively driving the instability, e.g. Foment Coup) ⇒ the region flips
  directly to **that faction's control**.
- **Organic** (Permacrisis-style decay, no credited faction) ⇒ the region becomes **independent**, splitting off
  from its country as a **brand-new autopilot country** (§6.6) — typically **weak**, like other non-faction
  countries, and open to **any** faction via military or agent action. **Regional flavor:** each region can carry
  authored **candidate-group** content for what this independence looks like locally (militias, rogue military,
  cartels, insurgents, a leftist/nationalist faction, etc.) — a content list, not a new mechanic.
- **No special protection for the newly-taken.** The **same rule reapplies immediately** to whoever now holds a
  low-Stability region — including a faction that *just* seized it. This produces an emergent **scramble
  dynamic**: freshly-conquered or freshly-independent territory is fragile until its new holder shores up
  Stability, and a **third faction can snipe it out from under a rival** who hasn't consolidated yet. Requires
  no special-casing — it's the general rule applying recursively.

**The US Civil War (§9.3) is simply this rule firing across many US regions at once**, via two possible
on-ramps, **neither scripted to a fixed outcome:**
1. **Barklight Standoff** (Widows event, stub) — one scripted **Stability hit across all US-controlled
   regions simultaneously**. Depending on how deep it lands relative to each region's starting Stability, the
   outcome ranges from **a handful of automatic losses** (a well-managed US) to **a chaotic multi-way fracture**
   (a neglected one) — genuinely not predetermined.
2. **Organic/agent-driven** — any faction can destabilize and seize US region(s) without Barklight at all.
   Harder than opportunistic post-Barklight scavenging (fewer regions in play at once, US responds more easily)
   **unless** the acting faction **coordinates multiple simultaneous seizure attempts** to overwhelm the US's
   capacity to respond to all of them — a real, skill-based timing play (the Johnny-Woo-style "color revolution").

**Canon reference (one possible playthrough, not a mandated one):** Barklight fires; Stability craters across
US regions. **Texas** → a militia/law-enforcement/National-Guard consortium, taken by **MU** via agent action the
very next pulse. **Midwest** → an ISIS-flavored insurgent caliphate; MU takes it militarily, but Stability stays
so low the **Widows snipe it right back** while MU is pinned fighting the US elsewhere (the scramble dynamic in
action). **Mountain West** → a US-STRATCOM breakaway, left unclaimed by any faction for the rest of the novels
(autopilot countries can simply persist if nobody bothers, §6.6). **Desert Southwest** → cartel-controlled, taken
**peacefully** by the **Hive** to found the arcology. **DC** → a China-backed leftist group ("Beefz"), crushed by
MU's Northeast TF the next pulse. US Eastern TFs lose to MU, retreat to a Gulf Coast last stand, and are
destroyed/surrender. **End state:** the US holds the **West Coast**, with the **Hive** and the **STRATCOM
country** acting as buffer states against MU-controlled former US territory.

### 6.9 US faction perk: the Rules-Based Order (RBO)  *(new — resolved)*
The US's per-region popularity label is renamed **"US-led Rules-Based Order" (RBO)** — cosmetic, but it's also
the hook for a real mechanical exception: **the US can draw *some* income from a region even without
Control**, as long as **RBO popularity** there clears the line — representing trade agreements, research
sharing, and foreign investment rather than direct extraction. This is what gives the US real incentive to
spend agent economy **defending RBO popularity** against the Permacrisis's erosion channel (§11.7), even in
regions it never intends to formally control. **Default (resolved): half the controlling faction's cut**,
scaling with popularity above the 50% line the same way (§6.4) — simple, memorable, and clearly a lesser deal
than actual control, matching the trade/investment flavor rather than direct extraction.

### 6.10 Space: Orbit & the Moon  *(in progress — first pass)*

**Interface, not a map (resolved).** Unlike the Earth surface, orbit and the Moon are represented as a
**side-panel widget** — graphics and stats, opened on demand — not something to scroll or zoom. Distinct
treatment for each.

#### 6.10.1 Orbit
**Countries** (not factions — same distinction as §9.1) hold **satellites**, tracked as a **single number per
country**, no sub-types/capability tiers. Satellites grant **targeting bonuses** to that country's Task Forces
conducting long-range fires (space-based ISR/navigation) — **more satellites = bigger bonus, with diminishing
returns** (prevents pure satellite-spam dominance, consistent with the game's other anti-snowball curves).
Countries invest **Production** into satellite launches to grow their count.

**ASAT shootdowns.** Available to countries with adequate tech — **Russia, China, the US, and a number of RBO
countries including Taiwan**. Each ASAT attempt carries a **small chance of triggering Kessler Syndrome** — a
**second path** to Kessler alongside Red Queen's deliberate Phase-1 mission (§4.2, §9.6): the world now has a
**standing structural risk** any qualifying country's own ASAT program can trigger by accident, independent of
her plot.

**Kessler Syndrome, mechanized in full.** Orbit status flips from **"Clear" (green)** to **"Degraded" (red) +
a debris %**, starting at **100%** (maximum severity) and reducible over time/via cleanup (below).
- **On trigger:** a large number of each country's satellites are **randomly destroyed outright** (some orbits
  presumably remain clear) — an immediate hit to everyone's targeting bonuses.
- **While active:** any **satellite launch or ASAT attempt** must **roll to get through the debris** — at
  100%, roughly **1-in-10** succeed, deliberately prohibitive (discourages brute-forcing new launches during a
  live Kessler crisis).
- **Also while active:** **nuclear missile launches** must roll to pass exo-atmospheric safely — at 100%,
  roughly **1-in-2** succeed. Deliberately a **softer** penalty than the satellite roll — Kessler makes nuclear
  use **costlier, not prohibited**, adding a genuine reliability wrinkle to the endgame nuclear ladder (§9.8)
  without functioning as a backdoor nuke-proofing mechanism.

**Laser Broom** (tech, previously named in §10.2.2's Lasers branch). Once unlocked, a faction with adequate
regional or point-defense lasers on a Task Force can spend **Money** to **reduce the debris %**. **A
continuous slider**, not a binary choice — fast-and-exorbitant (potentially one pulse, very high cost) at one
end, slow-and-cheap (**~5%/pulse** for a low cost) at the other, with the player choosing where to sit.
*(New interaction pattern for this design — a continuous cost/speed tradeoff slider, distinct from every prior
binary or roll-based choice.)*

**Rods from God** (tech + a new launch type). Extremely expensive in Money and Production relative to a
satellite launch. Unlocks the ability to strike **heavy long-range damage anywhere globally**, highly resistant
to conventional air-defense mitigation — **"not quite an I-win button, but extremely difficult to contend
with."** **If Kessler is active, a Rods from God launch must roll through the debris just like a satellite
launch** — a direct incentive to clear orbit (via Laser Broom) before attempting one, compounding its already
high cost.

**Resolved: exclusive to LaserWard** — part of their **escalation-dominance victory path**, not a
generally researchable tech.

#### 6.10.2 The Moon
Home of the **Gamer's narrative mission line** (§4.4): using **Molecular Machinery** to build a lunar launch
facility that culminates in the **Lunar Strike**, destroying all Earth WMDs.

**For the Gamer:** an **intel-style interface** with **full visibility** — exact progress, current status.
Progress **accelerates with subsequent launches** (each contributing incrementally toward completion, the same
multi-pulse-mission-progress logic used elsewhere, not a new system). The Gamer also gets a **mission-specific
capability**: using lasers to carve a **narrower, local launch corridor** (not a global debris-% reduction)
specifically improving their own launch odds.
**Resolved: an independent capability tied to their lunar
mission chain**, separate from the general Laser Broom tech anyone can research and use. A failed Lunar Strike
mission roll can narratively be attributed to factors like an inadequately-cleared corridor.

**For every other faction:** deliberately **fogged, escalating visibility** — early **vague rumor-tier
indicators** ("something anomalous on the lunar surface," framed as likely fake news/AI deepfakes), with
**more concrete clues surfacing as the site develops**. Eventually, an **intel-analysis agent mission** against
the site can succeed and reveal the Gamer's intent directly: **"if you don't use your nukes soon, you are
likely to lose them."** This hands **every nuclear-capable faction** — not just those racing the Gamer
directly — a genuine countdown dilemma: **launch now** (full §9.8 nuclear-ladder consequences) or **lose the
option permanently** once the Lunar Strike lands. A strong piece of endgame tension shared across the whole
table, not just the Gamer's own arc.

## 7. Economy & Resources  *(in progress)*

**Agents are the action economy** — no separate ops/influence currency. Spendable currencies:

### 7.1 Money
All factions hold it. **Income sources:** territory **tax = GDP × popularity** (per controlled
region); **agents** (income traits + money missions). Money missions form a risk ladder:
**Fundraise** (soft, low risk/reward) · **Shakedown** (coercive, more, arrest risk) · **Heist**
(multi-pulse, biggest, team, arrest risk). *Getting arrested* = captured if in a rival's territory;
unusable if in a non-controlled region. Rescue missions free them (easy vs. a non-faction prison);
you can also buy them out unless the holding faction is hostile.

**Print-money / inflation (US & China capability).** Both open with **negative per-turn income**
(worse for the US). A **Print Money** button yields cash now but accrues a growing **inflation cost**;
left unchecked it **death-spirals** into **hyperinflation** (big Stability + GDP hits across your
territory, then the inflation cost clears). Alternatively, **trade away the Print Money capability**
for a smaller one-time Stability/GDP hit — a **permanent, one-way** transition to **hard money**
(the trilogy's sound-money resolution). *(Guard against farming the hyperinflation reset.)*

### 7.2 Research
A **pool** (accumulate → pick techs → award on threshold), not spent piecemeal. Generated by
**population + stability**, specific **buildings**, and **agents**. Agent missions: **Pursue a
Breakthrough** (multi-pulse, windfall RP) and **Assist Research** (1-pulse, flat **%** buff this turn).

### 7.3 Production
Spent on regional **buildings/improvements** and **military units**. Fueled by the region's own Production
output (§6.2 — corrected from an earlier "Industrial output" label, terminology drift for the same stat).
Agent mission: **Advise Industry** (1-pulse, flat **+5%** this turn). **Supply** (§8.7) is derived
directly from a region'''s Production at a baseline 1:1 ratio, tech-modifiable — Molecular Machinery
and Nanotechnology (§10.3.2) each add +10%, shown parenthetically as Production(Supply) on the region panel.

### 7.4 Legitimacy (soft power)
A **global faction pool** earned via **popularity × population** across all regions **regardless of
control** (rewards being liked, not just owning). Spent to shift **relations**, **boost popularity**,
and run **faction-flavored political actions** — e.g. MU **Levee en Masse** (spawn militia), Hive
**Pursue Harmony** (+stability), Gamer **A Night Out** (+team cohesion). *(Name tentative; political
actions are a per-faction content catalog, TBD.)*

### 7.5 Design rule — peg agent economic output to a growing base
Flat **%** buffs (Assist Research, Advise Industry) self-scale and are fine. **Flat absolute** rewards
(a fixed RP windfall, a fixed $ from fundraising) **decay in relative value** as the economy grows —
so agent economic outputs should be **percentages or scaled to a growing base** (current income, tech
tier, region output), never fixed numbers. This keeps late-game agent economy missions relevant.

### 7.6 Passive vs. agent-driven income (balance dial)
Backbone income should be **passive** (territory tax + buildings) so agents stay free for operations;
agent money/research/production missions are **supplements/spikes**, not the mainstay. The split is
itself **faction-differentiating** — the Gamer leans on agent-driven income + Legitimacy; nation-states
lean on territory tax. *(Exact ratio = a balancing dial.)*

### 7.7 Regional buildings: UI concept and escalating stack cost  *(new — from the Hive pass)*

**UI concept (Victoria3-inspired, implementation guidance for Fable).** Clicking a region surfaces a stats
panel (Money generation, Population, GDP, Stability, Production — with **Supply** shown parenthetically,
§8.7 — Research, Energy, etc.) plus a **grid of buildings**: each building shows an icon and a **count/level
number**, buildable fresh or expandable in place.

**Escalating stack cost (new general economic rule, not Hive-specific — the Hive is just the faction built to
exploit it).** Leveling the **same building type** repeatedly in one region costs **exponentially more each
time** — illustrative curve: level 1 = 1× base Production cost, level 2 = 1.05×, level 3 ≈ 1.1025×, level 4 ≈
1.157625× (each level ≈ 5% costlier than the last; exact rate TBD for balancing). *(Applies per **building
type** within a region, not to the region's building spend in aggregate — this is what makes "diversify your
build across several building types in one region" a genuine alternative to "stack one type," consistent with
Eric's framing.)* Directly parallel to the siege-suppression diminishing-returns curve (§8.7) — same family of
mechanic, applied to construction instead of destruction.

**Energy building tradeoffs under this curve (concrete example):** **Fossil fuel plants** — cheap and
efficient, but require regional Energy-resource access and are Production-vulnerable to blockade (§8.7, §7.8).
**Renewables** — less efficient, but blockade-immune. **Fusion** (tech-gated, §10.3.1) — most efficient *and*
blockade-immune, but locked behind research. Under the escalating-cost curve, no faction wants to stack any one
of these indefinitely in one region — **except the Hive** (§3, §11.10), whose Arcology-region exemption (below)
makes indefinite Fusion-stacking their signature play, and is the actual mechanical engine behind their
"plays tall" identity — not just a narrative label.

**Concrete optimal-play guidance (from the Hive pass):** for an ordinary faction, once Fusion is unlocked, the
efficient path is to build Fusion up to a **minimum useful level** in each region, then **diversify** into
fossil (where access exists) or renewables (where blockade risk matters) once Fusion's own escalating cost
makes further stacking pricier than branching out — a genuine equilibrium, not "always max Fusion." **The
Hive, post-Arcology, skips that equilibrium entirely** — with no escalating cost to fight, simply stacking
Fusion as high as regional Energy demand requires is straightforwardly optimal.

### 7.8 Energy — a new *regional* resource  *(in progress — the regional mechanic moved here; Fusion
Power *tech* stays in the Industrial category, §10.3.1)*
Distinct from the three **global** currencies (§7): **Energy is regional** — each region needs it to run
industry (platform/manpower production, construction), produced locally by buildable/upgradable plants:
**renewables, hydro, fossil-fuel, nuclear**, and (keystone, post-tech) **fusion**. A **fossil-fuel commodity**
also exists pre-fusion, **traded between regions** — meaning **domain control (§8.5/§8.7) gates energy trade
a fourth time**: sea/air superiority already gates fires, supply-path contestation, and reconfiguration lag;
now it also gates whether fuel *reaches* a region that lacks its own supply once war disrupts shipping lanes.
**Faction hooks:** the **US** can lean on abundant *internal* fossil fuel (insulated from trade disruption once
war starts) vs. cheaper-but-import-reliant renewables; **China** gets a **geothermal-borehole** perk — better
value than renewables, mitigates trade disruption; **Algae Cultivation Plants** (already a regional modifier,
§6.2) let a fuel-poor region **manufacture its own fossil fuel** locally — Algae Cultivation buildings also provide a **small Supply/nutrition yield** alongside Energy, a dual-purpose regional building. *(This is the same Region **Supply** value formalized in §8.7 — Algae Cultivation is a direct bonus generator on top of the Production-derived baseline, not a separate, unrelated use of the word.)*

**Energy mechanic (resolved): a two-stage per-pulse flow, no banking.**
1. **Fossil fuel is the tradeable commodity** — flows region-to-region each pulse, gated by domain control
   (§8.5/§8.7) exactly like supply; a region with its own reserves doesn't need the trade.
2. **Local plants convert** intrinsic source (renewables/hydro/nuclear/fusion) or delivered fuel into
   **Energy**, consumed **same-pulse** by that region's Production (factories, training, construction).
   **Shortfall degrades output proportionally** — no stockpile either direction, so a starved region throttles
   *immediately*, not after a buffer drains.

**The pre-fusion dilemma (the point of the whole system):** once trade is disrupted, a player must choose —
**rush fusion**, **race to steal** it once a rival has it (agent tech-theft), **rush Algae** to manufacture
local fuel, **build expensive renewables**, or (China only) **build Boreholes**. No free lunch; the choice is
faction- and geography-dependent.


## 8. Military & Combat  *(in progress — balance best de-risked in a standalone simulator)*

### 8.1 The unit: the Task Force  *(resolved in outline)*
The map-level "unit" is a **Task Force (TF)** — a JTF in US doctrine — which may combine **air,
maritime, and land** components. It occupies **one region** (land or sea). Its **sprite reflects its
largest component** (a ship / a few infantry / tanks / — later — robotic formations).

**Orders:** **Move** (reposition or attack a region) · **Disperse** (reduce damage from enemy air and
long-range fires) · **Suppress Unrest** (raises regional Stability, costs a little Population) ·
**Disband** (refunds a *portion* of resources). **Default (stationary):** defends its region and
contributes a small **Stability** bonus each pulse, scaled to its makeup.

### 8.1.1 Naval embarkation & cross-domain composition  *(new — fully specified, structure resolved, exact
weight/capacity numbers TBD like everything else this granular)*

**New unit-level stat: Weight.** Every land and air platform gets a Weight value, determining what a naval
platform can embark. **Light** (basic infantry, robot dogs, FPV drone teams) — light enough to ride even a
bare surface combatant with no dedicated module. **Heavy** (tanks, vehicles) — needs dedicated cargo capacity,
can't ride bare.

**Air-side: three escalating, mutually-exclusive ship modules (confirmed) — a single shared capacity-budget
mechanic, not three different systems.** Illustrative weights: a light aircraft squadron (fighter/multirole/
EW/AEW — any fixed-wing type) = **10**; a rotary-wing or light drone squadron = **5**. **A ship carries at most
one of these three modules, ever** — confirmed mutually exclusive, no combining two air-capacity tiers on the
same hull (contrast with Cargo Hold modules below, which explicitly *do* stack):
1. **Flight Deck** — on **light or large** ships. Capacity **5** — one rotary-wing squadron or one light drone
   unit.
2. **Light Carrier** — **large ships only** (LHA-analogous). Capacity **10** — one fixed-wing squadron, or
   two rotary/drone squadrons (5+5), matching the earlier "OR" framing exactly at this small a budget.
3. **Fleet Carrier** — **large ships only**, very expensive in Production (modern-carrier-analogous). Capacity
   **~70–75** — **confirmed against the established Seventh Fleet composition (§11.7)**: 4 multirole-fighter +
   1 EW + 1 AEW (6 fixed-wing squadrons × 10 = 60) plus 2 rotary-wing (2 × 5 = 10) = **70**, landing almost
   exactly on the estimate. At this budget size, genuinely mixed air wings (like the Seventh Fleet's own) are
   naturally supported — a player could just as easily build an all-drone "drone carrier" instead for the same
   70-point budget.

**Large airframes (bombers, big-wing ISR) cannot attach to a Naval TF at all** — a hard exclusion regardless of
carrier tier.

**Ground-side: universal baseline, plus stackable Cargo Hold modules.** Every ship, even with **zero modules**,
carries a small baseline ground-forces capacity — flavor: a SEAL team riding a submarine, a small raiding party
on a surface combatant — illustratively **1 light unit**. **Cargo Hold modules (confirmed: multiple allowed
per ship, unlike the air-capacity modules above)** trade away weapon/defensive module slots for real capacity:
light units get more slots per hold than heavy ones (vehicles/tanks/Crab platforms) — more holds reflects more
of the platform dedicated to carrying ground forces. This produces LPD-analogous ships. **Cargo Hold + Light Carrier on the same large-ship platform =
an LHA-analogous configuration** — pricier, but the modular system naturally supports it. Fully a
platform-designer tradeoff: stay combat-focused with one modest Cargo Hold for light escort/transport duty, or
specialize heavily into cargo capacity and lean on the rest of the naval TF for protection.

**Combat participation rules (resolved):**
- **Air assets attached to a Naval TF fight normally** — no restriction, same as any other air unit.
- **Embarked ground forces do not fight** if the Naval TF engages another TF in a water region — pure
  passengers/cargo. **They can still take losses** if the ships carrying them are lost — this isn't a new
  mechanic, it's the existing production-value-weighted damage distribution (§8.3.2) simply operating on the
  troops as part of whatever block gets hit, the same way it already handles any other loss allocation.

**Airship exception:** once unlocked, the Airship platform can join a Naval TF with **no restrictions at all**
— no carrier module needed, since it stays airborne independently for long-distance journeys without landing.

**Deliberately out of scope, per Eric:** air refueling and carrier-qualified airframe specialization are
abstracted away — not modeled at this level of granularity.

### 8.2 Three-layer build pipeline
A clean data-driven pipeline; each layer is its own screen.

**(1) Platform designer** *(HOI4-style)* — design the equipment itself. Pick a **base platform**
(infantry, tank, bot, aircraft, ship, drone…), then set **armor, powerplant, weapons**, and **modules**
(EW, EMP resistance, targeting computers, …). Answers "6th-gen fighter or AWACS? carrier or railgun
destroyer? APC or robotic AA tank?" Platforms, weapons, and modules are **unlocked via the tech tree**. A recurring canon pattern to support: a **manned command node** (a 6th-gen fighter, a warship) that extends control over **N autonomous platforms** — the Mustin / Mouth-and-Sparkles endgame.

**(2) Production → pools** — Production builds **factories** that output **platforms** into a faction-wide
**equipment pool**; Production also funds **military training**, converting **Population → manpower**
into a **manpower pool**. More Production = more throughput. **Recruitment caps:** limited share of
population; **peacetime + low popularity ⇒ very little recruitment**.

**(3) Task Force composer** *(HOI4 division-designer-style)* — a grid of **blocks**; each block =
**(platform template, count)** with **+/−** buttons. **+** draws platforms/manpower from the global pool;
**−** or block removal **refunds in full**. Example: early Mankind United fields 1 block of basic militia
×50 + 1 block of drone teams ×3; later adds a helicopter gunship ×1 as production comes online.

### 8.3 Emergent TF character
A TF's combat behavior emerges from its blocks: armor+mech = fast and damage-resistant; massed early
infantry = weak but a cheap way to hold key terrain.

**[KEYSTONE — resolved] Aggregation must not collapse to scalars.** A TF aggregates into **profile
vectors** — an *attack vector* over weapon archetypes and a *defense vector* over defense archetypes —
matched via an **effectiveness matrix**, never summed into single Attack/Defense/Armor numbers (that would
kill the rock-paper-scissors pillar). Cheap to compute, preserves multidimensional RPS. Range/speed handled
as **sequencing** (range bands / engagement phases), not vector stats.

**Open sub-questions:**
- **Speed rule:** does the **slowest** component set TF speed (classic wargame rule, discourages
  kitchen-sink TFs), or a weighted average?
- **Domain interaction:** partially resolved by the CAS/small-unit-AA channel (§8.6.8) — an air-heavy TF's
  CAS still needs theater air superiority and is attrited by small-unit AA; the general land/sea/air
  cross-domain engagement model beyond that is still open.
- **Restructure timing: resolved by §8.5.3** — composition edits are reconfiguration-lagged (not instant),
  which already prevents dodging losses by reshaping a TF mid-contact.

### 8.3.1 Contextual weapon-effectiveness multipliers  *(new — structure resolved, exact values TBD)*

**Problem:** the effectiveness matrix (§8.3) captures archetype-vs-archetype matchups and §8.5.1 covers
saturation/throughput, but neither captures that the **same weapon behaves differently by context** —
grounded in real A2/AD lessons (directed-energy/short-range defense is cheap and devastating up close but
limited by range/atmospherics; long-range standoff strike is expensive but decisive at distance and used to
degrade defenses before an assault).

**Resolved structure: two independent multipliers per weapon archetype**, applied at resolution time on top of
the existing formula — **effectiveness = archetype-matchup × saturation/throughput × range-context ×
role**:
- **Range-context** — Standoff (§8.5) vs. Invasion (§8.6).
- **Role** — attacker vs. defender in that specific engagement. *(A new, distinct concept from the existing
  Concentrated/Dispersed posture toggle, §8.6.1 — kept terminologically separate to avoid collision.)*

**Qualitative profiles for the three Crash Military Modernization lines (§10.2.2), exact numbers TBD for the
balance sandbox, §12.10:**
- **Hypersonics** — highest supply/production cost. **Flat across range** (equally effective standoff or
  invasion). **Offense-favoring.**
- **Rail Guns** — medium cost. **Decent standoff, better invasion** (accuracy/LOS/spotting at close range).
  **Balanced** offense/defense.
- **Lasers** — cheapest cost. **Near-zero standoff, sharply better invasion.** **Defense-favoring.**
  **Degraded by weather** (see below).

**Weather (new region property, generalizes the Maelstrom).** Regions carry a **weather state**
(seasonal/climate-driven baseline, event-modifiable) that degrades **laser effectiveness**. The Maelstrom
(§11.6, China) is now understood as an **extreme, artificially-forced instance** of this general rule, not a
bespoke one-off mechanic — a region's normal climate could mildly favor or disfavor lasers even without any
special event forcing it.

**Emergent consequence (free, not separately designed): a real counter to laser-heavy defense.** Since lasers
are nearly toothless at range, an attacker fielding hypersonics/rail guns can simply **decline to invade** and
instead grind the defender down from standoff via the existing **siege loop** (§8.6.4) — bombard until weak,
then close. A genuine tactical lesson falling directly out of the archetype numbers, not bolted on separately.

### 8.3.2 Biased damage distribution within a TF  *(new — structure resolved, exact weighting TBD)*

**Problem:** Organization (§8.6.6) governs the TF's *aggregate* health, but says nothing about **which
specific blocks** absorb the manpower/equipment losses that occur along the way — and a real force
instinctively shields its most valuable assets rather than losing them in flat proportion to cheap ones.

**Resolved structure — production-value-weighted distribution, not a strict waterfall.** Inspired by HOI4
naval "screening," but **probabilistic rather than absolute**: losses are allocated across a TF's blocks via
a **weighted draw, inversely weighted by each block's per-unit production/value cost** (already tracked —
it's what was spent to build them, §8.2). Cheap blocks (basic infantry) are **far more likely** to absorb a
given loss than expensive ones (hypersonic launchers) — but never *immune*; an expensive block can still take
a hit, just less often, so it's a **bias, not a total wall** (explicitly not "kill all infantry before you can
touch the hypersonics"). **Organization stays global/aggregate for the whole TF** (unchanged, §8.6.6) — only
the *allocation* of manpower/equipment losses among blocks is value-weighted.

**Emergent property (free, matches the HOI4-screen intuition without a special "screen" role): as cheap
blocks deplete, the weighted distribution naturally shifts toward what's left.** Once the infantry is gone,
the expensive assets start absorbing the full weight of further losses — the "screens run out, then the
core gets hit" dynamic falls straight out of the weighting formula, with no separate screening mechanic or
unit role required. Consistent with the "one shared rule, no special-casing" pattern used throughout combat.

### 8.4 Thematic hook — manpower vs. autonomy
Because military power is gated on a **manpower pool** drawn from Population, the tech path toward
**autonomous robots decouples military power from population** — a faction that goes robot-heavy stops
needing recruits (and stops caring about the popularity/peacetime recruitment caps). This is a strong,
on-theme axis: Mankind United stays manpower-bound; the Red Queen, LaserWard, and the Hive can trade
flesh for autonomy. **Confirmed & sharpened:** the **AI/automation tech branch is unavailable to Mankind United** — they get parallel **human-focused** techs instead. Factions therefore run **divergent tech trees**, not just different modifiers (see §9). Canon: by the end, US (via LaserWard platforms) and China fight a near-autonomous Taiwan war; MU stays a manpower force.
### 8.5 Standoff combat: long-range fires  *(in progress)*
Two **adjacent, at-war** Task Forces may exchange **long-range fires** without either moving — the
alternative to invasion (§8.7, next). Fires draw on a **subset** of a TF's elements: long-range
artillery, railguns, ballistic & cruise missiles, air strikes, naval gunfire, one-way attack (OWA)
drones. The attacker chooses a target mode:
- **Counter-force** — attrit the enemy TF's military elements.
- **Counter-value** — damage the enemy region's **GDP / Population / buildings** (couples straight to
  §7; note the tension: don't wreck a region you intend to capture and profit from).

**Domain-control layer (resolves first, gates everything).** Two parallel contests, each a per-region
**%**, each side holding its own value over each region (home turf is easier — e.g. US 80% over its own
region, 40% over MU's):
- **Air superiority** — from both TFs' fighter composition + aggregated air defenses (incl. regional
  air-defense buildings, §6.2) + modifiers (stealth, radar, EW).
- **Maritime superiority** — a **surface/attrition** contest *plus* a distinct **subsurface** contest
  (ASW vs. subs), which is really a **detection/stealth** problem, not raw force — which is why cheap
  submerged/《sneak》 attackers can still leak at high surface superiority.

Higher control ⇒ more enemy attrition per pulse in that domain **and** a larger *delivered* fraction of
your fires. Maritime superiority specifically makes it harder for the enemy to **sneak assets into your
TF**. **Sea denial (the naval "quantity" path):** cheap asymmetric assets — midget subs, USV kamikazes —
mean that even at 95% enemy maritime superiority, one effective hit in twenty can be net-value-positive.
Same saturation/value engine (§8.5.1), naval flavor.

**Winning the commons throttles enemy logistics (confirmed — see §8.7).** Domain control gates not only
*fires* but the enemy's **supply, replenishment, and reconfiguration lift** through the contested space.
Win the air and sea and the enemy can't fire, can't reinforce, and can't reshape — the attrition
compounds. This is the mechanical Taiwan blockade.

**Reactions for a TF under fire:** **Disperse** (less incoming damage, but weaker at the *outset* of
ground combat if then invaded; **[proposed]** re-concentrating takes a lag, so dispersing vs. an enemy
who then invades is a real gamble, not a free toggle) · **Invade** (if it likes its ground matchup) ·
**Tank it**.

### 8.5.1 "Quantity has a quality of its own" — the engine that makes it work  *(proposed)*
Central theme: **cheap mass must be viable but not dominant**, co-equal with tech-superiority. Two
mechanics deliver it:
1. **Score combat in value, not bodies.** You are winning if *value destroyed > value lost*, even at a
   100:1 body count. The resolver must track a **resource/value exchange**, and the UI must **surface**
   it — "losing units, winning value" — or players can't perceive (and therefore can't choose) the
   cheap-mass path. Ties to the legibility rule: the player must be able to see *why*.
2. **Saturation thresholds on defenses.** Each defensive archetype (point-defense laser, autocannon,
   SAM…) has a **per-pulse interception capacity** and a **cost-per-intercept**. Below capacity it eats
   cheap mass almost for free (cheap PD vs. $-cheap OWA drones = the flipped exchange); **above capacity
   it leaks**. This creates the loop: **cheap mass → cost-efficient area defense → saturation (exceed
   throughput) or penetrators (stealth/hypersonic the defense can't engage) → …**

So effectiveness is **type-matrix × throughput/saturation × cost**, not a flat type matrix — the RPS is
measured **per resource**. This is why an MU OWA-drone swarm that only 20% penetrates can still win:
enough leaks past saturation to degrade air defense, trade cheaply against exquisite platforms, or hit
GDP for more than the drones cost. The counters (cheap per-kill defense; saturation; penetrators) are
what keep either extreme from dominating.

**Reconciled with §8.3.1 (added later): this is not two competing formulas.** The full effectiveness
calculation is **type-matrix × throughput/saturation × cost × range-context × role** — this section supplies
the first three terms (the mass/quality engine), §8.3.1 supplies the last two (context-dependence by
engagement type and attacker/defender role). One canonical formula, built in two passes.

### 8.5.2 Submarine warfare & detection  *(new — fully specified, structure resolved; a few genuine
architecture questions flagged, not glossed over)*

**Mechanizes the "detection/stealth problem" already named at §8.5** — this section is that promise, paid off.

**Platforms.** **Submarine I/II/III** — successive base tiers, each stealthier than the last. Modules:
**engine type** (diesel-electric / nuclear / fusion — mutually exclusive, one power plant per hull — each
with its own stealth signature), **sonar** (leveled, feeds **detection**, not stealth — a separate axis, see
below), **weapons**: torpedoes (leveled), cruise missiles (leveled, swappable for hypersonic variants once
unlocked — capable of standoff long-range fires, §8.5), and **rail guns** (also standoff-capable). *Canon: some
SSGNs were retrofitted with rail guns — surface, harass coastal targets, submerge, relocate before counterfire
arrives.* Also compatible with the **Automation module** (§8.1.1's existing semi/full tiers, no new mechanic
needed). **Boomer (SSBN) submarines are explicitly out of scope for now** — a deliberate scope limit, same
spirit as abstracting away air refueling (§8.1.1).

**Miniature submarine** — a separate, cheaper platform: fewer module slots, less combat capability, but
producible in large numbers — the submarine-flavored instance of the "cheap mass" pattern already established
elsewhere (OWA drones, FPV swarms, §8.5.1).

**Core mechanic: submarines are invulnerable unless detected.** A genuine binary gate, distinct from every
other damage-modulation mechanic in combat so far (which all apply some *reduced* effect, never true
invulnerability).

**Detection roll — every combat Tick (~1 hour), not every Pulse:**
- Each submarine (or a **bin of 5**, for mini-sub swarms too large to roll individually) rolls **detection
  vs. stealth** against the opposing side's aggregate detection score, once per tick.
- **Detected or not, a submarine can always attack that tick** — detection only gates whether *it* can be hit
  back, never whether it can hit others.
- **Only detected submarines enter that tick's casualty pool** — they become one more eligible block in the
  existing production-value-weighted loss allocation (§8.3.2), not a separate resolution system. Detected
  ≠ dead — just targetable, and might be.
- End of tick: a surviving, non-retreating submarine evades and returns to hiding for a **fresh** detection
  roll next tick.

**Detection is a Task-Force-wide aggregate, not a platform-vs-platform matchup** — the same architecture
already used for domain control (§8.5's air/maritime superiority percentages). Ships and rotary-wing aircraft
can mount sonar modules (dipping sonar, sonobuoys, towed arrays, passive sonar); submarines with their own
sonar modules can contribute too, including **hunting other submarines**. Everything relevant on a TF pools
into one detection score that every enemy sub in the fight rolls against.

**Emergent outcomes (confirmed intended, not accidental) — a new instance of the recurring asymmetric-warfare
theme (§8.5.1, MU's mass-infantry-vs-armor, OWA swarms vs. exquisite platforms):** a mixed TF battle sees some
shifting subset of subs vulnerable each tick while the rest stay shielded; a pure-sub TF with high stealth
harassing a conventional TF with weak detection investment can genuinely **outlast and defeat a far more
expensive surface-heavy force** — a legitimate, intended low-cost counter-strategy, not an exploit.

**Confirmed reads (strongly implied, stated here rather than left ambiguous):**
- **Detection is memoryless** — every tick is a fresh, independent roll; no persistent "we're onto you" state
  carries forward from a prior tick's detection, and no persistent bonus accrues to the hunter either.
- **Sonar (detection) and stealth are independent axes** — no active-sonar-reveals-your-own-position tradeoff
  modeled at this level of granularity, consistent with the deliberate abstraction choices already made
  elsewhere (§8.1.1).
- **The rail-gun "surface, shoot, submerge, relocate" pattern needs no new mechanic** — it falls out for free
  from a rail-gun-equipped sub simply having standoff-fires capability plus normal movement plus the detection
  system above. A free emergent tactic, not something built separately (the same pattern as the laser-defender
  siege-strategy consequence, §8.3.1).
- **Miniature submarines still use the full platform designer**, just with fewer module slots — not a
  separately pre-configured unit type.

**Combat initiation vs. detection-gated resolution (resolved).** Combat begins the moment two hostile Task
Forces share a region — the same as everywhere else in combat (§8.5, §8.6) — **independent of detection**.
Detection then gates whether damage *lands* each tick, not whether the engagement exists. A genuine **two-stage
roll per detected submarine**, made explicit: **(1) the detection roll** (gate) — if failed (undetected), the
sub simply isn't on that tick's target table, full stop, no further roll; **(2) only if detected**, the normal
combat-resolution roll (the existing effectiveness-vector/value-exchange math, §8.3, feeding the production-
weighted loss allocation, §8.3.2) determines whether damage actually lands and how much. **Worked example
(Eric's own, confirmed): two 3-submarine TFs engaged.** A tick where nobody's detected: no one's on the target
table, no damage or Org loss possible — the subs are still maneuvering for position, just mechanically inert
that tick. A tick where one sub gets detected: the opposing TF's combat stats resolve against it — possible
outcomes range from destroyed, to a close call that evades, to no losses but an Org hit (a rattled crew).
Continues until one side's Organization forces retreat or the TF is destroyed — or a player manually withdraws
mid-engagement.

**Submarines in a pure standoff/long-range-fires exchange are fully undetectable — the source of their
canonical terror (new, resolved).** Detection **requires co-location** — a TF physically present *in the same
region*, actively hunting. Two **adjacent** TFs trading long-range fire (§8.5) never puts anyone in the room:
no one is co-located, so the detection sequence never even begins. **Explicit rule:** a submarine that's only
in an adjacent standoff exchange, with no enemy TF actually present in its own region, **never appears on any
damage table, full stop** — genuinely, not just "very likely to evade." *(A mixed TF's surface vessels and
aircraft remain normally vulnerable to that same standoff exchange — this immunity is submarine-specific, not
a blanket shield for the whole TF.)* **Canon-grounded design intent:** a group of subs can sit off an enemy
coastline, periodically surface to fire TLAMs or rail-gun rounds, then submerge and relocate before
counterfire arrives — entirely unanswerable from stand-off range.

**The resulting defender's dilemma is the actual point of the mechanic:** either **absorb the damage** over
time, or **commit a dedicated Task Force into that region** to begin active sub-hunting and try to "sanitize"
it — which means pulling that force away from whatever else it was doing (an amphibious invasion elsewhere,
for instance). A defender trying to cover an **entire coastline** this way spreads thin; the attacker can
simply **relocate their submarines region to region** to stay ahead of wherever the defender concentrates.
And if the defender overextends trying to cover too much ground, the attacker can **mass their submarines** and
potentially win a concentrated engagement against a weakened, dispersed hunting force. A real strategic
tension, not just flavor.

*(Reconciles, doesn't contradict, the existing domain-control "subsurface contest" language at §8.5 — that
text describes submarines attempting to **move through or sneak into contested/enemy-controlled space**, which
remains a real detection contest. Today's rule is specifically about the **stationary, own-territory standoff
case** — no movement into contested space, so no contest to have.)*

**Mini-sub binning (resolved) — for legibility, not performance.** Two hundred individual detection rolls per
tick isn't actually a computational concern on any modern system — that reasoning doesn't hold up. The real
justification is **consistency with the game's existing "value not bodies" philosophy** (§8.5.1) — combat
already refuses to make a player track hundreds of individual FPV drones or OWA munitions as separate visible
entities anywhere else, and two hundred individual submarine detection icons would be the same UI-noise problem
in a new costume. **Confirmed: a bin of 5 mini-subs takes one shared roll — the whole bin is shielded or
exposed together**, losses arriving in multiples of 5 when this kicks in. The bin size itself is a **tunable
UI/legibility knob, not a hard technical wall** — 5 is a reasonable default, not a forced number.

### 8.5.3 Reconfiguration lag (anti-teleport)  *(resolved)*
A TF's fighting state **can't change instantly** — one unified principle covering both **disperse ↔
concentrate** and **composition edits**. Rationale: prevent staging cheap TFs everywhere and then
globally teleporting total combat power to wherever it's needed this pulse. Newly added platforms/manpower
arrive by **sea/airlift** and **phase in** — baseline **20% after pulse 1, 20% after pulse 2, 60% after
pulse 3** (tunable). **The lag is a gradient on local domain control:** as your air/sea superiority in the
region drops, dispersing/concentrating/editing stretches to 4, 5, or 6+ pulses. Consequences: the global pool acts as a **strategic reserve**
that takes time to field, **pre-positioning beats reaction**, and you can't dodge losses by reshaping a
TF that's already in contact. (Removal/refund timing — instant vs. lagged — is a small open sub-point.)

### 8.6 Invasion & ground combat  *(in progress — first piece)*
When a TF moves *into* an enemy region to take ground (vs. trading fire across the border), the **ground
component** dominates and the prize is **control** (§6.4's pinned military route). Several systems interplay
— terrain, fortifications, posture, air support — captured piece by piece.

**Ground-only vs. cross-domain classification (resolved) — these children were written up here by accident
of discussion order, not because every mechanic is actually land-specific.** You could genuinely have mixed-
domain combat inside what reads as an "invasion" section — CAS in a naval battle is technically maritime
strike/SUCAP, a defending naval TF can be concentrated or dispersed just like a land one — while other things
here (Stability, partisans) have no naval or air equivalent at all.
- **Ground-only:** §8.6.3 (Stability & partisans — no equivalent in any other domain), §8.6.4 (Terrain,
  Fortifications & Amphibious — land-flavored, though Amphibious is itself the explicit land-sea bridge),
  §8.6.7 (Occupation — territorial hold-it game, land-only, but see below for a maritime-specific gap this
  surfaced).
- **Cross-domain / general (applies to any TF regardless of domain, just first specified here):** §8.6.1
  (Posture), §8.6.2 (Shock — confirmed: a coordinated mass maritime strike gets the same early-advantage
  window and probing dynamics as a land invasion), §8.6.6/§8.6.6.1 (Organization & TF legibility — Org is
  already used everywhere, submarines included), §8.6.8 (CAS & small-unit AA — see the naval-equivalent note
  below), §8.6.9 (Special attacks: EW/EMP/cyber — already used in naval contexts elsewhere).

**Piercing vs. armor (first piece).** A HOI4-style penetration breakpoint layered on archetype effectiveness
(§8.3):
- **Small arms** do light damage that **scales with numbers** — mass light infantry shred other infantry.
- Against **armor** (tanks, mech, heavy robots), *unpierced* damage craters to a **floor (~10%)**.
- **Anti-armor tech** raises infantry piercing — ATGMs, shaped-charge IEDs, kamikaze drones — lifting that
  matchup toward **~80%** of full.
- **Armor tech** (materials, reactive armor, countermeasures) re-steepens the differential for armor-heavy
  builds. An ongoing **arms race** across the tree.
- **RPS + cost:** heavy platforms and **air power** are the clean answers to mechanized forces — but armor is
  **expensive** vs. cheap infantry, so **mass + cheap AT** (IEDs, kamikaze drones) is the asymmetric counter
  (the value/saturation theme, ground-side — very Mankind United). Air-as-armor-counter is itself nested
  under the domain-control layer (§8.5) — win the air, enable CAS against armor.

**Breakpoint shape (resolved): a smooth curve** from the ~10% floor toward full as piercing approaches/
exceeds armor — steep near the crossover (so a tech that finally out-pierces enemy armor swings the matchup)
but no brutal cliff where one armor point flips a battle.

### 8.6.1 Posture: concentrated vs. dispersed  *(resolved)*
A TF toggles **concentrated** (full damage from long-range fires; strong on defense in an invasion) vs.
**dispersed** (less fire damage; weak at the outset of an invasion). *Note: dispersed ≠ un-entrenched — a
dispersed force may be dug into many small positions, yet still get overrun by a concentrated armored fist.*
**Posture is a commit-under-uncertainty mind-game** (the same pattern as agent resolution): you bet on
whether the enemy will *shell* or *storm*, and because posture changes are subject to the reconfiguration
lag (§8.5.3) — worse under poor domain control — you can't cheaply flip once they commit. The attacker's art
is to exploit the mismatch.

### 8.6.2 Shock (the invasion attack bonus)  *(resolved + one addition)*
Every attacking TF gets a **shock bonus** for the first few pulses — a shock-and-awe wave that hits hard and
briefly paralyzes the defender. **Magnitude scales with speed, firepower, air superiority, and combined-arms**
(mostly-infantry-in-trucks = small; a combined-arms fist = large). A **dispersed defender amplifies the
attacker's shock** (overrunning scattered positions). **Cooldown:** ~4 pulses to reset shock, preventing
attack-bail-reattack; the intended play is a **probe** — hit with shock, then press only if you have the edge,
else withdraw and wait. **Counterattack — a pre-committed defensive stance (resolved).** No cooldown; the **extra manpower/equipment
losses self-limit** it. **Pre-committed** (set in advance) so the player needn't watch for the moment. Three
land-TF counterattack stances:
1. **Immediate Counterattack** — hit back at once; punishes weak **probes**.
2. **Spring a Trap** — hold, then strike when the attacker's **shock culminates** (over-extended).
3. **Defend from Prepared Positions** — no counterattack; preserve forces, lean on defensive advantages.
This sits alongside the 2-way **posture** stance (Disperse / Concentrate) — two orthogonal toggles on a land TF.

**Emergent read (why three is right):** the stances form an RPS against the attacker's **probe-vs-commit**
choice — *Immediate* beats probers but trades badly into a committed heavy assault (you counterattack into peak
shock); *Spring-a-Trap* beats committed assaults but whiffs on a prober who bails before culminating; *Defend*
risks nothing and reads nothing. The defender is making a **pre-committed read of attacker intent under
uncertainty** — the same mind-game as posture and agent orders. **The two axes interact (resolved):** **Dispersed weakens the counterattack** — a scattered force dodges
fires but can't mass a hard counterpunch, so *Spring-a-Trap* is strongest while **Concentrated** (you pay
fire damage to lie in ambush). This makes posture × counterattack a real four-quadrant choice. **Faction
exception:** **Mankind United** gets techs/perks that reduce or eliminate the dispersed-counterattack penalty
— their natural dispersed guerrilla style becomes a strength (breadcrumb for §9).

### 8.6.3 Stability & partisans (the blitz mechanic)  *(resolved)*
The attacker gains a **scaling bonus as the defender's region Stability falls** — partisans and disorder
behind the lines hamstring a defending TF. This is the canonical **Mankind United civil-war blitz**, and it's
one of the strongest **cross-layer combos** in the design: agents **foment unrest** (§5 cause-instability) to
drop stability, then a **weaker TF strikes** the softened region at the opportune moment. Military conquest
and agent subversion combine rather than compete. (Balance rides on how hard Stability is to move — the
defender fights back with Suppress-Unrest and its own stabilization.)

### 8.6.4 Terrain, fortifications & amphibious  *(resolved + two additions)*
Regions are large, so terrain is a single **Defensibility** attribute: a **natural** component (plains low;
mountain/forest/jungle high) plus a **built** component — **Fortifications**, upgradeable, giving a big
defensive bonus so even a **cheap TF can hold** (the **Hive porcupine** on Taiwan, as an alternative to
government-in-exile). **Siege loop (resolved).** Sustained long-range fires **degrade the built Fortifications only — never the
inherent geography component** — so *bombard to soften → then assault*, unifying standoff (§8.5) with
invasion and delivering the late-game "degrade over time" path. **Counter-value building damage repairs continuously** — a concurrent race against ongoing
damage, not a stop-then-heal sequence — so keeping a region suppressed needs genuinely *sustained* effort, not
a single strike followed by walking away. *(Refined — see the parallel Production-suppression mechanic in
§8.7, which uses the same damage/repair/diminishing-returns pattern.)*
**Amphibious ops:** a land-region TF can't hold ships; a water TF can **embark ground forces** (added, or
picked up from an adjacent land TF) — full embarkation mechanics (Weight, module tiers, cargo capacity) now
specified at §8.1.1. **Amphibious gating by domain control — resolved, using the existing per-region,
per-faction air/sea-superiority percentages (§8.5, §8.7)** — no new foundational mechanic, just a new
application of one already established:

- **Air and sea superiority are independently calculated** — sea from ships/subs/surface-attack-capable
  aircraft present in the region; air from fighters and ship-based SAM capability. Both already live-computed
  per region, per faction, and already scale continuously with actual contestation (a doom-stacked region
  elsewhere doesn't help an under-defended one; an actively-contested region's superiority drops even if the
  contesting force isn't winning outright — and rises again automatically the moment that contester retreats
  or is destroyed, since the percentage simply recalculates against whoever's left). **Long-range standoff
  duels count as contestation too** — a naval TF locked in a cruise-missile/CDCM exchange with an adjacent
  hostile land TF doesn't have free run of that maritime region, for the same reason any other active
  contestation reduces the value.
- **Hard gate:** an amphibious landing **cannot be attempted at all** unless **both** sea **and** air
  superiority are **independently at or above 50%** in the target region. Either one below 50% blocks the
  attempt outright, regardless of how dominant the other domain is.
- **Penalty scales linearly with the average of the two**, once the gate is cleared: **50% average = full
  defensibility penalty** (a landing right at the threshold is treated as maximally contested); **100% average
  = zero penalty** (a fully unopposed landing); every 1 percentage point of average superiority above 50%
  reduces the penalty by 2%.
- **Worked examples (confirmed):** 90% sea / 30% air → **cannot land** (air fails the independent 50% gate
  regardless of sea dominance). 50% sea / 50% air → **can land, full penalty** (right at the threshold). 90%
  sea / 50% air → **can land**, average 70%, penalty reduced as if at 70% (60% of full penalty remains). 100%
  sea / 100% air → **can land, zero penalty**, walk ashore.

This is why **sea denial doubly rewards the defender** (the Taiwan-strait dynamic) — cheap asymmetric assets
don't need to *win* the domain-control fight outright, just keep it below the 50% gate on either axis to deny
a landing attempt entirely.

### 8.6.5 Late-game: defense should dominate (design goal)  *(target)*
By late game, taking territory by force should be **hard**, requiring a **combination**: agent-driven
instability, **sustained fires to degrade** fortifications, **blockade** to starve the defender, and/or a
**decisive TF power advantage**. Achieved by **tuning** (fortification/defensibility tech scaling strongly,
shock diminishing vs. prepared defenses). **Caveat:** defense should be **dominant but breakable** by the
combined approach — the failure mode to avoid is a **total map stalemate** where nothing can ever be taken and
the game stagnates.

### 8.6.6 Battle resolution: Organization  *(resolved)*
Battles are decided by **Organization** (HOI4-style), not annihilation. Damage drains a TF's manpower and
equipment, but drains **Organization faster**. **Org → 0 ⇒ retreat** to an adjacent region, or **surrender**
if none is available; the victor gains **control of the region** + a **% of the loser's equipment**. So an
invasion is a **race to break the other's Org — including the *attacker's***, whose Org also bleeds during
the assault, so a failed/over-extended attack breaks and falls back.
**Robots have ~infinite Organization** — they never rout; they fight to **total destruction**, making
autonomous forces a categorically different (annihilation, not break-and-retreat) kind of war. **Mixed TF:**
when the *human* Org hits 0, the defender chooses **flee with the whole TF** or **leave the robots as a last
stand** — leaving them **splits the force by crewing** into two Task Forces: a retreating **manned** TF (manpower blocks) and an **autonomous-only remnant** that fights to destruction. The remnant may still *win* (the attacker's Org drops too) and **holds the region** if it does.
**Org regen (revised): Organization regenerates out of contact, capped by local Region Supply vs. TF
Supply-consumption while cut off** (§8.7) — not an unconditional full recovery. A local region gives basic
sustainment (food, ammo) toward keeping a force cohesive, but a logistically demanding TF (hypersonics-heavy,
etc.) stranded in a weak region **plateaus below full Organization**, genuinely unable to fully recover until
supply is restored — while a modest force in a strong region can fully sustain itself even cut off. Separately,
what a **blockade always denies outright is equipment/manpower replenishment** from the global pool, at a
rate scaling with how degraded the supply path is. So a cut-off force's fate now depends on the *mismatch*
between what it needs and what its region can locally provide — still not free to grind down (materiel denial
alone isn't lethal, and the Supply-ratio formula (§8.7) naturally keeps Organization non-zero except in
the edge case of a truly zero-Production region) — but genuinely more vulnerable than the previous "always fully
recovers" rule allowed.
*(Unlike HOI4, where any single region grants enough supply that cut-off ⇒ disorg; here local sustainment is
real but conditional on the TF's own logistics footprint, not a flat yes/no.)*

**Retreat & surrender (resolved).** At Org 0 the retreat graph keys on the **relationship of each adjacent
region's controller**:
- **All adjacent regions hostile** (any at-war faction — no defending TF required) ⇒ **surrender**. Controlling
  the *ring*, not physically blocking with units, is what bags a force (the cauldron).
- **Unoccupied / neutral / friendly adjacent** ⇒ retreat available.
- **Retreating into a *neutral* faction's territory** = a decision node: **harm relations** (illegal entry),
  **buy off** the consequences (soft power / money), or **seize it** ("this is mine now — you get out"), which
  can start a **new war** — and if a defending TF is present, your battered force likely loses. *(Couples to
  the diplomacy/relations system, fully specified in §9.)*

### 8.6.6.1 Task Force legibility (new — closes the loop on the siege/degrade strategy above)

**HOI4-style two-bar readout, gated by visibility.** A **green bar** shows **Organization**; an **amber bar**
shows **Strength** — current manpower/equipment against the TF's *authorized* composition (this concept
already exists — §8.7's auto-replenishment already tracks *authorized* vs. *current* strength; the amber bar
just exposes it visually rather than adding a new tracked value). **Visibility gate:** these bars are available
if the player has an **adjacent friendly TF**, or has run a successful **recon mission** with an agent against
the target. **Deeper granularity** — actual block-by-block composition — requires either a further **Agent
Recon** success or an **ISR advantage** (ties directly to domain control, §8.5, and to a country's **orbital
satellite bonus**, §6.10.1 — the space layer feeding straight into ground-level TF visibility).

**Closes the full siege loop into one legible player workflow:** run counter-value long-range fires against a
region → periodically check the **region's Production/Supply-suppression trend** (§8.7) and the **enemy TF's
Organization bar** (here) → watch it visibly de-org over time if the campaign is working → decide when the
Organization is low enough to invade and finish them off. Every piece from the siege-strategy discussion above
resolves into one coherent, watchable strategic loop.

### 8.6.7 Occupation: conquest → the §6 hold-it game  *(resolved — land-only, with a maritime gap it
surfaced now patched)*
On capture, the victor must **fully restore Organization** and raise **Stability to a floor** before
advancing — a **consolidation lock** that prevents instantly running down the fleeing enemy. The region takes
a **significant Stability hit**, but the player holds **control**. From there it's the §6 game: a **"nice"
occupation** (agents/propaganda to win popularity and begin collecting resources) or **force** (the TF
suppresses dissent, driving Stability up at the cost of **GDP and Population**). Conquest hands you the keys;
**keeping** the region is the popularity/stability game.

**Maritime consolidation lock — new, resolved.** This land mechanic exists specifically to stop a strong TF
from repeatedly chasing down and re-engaging a weaker, low-Organization retreating force before it can
recover. That same risk exists at sea, but the fix can't be the same one — maritime regions don't carry
Stability the way land regions do, so the full land lock doesn't translate directly. **A TF that wins a naval
engagement must fully restore its own Organization before it can move again** — a lighter version of the land
lock, using only the Organization-recovery piece since there's no Stability component to satisfy in open
water. Same purpose as the land rule: give a retreating, weakened TF genuine room to recover or relocate
rather than being run down turn after turn.

### 8.6.8 CAS & small-unit AA  *(resolved — cross-domain, confirmed)*
A distinct **close-combat-only** damage channel, separate from both the ground/naval exchange **and** theater
fires. **Confirmed to apply identically on land or at sea** — this is the maritime-strike/SUCAP scenario Eric
flagged from the start (attack helicopters and A-10-equivalents attacking ships, not just ground targets):
- **CAS** — rotary-wing, drones, and multirole aircraft in CAS config (JDAM-equivalent) add damage **on top of**
  the ground *or naval* fight.
- **Small-unit AA — domain-flavored, same role either way.** On land: SHORAD + MANPADS (a Stinger vs. an
  attack helo; a Humvee anti-drone system vs. an FPV drone). **At sea: ship-mounted point defense** — CIWS,
  short-range missiles, point-defense lasers — the naval equivalent filling the exact same countering role.
- **Ground-based SHORAD riding in a Naval TF's cargo holds doesn't participate** — this isn't a new rule, it's
  the existing §8.1.1 embarked-ground-forces-don't-fight restriction applying here specifically: land-based
  small-unit AA assets stuck as cargo during a sea battle are passengers, same as any other embarked ground
  unit. Only the ship's own mounted point-defense systems count as small-unit AA in a naval engagement.

**Two air-defense tiers, kept distinct:** *strategic/theater* AD (S-400, Patriot, THAAD + air-superiority
fighters at altitude) feeds the **air-superiority %** (§8.5, gating standoff fires); *small-unit AA* is
**organic point-defense** countering **CAS only**. They don't cross — small-unit AA can't touch high-altitude
fighters, and those fighters don't do CAS damage to close-in units. **CAS is doubly gated:** it needs
**theater air superiority** to reach the battlefield (a multiplier) *and* is **attrited by small-unit AA**
once there.

**Platform roles are a tradespace.** The designer allocates a platform across **air-superiority / long-range
strike / CAS** — pure A-10 (CAS), pure F-22 (air-sup), or hybrids (F-35, F-16; a B-1 flexing JASSM-in-standoff
vs. JDAM-in-CAS). You *can* build multi-role, never optimal at everything.

### 8.6.9 Special attacks: EW, EMP & cyber  *(resolved)*
A **debuff / conditional-damage layer** on top of the core exchange, each with an **expensive countermeasure
module**:
- **EW** (jamming pods) — degrades **radar-dependent** enemy air defense/effectiveness. Countered by
  **jam-resistance** (costlier, then immune).
- **EMP** (module) — **outsized damage to advanced/robotic units**. Countered by **EMP shielding** (costly).
  *The anti-automation equalizer:* the great counter to robot-heavy factions (Red Queen, LaserWard, a
  roboticized Hive), while Mankind United's flesh infantry are **naturally immune** — so the automation path
  is powerful but not strictly dominant, and the manpower faction gets a signature weapon against the machines.
- **Cyber** — corrected (resolved): unlike EW and EMP, which are genuine module-vs-module TF combat
  exchanges, cyber is **only an Agent Mission (Cyberattack, §10.5.2) hacking a TF's C2 node**, not a parallel
  TF-mounted offensive module — an off-map, agent-layer prep strike before a military attack (the
  covert-softens-then-strike pattern again, cf. §8.6.3), rolled on the attacking agent's Technical stat with
  a Quantum Computing tech-level bonus. It reduces all of a TF's stats for a pulse. **Countered by Cyber
  Hardening** (the same module already fully specified in the Quantum Supremacy chain, §10.5.2 — "Cyber
  Hygiene" in earlier drafts was unintentional terminology drift for this same thing, now corrected).

**Hardening metagame.** Shielding against all three is prohibitively expensive, so **scout what the enemy
favors** — an agent mission to **surveil/steal an enemy TF's specs** reveals it — or guess and hope. Same
intel-enables-counterplay loop as the rest of the game.

**Debuff weighting (resolved).** A special attack degrades only the **vulnerable-and-unmitigated share of the
*relevant capability*** — weighted by that capability's contribution, **not headcount** — so vulnerable units
can't hide under cheap immune ones. E.g. **unjammable-MANPADS infantry + radar-dependent SHORAD tanks** under
EW: only the tanks' AA is degraded; the TF keeps the MANPADS' share. Swap to **no-organic-AA infantry** + the
same tanks and the EW lands **fully** (all the AA lived in the jammable tanks). Same block-aggregation as the
combat profile (§8.3), applied to vulnerability.

### 8.7 Logistics, supply & blockade  *(in progress)*

**Supply sources.** A faction's reserve isn't placeless — it lives at **depots**: **capitals**
(permanent) and buildable **Arsenals** (canon term — a regional-modifier structure, §6.2, holding a
concentration of troops/equipment). Fielding from the pool, editing a TF, and replenishing losses all
draw through the nearest depot.

**Supply pathing (path check first, then contest).** For any TF the game finds a path back to the
nearest depot across the region graph:
1. **Path check** — a chain of **uncontested** regions ⇒ no penalty (unless it's *significantly* longer
   than the direct route).
2. **Contested transit** — if the path must cross contested regions, apply a **time penalty + transit
   attrition** scaled to how contested they are.

**Domain control is a map-wide field (unification).** The same air/sea-superiority value now does triple
duty — it gates **fires** (§8.5), sets **supply-path contestation** here, and modulates the
**reconfiguration lag** (§8.5.3). This means domain control must be a lightweight **per-region, per-faction
field across the whole map**, not just a number computed where two TFs meet. Sea regions/lanes are
first-class nodes in the graph, so **geography is strategic** — chokepoints and island chains decide who
can sustain force where (the Pacific/Taiwan theater).

**Auto-replenishment (closes the economic loop).** A TF has an *authorized* composition and a *current*
strength; as it takes losses the game **auto-refills toward authorized from the global pool, with a
delay**, routed through supply. Consequences: sustaining attrition **requires out-producing your losses**
(this is what economically bounds the cheap-mass "quantity" strategy — it's a production commitment, not
free); an **empty pool** or a **severed supply path** stops replenishment and the TF **withers** *(materiel
only — Organization regeneration is capped, not eliminated, while cut off; see the revised rule in §8.6.6)*.

**Region Supply & TF Supply-consumption (new — revises the previous "Org always fully regenerates when cut
off" rule; formula resolved).** Each **region** has a **Supply** value tied to its **Production** (illustrative
1:1 baseline — 1 Production point ⇒ 1 Supply point). Each **Task Force** has an aggregate **Supply-consumption**
value, summed from its blocks: basic infantry very low, vehicles higher, exotic platforms (hypersonic
launchers) highest — mirroring §8.3.1's cost profile (illustrative: Infantry 1, Rail Gun Tank 5, Hypersonic
Truck 10 — exact numbers TBD for the balance sandbox). **While cut off, Organization regeneration is capped
at `min(100%, region Supply-generation ÷ TF Supply-consumption × 100%)`** — a ratio clamped from above at full
recovery, not always reaching it.

**Resolved: the nonzero floor emerges from the formula itself, no separate rule needed** — as long as a
region's Supply-generation is strictly positive, the ratio can shrink arbitrarily but never mathematically
hits an exact zero.

**Worked example (illustrative numbers):** an under-developed South American region produces 20
Supply; the Hive (playing tall) produces 200. **TF Alpha** — 20 Infantry (20 Supply consumption) — regenerates
to a full 100% cut off in *either* region (20/20 = 100%; 20/200 clamps up to 100%, since the formula never
exceeds full). **TF Beta** — 10 Hypersonic Trucks + 20 Rail Gun Tanks (100 + 100 = 200 Supply consumption) —
regenerates to 100% cut off in the Hive (200/200) but only **10%** cut off in South America (20/200) — a
demanding force stranded somewhere too poor to sustain it, genuinely capped, not grindable for free.

**Resolved: the one true edge case — a region with literally zero Production/Supply producing a hard 0%
ceiling — is intentional, not a bug.** Stranding a demanding TF in a genuinely barren region is a real
strategic cost the player chose, not the original "grind a strong force down for free regardless of terrain"
exploit; no artificial minimum baseline Supply is needed.

**Degrading enemy Supply as a siege strategy (new — extends existing mechanics, doesn't invent parallel
ones).** A region's **current Production** (feeding both its economy, §7.3, and its Supply-generation, above)
can be **suppressed below its base value** — the same damage-and-repair pattern Fortifications already uses
(§8.6.4), applied to Production specifically. Three existing tools all feed the **same suppression pool**:
- **Counter-value standoff fires** (§8.5) — already targets GDP/Population/buildings; now explicitly cascades
  into Production/Supply.
- **Agent sabotage missions** — existing directed-aggression mission type, now explicitly usable against a
  region's industrial capacity.
- **Nuclear strikes** (§9.8) — a successful strike significantly drops a region's Production/Supply capacity.

**Deliberately preserved as a real, powerful strategy — up to and including driving a region toward zero
Production in a sustained, extreme campaign** (a defender bombed "into the stone age" can genuinely leave a
cut-off enemy TF at or near 0% Organization via the Supply-ratio formula above). But **diminishing returns
make full exhaustion inefficient**, not impossible.

**Fortifications (resolved — no new "hardening" stat needed) is the resistance multiplier, applying region-wide
to *both* counter-force and counter-value damage**, not just invasion combat. A mountainous, heavily-fortified
region requires proportionally more bombing to degrade Production than an open, undefended one — reusing the
existing Fortifications value (§8.6.4) rather than inventing a parallel one. *(Real-world grounding: dug-in
mountain facilities resisting repeated strikes, e.g. the Iran war.)*

**Diminishing returns (resolved) are baked directly into the suppression curve itself — no separately tracked
"hardening" value.** The same absolute reduction gets **harder to achieve as current Production drops relative
to base** — 100→95 costs less effective damage than 50→45, even though both are a nominal 5 points. For
**standoff fires**, this shows up as needing more raw damage per point of further suppression as the region
gets lower. For **agent sabotage**, the same curve shows up as **progressively harder success rolls** the
lower current Production already sits — flavored as "the region adapts to the threat," no separate hardening
stat, just the roll difficulty tracking the existing suppression level directly. *(Exact curve shape —
linear-in-ratio, exponential, etc. — is a balancing-sandbox target, §12.10.)*

**Repair is continuous, not sequential** — the region is always racing to rebuild even *under* active
attack, not just once bombardment stops (refines §8.6.4's Fortifications repair rule the same way: a
concurrent tug-of-war, not a stop-then-heal sequence) — so sustained suppression genuinely requires sustained
effort, trading off against time the way every other "quantity vs. patience" mechanic in this design does.

**Legibility requirement (the actual point of this mechanic):** the player must be able to **see** the
campaign working — a visible Production/Supply-suppression readout for the target region, ideally connected
directly to **any cut-off enemy TF's Organization regen ceiling** (§8.7) — so "our bombing campaign is paying
off, their Organization is low enough to finish them off" is a real, actionable read, not a hidden background
calculation. Same value-legibility principle as §8.5.1's combat-value-exchange requirement.

**Free consequence, not separately designed:** since Production is already a core economic resource (§7.3),
suppressing it is **simultaneously economic warfare** against the controlling faction's broader income —
independent of whether any TF happens to be cut off there at all. Reinforces why this strategy is worth
keeping rather than a narrow, situational trick.

**Blockade.** Fully cut a TF's path to any depot ⇒ no replenishment, no reconfiguration, ongoing transit
attrition ⇒ you grind it down over time. Capturing/destroying **depots** collapses the network feeding
everything downstream — losing your capital is catastrophic.

**Reserve model (resolved): one global pool, distributed across active depots.** A **capital** is always
a depot; some factions start with extra depots; all can **build** them. The pool splits into **equal shares
across active depots** (4 depots ⇒ each holds ¼) — which is how counter-value and capture bite the *pool*:
- **Damage** removes a proportional share (a depot at 25% damage this pulse ⇒ −1/16 of the pool; destroy
  1 of 4 ⇒ −¼).
- **Capture** of an *active* depot **transfers** its share to the conqueror (seized stockpiles).
- **Evacuation:** a faction about to lose a depot can evacuate — **takes >1 pulse** (no last-second saves),
  **recovers ~75%**, denies the rest.
- **Captured depots start OFF** (hold no share until the new owner activates them) — kills the
  bait-and-recapture steal loop.

**Emergent property:** more depots = pool more *distributed* (smaller per-loss, larger attack surface);
fewer = concentrated (catastrophic if hit). Placement is a tension — rear is safe but lengthens/embrittles
the chain to forward TFs; forward is responsive but capturable. *(Flavor hook: captured advanced equipment
may be unusable by a low-tech faction — ties to divergent tech trees.)*

## 9. Diplomacy, Relations & Global Tension  *(in progress)*

### 9.1 Three entities: region / country / faction
- **Region** — a map area (§6); belongs to a **country**.
- **Country** — a relationship-bearing political unit that owns regions and looks independent to the public;
  countries hold treaties/rivalries with each other.
- **Faction** — a player, who **controls** countries as a **puppet-master** (§6.4), steering them by its own
  agenda while they still appear sovereign.
Two relationship graphs sit on top: a **public country-order** and a **secret faction-game** (§9.5).

### 9.2 Global Tension (the escalation spine)
A single global stat that rises with **wars, broken treaties, disasters, assassinations**, and **gates
escalation** — at low GT you can't declare war without pretext, or use nukes (nukes TBD). **Red Queen's focus
is driving GT up.** Faction-differentiating: aggressive/military factions and RQ want GT **high**; the Gamer
and negotiated-victory seekers want it **manageable**.
**Contested, with a ratchet (resolved).** Easy to raise, hard to lower — escalation has momentum, and
stabilization (the Gamer's whole game) is a real but uphill goal, not a reset button. The incentive structure
that makes GT contested-yet-rising is the **Moloch Trap** (§9.7).

### 9.3 Country relations — the public order
States: **None · Alliance** (can be pulled into a war) **· Rival** (war-legal once GT clears a threshold —
rivalry **lowers** that threshold) **· At War.** Seeded starts:
- **US** controls its regions; treaty obligations to **Japan, NATO, Taiwan** (strategic ambiguity modeled as a
  treaty obligation); rivalries with **Russia, Iran, North Korea** — *not* China.
- **China** controls its regions; **rivalry with Taiwan.**

**War gate** = a **rivalry** + sufficient **GT** (no rivalry ⇒ needs higher GT). **Alliance chaining:** an ally
can be dragged into a war, which can pull the *controlling factions* into faction-level conflict.
**Agent actions** negotiate/end treaties and **Foment/End Rivalry** (manufacturing a war pretext) — **automatic
if one faction controls both countries**, else increasingly hard rolls (near-impossible with no control + low
popularity).
**Civil war** (event-driven, esp. the US): **mechanized in §6.8** as the Stability-driven uprising rule
firing across many regions of one country at once — spawns new countries in existing regions, may flip a
region's flag, **zeroes that country's relations**, and raises infiltration vulnerability.
**Inheritance:** peacefully taking a country inherits its **country**-relations (e.g. Japan's US alliance) — on
the *country* basis, **not** the faction basis.
**Span-of-control escape (à la TI):** fabricate a rivalry between two countries you control → attack →
**incorporate** the region under the winner's flag, consolidating land under fewer country banners to duck the
span cap (§6.5).

### 9.4 Faction relations — the secret game
States: **Friendly · Neutral · Wary · Hostile**, spanning cooperation → mission-gating → hostile action →
attempts to **destroy** a faction. **Improved by** agent missions, gifts, trades; **damaged by** agent missions,
hostile actions, military conflict. **Discovery:** only **US, MU, China** are public at start; the rest are
**hidden but discoverable** through the intel layer (encountering their agents), defaulting to **Neutral** on
discovery. Certain missions are **gated by relations** (e.g. Gamer↔Hive research-sharing needs Friendly).

### 9.5 How the two graphs couple (the seams)
- **Control confers foreign-policy authority** — a faction runs its countries' treaties, rivalries, and wars.
- **Overt vs. covert** — **country** relations govern **military/territorial** war; **faction** relations govern
  **covert/agent** conflict and cooperation.
- **Alliance chains** pull controlling factions into country wars (MU attacks Japan → Japan's US alliance → US
  *faction* at war with MU).
- **Inheritance** carries **country** relations, never **faction** relations.

### 9.6 The opening: the Taiwan crisis (scripted bootstrap)  *(deep design → §4 Red Queen / §11 Events)*
GT starts too low to war even rivals. **Red Queen's opening playbook:** run book-accurate missions that spike GT
via a **Taiwan crisis**. **Success →** a **Taiwanese shootdown of a Chinese satellite → Kessler syndrome** (disaster: severely
restricts space access, fixable late-game — also gates the Moon/orbital layer; a global, no-choice informational
event) → triggers **China's response decision** (mechanized in §11.6's "The Provocation Will Not Stand"). **Failure →** RQ pivots to **high-profile assassinations** of world leaders (higher success %), each
raising GT until China can war. Then the **US faction decides whether to enter** on Taiwan's behalf → GT rises
further → the game goes **hot** (factions act relatively unrestrained; still no nukes).

### 9.7 The Moloch Trap (the Global Tension incentive structure)  *(in progress — central theme)*
The book's central theme, as a mechanic. **For most factions, escalatory (GT-raising) choices are locally
beneficial** — unlocks, buffs, and malady relief — **especially early**, while refusing or reducing GT is
**punishing**. So each faction, acting in rational self-interest, collectively drives the world toward chaos:
*"if we don't, someone else will, and it'll be worse."*

**Red Queen is the catalyst, not the engine.** She tips the first domino (the §9.6 opening) and shapes the
incentive landscape; once it's moving, **the other factions produce most of the GT rise themselves**. She wins
by aligning humanity's self-interest toward chaos, not by fighting it. **The Gamer is the sole inversion** —
rewarded for *lowering* GT; its multi-pulse missions reduce it (storyline: reduce GT → detect RQ as a
deliberate actor → confront her via a final team agent mission).

**Faction dilemma template** (a repeatable event/decision node — faction-specific, often ironic):
`refuse to escalate → −GT + a punishing malady` **vs.** `escalate → +GT + unlocks/buffs/malady relief`.
- **US:** *don't* join the Taiwan war → −GT, but the permacrisis malady worsens and RBO allies drop out faster
  (US guarantees no longer credible). *Join* → unlocks **Arsenals** (depots, §8.7) + **conscription** (manpower).
- **China:** *don't* invade Taiwan → but it's a victory condition, and a severe malady hits (citizenry read the
  CCP as weak; destabilization). *Invade* → **conscription** + research/production bonuses + relief of the
  starting **debt** malady (national mobilization).
*(Others get their own — e.g. Mankind United's anti-AI destabilization tactics ironically feed the AI by
raising GT. Authored per faction in Events, §11.)*

**[Proposed — the temporal inversion that closes the trap].** The benefits of raising GT should be
**front-loaded** (early unlocks / malady relief) and the costs **back-loaded** (late: RQ's power scales with
GT, disasters and instability degrade *your own* holdings, nuclear risk). Otherwise GT-raising is just a good
button everyone mashes; the *trap* is that it's rational early and ruinous late, and the ratchet means you
can't easily walk it back once you've built the momentum. **Resolved in full by §9.8's escalation ladder.**

**[Proposed — tipping point / phase structure].** An **early window** where GT is still reversible
(stabilizers can prevent the cascade); past a threshold the factions' own incentives make it **self-sustaining**,
and the Gamer's job shifts from *prevent* to *delay + confront*. Frame the Gamer not as winning a 1-vs-6 tug-of-war
but as **racing to reach the RQ confrontation before GT hits her ascendance threshold** — GT-reduction is their
holding action, not the literal win.

**Faction stances toward Global Tension** (each faction's relationship to the central theme):
- **Drivers** — raise GT for advantage, caught in the Moloch dilemmas (US, China; likely MU, LaserWard,
  Widows — exact placement TBD).
- **Fighter** — the **Gamer**: rewarded for *lowering* GT, racing to the Red Queen confrontation.
- **Survivor** — the **Hive**: a **neutral** relationship, *no* Moloch dilemmas. High GT/chaos actually opens
  survival avenues (flee Taiwan → government-in-exile → found the arcology in a low-stability/uncontrolled
  region). Their dilemmas are **tragic-survival** ("this is terrible, but we must survive"), not coordination
  traps.
- **Catalyst / beneficiary** — **Red Queen**: wants GT at 100% (§9.8).

### 9.8 The escalation ladder & nuclear endgame  *(in progress)*
High GT "bites" not as a passive malus but as the progressive **unlocking of catastrophic actions** — plus lost
**GDP / production / population**, which regrow slowly at 1-week pulses, so the damage *lasts*. Crucially,
nuclear/mass-casualty uses **themselves raise GT**, so the top of the ladder is a **positive-feedback race
condition**.

**GT thresholds** (each with an escalating in-world warning to find an off-ramp "or rule over ashes"):
- **70%** — **dirty-bomb** missions unlock; first use warns the taboo is breached and may worsen.
- **80%** — **tactical nukes** deployable to TFs; outsized damage in long-range fires.
- **90%** — **strategic nukes** launchable by factions; non-faction nuclear states can be **agent-induced** to
  launch at rivals (the book's India–Pakistan exchange).
- **95%** — final warning: **strategic command goes autonomous** (launch-on-warning — inadequate I&W for a
  survivable second strike, so they fire on any indication, not on orders).
- **100%** — **scripted global exchange** (China→US; US→China+Russia; Russia→US+EU; NK→SK+Japan; UK+France→
  Russia; India↔Pakistan; Israel→Iran; any other nuclear state hits its rivals/enemies).

Other high-damage lategame missions also exist — **bioterror**, including a **lasting pandemic**.

**[Resolved] GT 100% = Red Queen's victory / universal human loss** (explicitly confirmed). This gives the Moloch Trap a terminal
stake and turns the **90–99% window into the knife-edge race**: aggressive factions gamble to close out their
own victory in the unrestrained high-GT zone *before* the auto-exchange, while everyone else sprints for an
off-ramp. "Ruling over ashes" is the *warning*, not a playable state. (RQ's simplest endgame then: engineer a
single launch in the 95%+ zone and let launch-on-warning cascade — so the finale turns on one spark.)

**Missile defense:** regional air-defense buildings + stationed TFs can model **BMD**, but biased to intercept
only a **fraction** unless a faction has **invested deliberately over time** — no overnight shield.

**Off-ramps — the trap inverts (cooperation beats the coordination failure):**
- **Gamer — Lunar Strike** (second-to-last progression mission): lunar strikes **eliminate all nukes on
  Earth**, buying time for the final mission.
- **LaserWard — Rods from God** (unlock if Earth orbit is clear): destroy nukes, or serve as potent
  **non-adjacent** long-range fires (counter-value or counter-force).
- **Red Queen counter — Doomsday Subs:** unlocked **only if the Gamer denukes** — 2 subs release large
  **salted** nukes. If launched, the **Gamer can share the intel with any non-hostile faction, making the subs
  targetable** — a late **coming-together** that denies RQ the win.
- **Gamer — Convert Red Queen** (the win condition): a complex multi-pulse **team** mission to change her
  objectives; gated on **RQ research/intel progress**, *not* on the Lunar Strike (can run in tandem). Other
  factions may get their own anti-RQ routes (TBD).

## 10. Tech & Progression  *(in progress — fully reorganized by category, September 2026)*

### 10.1 Design Overview  *(formerly Core Architecture)*
**One shared tech tree** (not per-faction), consistent with the unified-ruleset principle (§2). Mankind
United is gated off specific nodes (currently: AI/automation) and gets **substitute nodes** achieving a
comparable outcome by a different method — a standing design rule, not a one-off (also used for MU's
dispersed-counterattack perk in combat, §8.6).

**Node schema.** Every tech node carries:
- **Name**
- **Category** (Military / Industrial / Social-Biological / IT — always exactly one)
- **Prerequisite(s)** — the *only* stored dependency relationship. Zero, one, or several other techs;
  occasionally an *ongoing* condition rather than a one-time check (Quantum Supremacy's Quantum-Nexus-level-5
  requirement, §10.5.2, gated by the tree-wide pausable-progress rule, §10.1.1). **"What does this tech
  unlock" is never separately stored** — always computed by querying which other nodes, platforms, buildings,
  or missions list this tech as their own prerequisite or gate condition. One source of truth for the
  dependency graph, not two that can drift out of sync.
- **Numeric effects** — always additive percentages or flat amounts on a growing base, never a flat absolute
  number pulled from nowhere (the same design rule §7's economy follows).
- **`HasSubstituteTech`** (boolean, defaults False). When True, the tech is a **family of faction-keyed
  variants sharing one record** — same tree position, same prerequisites, same tier, defined exactly once;
  only name, description, and numeric effects vary per variant. Two shapes currently exist:
  - **Binary substitute** (the AI-lockout pattern, §10.5.1) — a `default` variant most factions see, one
    `Mankind United` override.
  - **Multi-way family** (the Surveillance/control chain, §10.4.1) — a `default` variant (US/China,
    coincidentally shared, not semantically special) plus four named overrides (MU, Hive, Widows, Gamer).
  - **LaserWard resolves dynamically, never stored as its own variant.** A LaserWard player's *research
    progress* through a `HasSubstituteTech` chain is faction-agnostic and persists regardless of host — only
    the *displayed* variant (name/flavor) is computed fresh from their **current** host faction each time
    it's shown. Switching hosts mid-game relabels the chain; it never resets progress or forces re-research.
  - **Eligibility gates every acquisition path**, not just direct research — theft and licensing are blocked
    by the same `eligible_factions` check (MU can't steal AI tech from LaserWard; the Hive can't steal
    China's surveillance tech; a LaserWard-hosted variant follows the same rule under whichever host it
    currently has).
- **Leveled/tiered status** — single-shot unlock vs. multi-tier (flat tech tiers like Targeting Computer
  I/II/III, §10.2.1.3, or a scaling regional building like Quantum Nexus, §10.5.2, subject to the escalating-
  cost curve, §7.7).
- **Flavor/canon grounding** — the narrative justification tying it back to the novels.

**Starting-unlock exceptions live on the faction, not the tech.** Which techs a faction begins with pre-
researched (Nanometer Semiconductors for US/China/Hive, Reactive Armor for US/China, Social Surveillance for
China, AI Assistants for the Gamer) is part of that faction's own definition, alongside its starting agents
and regional perks — not a list maintained on the tech side.

### 10.1.1 Tree Shape
**HOI4/civ-style tiered tree with hard prerequisites** (not a loose unlock-in-any-order pool). The general
pattern: a **major keystone unlock** opens a **cluster of coequal options**, and the player then chooses to
**spec deep** into one (e.g. become the "laser king") or **stay balanced** across the cluster. Example:
**Crash Military Modernization** (keystone) → unlocks **railguns, lasers, hypersonics** as a coequal cluster
(§10.2.2).

**Pausable, lossless research progress.** For any tech whose prerequisite is an *ongoing* condition (not just
a one-time unlock check — e.g. maintaining a building at a minimum level), losing that condition mid-research
pauses progress rather than resetting it. The faction can freely redirect research elsewhere and resume later
at no loss once the condition is regained. A standing principle for the whole tree, first surfaced in the
Quantum Supremacy chain (§10.5.2).

**Research cost grows steeply with chain depth** — a cross-cutting principle, every chain. Low-Research
factions face a real choice: spread broadly across many shallow techs, or commit deep down one chain.
Factions with a high sustained Research ceiling (LaserWard-plus-host via dual-pool sharing, §11.9; the Hive
via its tall-play economic advantage, §7.7) can afford both breadth and depth — a real structural edge
distinct from any single tech's numbers.

### 10.1.2 The Four Main Categories  *(truncated overview — full content lives in §10.2–10.5 below)*
- **Military** — a spectrum, not a fork: exquisite platforms vs. cheap mass, the same value-and-saturation
  axis as combat itself (§8.5.1, §8.6). A faction can sit anywhere on it.
- **Industrial** — manufacturing and the technologies that scale it; Fusion Power is the keystone, a race and
  theft target.
- **Social/Biological** — malady mitigation, popularity-mission efficiency, span-of-control, agent bonuses —
  dual-valence, with both dystopian and positive branches.
- **Information Technology** — AI for robots, industry, cyber, and research.

### 10.1.3 The Hive Victory Tech Stack
**Molecular Machinery** (Industrial-tech nexus, §10.3.2) is the keystone that opens **both** the biological
and nanotech branches. Branches culminate in **Aging Reversal** (biological immortality, §10.4.2) and
**Nanotechnology** (nanotech mastery, part of the Molecular Machinery chain, §10.3.2). **Quantum Supremacy**
is the capstone of the Information Technology category (§10.5.2), the third leg, reached independently of the
Molecular Machinery branch. **All three victory legs are fully designed**; exact victory-trigger mechanics
(what happens once a faction holds all three) are still TBD, a later pass.

---

### 10.2 Military

### 10.2.1 Basic Military Tech

### 10.2.1.1 Platforms
Tech-gated, and starting unlocks differ by faction (a differentiation lever): everyone starts with **Infantry,
Vehicles, FPV Drone Team**; some factions (China, US) start with **Tanks, Light Aircraft, Rotary-Wing
Aircraft, Large Aircraft, Medium Drone, Large Drone, Small Boat, Small Ship, Large Ship, Submarine** already
unlocked. **Humanoid Robot** and **Robot Crab** are role-distinct, not cosmetic reskins, and — unlike every
other robotic variant below — have no manned equivalent: Humanoid (cheap, slowest, light weapons only), Crab
(slow but reduced terrain penalties, a rough-terrain specialist). **Robot Dog** is a lesser infantry-
equivalent — the Widows get it free as a standing faction perk, no tech research required, though actually
building units still requires Control of the region (§11.8). **Airship** joins the roster fully researchable,
and uniquely can attach to a Naval Task Force with no restrictions at all (§10.2.1.3).

Every other conventional platform (Vehicle, Tank, Submarine, and the rest) becomes its **robotic equivalent**
automatically once fitted with the Autonomous module (§10.5.1) — Tank → Robot Tank, Vehicle → Robot Vehicle,
Submarine → Robot Submarine — not a separate platform entry, just an existing platform plus a module.

1. Infantry
2. FPV Drone Team
3. Robot Dog
4. Humanoid Robot
5. Vehicle
6. Tank
7. Robot Crab
8. Medium Drone
9. Large Drone
10. Rotary-Wing Aircraft
11. Light Aircraft
12. Large Aircraft
13. Airship
14. Small Boat
15. Small Ship
16. Large Ship
17. Submarine

### 10.2.1.2 Weapons Modules
The Legacy/mass-strategy lines are fully specified, no Crash Military Modernization required — cheaper,
independently upgradable, the backbone of a mass, research-constrained, or single-uber-line-spec playstyle.
Everything else below is a **new node — stub only**, formalizing weapon types that have so far existed purely
as narrative flavor inside Combat (§8), not yet given their own numeric spec.

1. **Small Arms** — fully specified (Legacy line).
2. **Man-portable Anti-Tank** — *stub.* Not a separate mechanic from the piercing-vs-armor curve (§8.6) —
   the cheapest point on that same curve: real but heavily mitigated penetration, proliferable at low tech (an
   outnumber-25:1, not 1000:1, proposition against armor). A continuous function, not a tiered system —
   heavier anti-armor weapons simply sit further up the same curve, closer to full effectiveness against a
   given armor class.
3. **Man-portable Anti-Air** — *stub.* Tier 1 of small-unit AA: the cheapest, weakest, most proliferable —
   the low-tech faction's niche (Mankind United specifically). Mountable on infantry, vehicles, tanks, or
   small boats (for swarm tactics); a wasted module on a ship.
4. **Cannons** — fully specified (Legacy line).
   - 4.1 **Short Range Air Defense** — *stub.* Tier 2 of small-unit AA: vehicle-mounted, more capable than
     man-portable, still within the same CAS-countering combat bucket (§8.6.8) — a further step up the
     small-unit-AA proliferation ladder, not a separate strategic layer.
5. **Artillery** — fully specified (Legacy line).
   - 5.1 **Rocket Artillery** — *stub.*
   - 5.2 **Ballistic Missiles** — *stub.*
   - 5.3 **Cruise Missiles** — *stub* (already named as a sub-mountable weapon in the submarine warfare
     session, §8.5.2, never given its own tech-tree number until now).
   - 5.4 **One-way Attack Drones** — *stub* (already referenced narratively as "OWA drones" throughout
     Combat's cheap-mass examples, §8.5.1).
   - 5.5 **Surface-to-Air Missiles** — *stub.* Tier 3 of air defense — the genuinely separate strategic/
     theater layer (S-400/Patriot/THAAD-equivalent) feeding the air-superiority % that gates standoff fires
     generally (§8.5), distinct from the small-unit-AA bucket above.
6. **Air-to-Ground Munition (CAS)** — fully specified (Legacy line).
7. **Air-to-Ground Missile (Standoff)** — fully specified (Legacy line).
8. **Air-to-Air Missile** — *stub.*
9. **Torpedo** — *stub* (named in the submarine warfare session, §8.5.2, but never given its own standalone
   tech-tree number until now).

### 10.2.1.3 Support Modules
1. **Armor** (Reactive, Advanced Composites, Diamondoid) — fully specified. US and China start with Reactive
   Armor already unlocked.
2. **EW / Countermeasures** — fully specified. Multiple paired levels — each tier unlocks both the offensive
   jamming tool and its own-tier Countermeasures module simultaneously, one research action, not two separate
   trees (feeds §8.6.9's hardening arms race). A combat system, not an infrastructure or information concern
   — stays Military.
3. **Targeting Computer** — fully specified. Leveled (Targeting Computer I/II/III), a straightforward combat-
   accuracy line — increasing precision at each tier.
4. **ISR / Radar / Sonar Modules** — *stub, but fully defined conceptually.* Effect depends on the mounting
   platform: **ISR** on a heavy aircraft functions like JSTARS (ground-support/air-to-ground advantage);
   **Radar** functions like AWACS (air-to-air advantage); **Sonar** functions like sonobuoys (a Task-Force-
   wide detection contribution in an anti-submarine fight, feeding the aggregate detection score, §8.5.2).
   Kept as one grouped node — categorically linked as a platform's sensor suite, even though the specific
   bonus each grants differs by context.
5. **ASW (Anti-Submarine Warfare) Module** — *stub, genuinely distinct from Sonar above.* Combined detection
   *and* attack capability against submarines — a dedicated frigate or sub-killer submarine would carry both
   a Sonar module (passive sensor) and an ASW module (towed array + torpedoes) together.
6. **Flight Deck / Light Carrier / Fleet Carrier Modules** — fully specified (§8.1.1). Three escalating,
   mutually exclusive tiers sharing one capacity-budget mechanic (a light aircraft squadron = 10, a rotary-
   wing or drone squadron = 5): Flight Deck (light or large ships, capacity 5), Light Carrier (large ships
   only, capacity 10), Fleet Carrier (large ships only, very expensive, capacity ~70–75, confirmed against
   the Seventh Fleet's actual composition, §11.7). A ship carries at most one of these three, ever.
7. **Cargo Hold Modules** — fully specified (§8.1.1). Unlike the air-capacity modules above, these **stack**
   — multiple allowed per ship, trading weapon/defensive slots for ground-forces capacity (light units get
   more slots per hold than heavy ones). Cargo Hold plus Light Carrier on the same large-ship platform
   produces an LHA-analogous configuration.

*(Ship Fusion Power is deliberately not listed here — see §10.3.1 for the cross-reference; keeping the
Industrial-side unlock and the Military-side module description in one place, not duplicated across both,
the same pattern already used for Cyber Hardening, §10.5.2.)*

### 10.2.2 Advanced Military Tech  *(unlocked behind Crash Military Modernization)*
1. **Rail Guns** — leveled; Rail Guns 1 opens two side chains:
   - 1.1 **AA Rail Guns** (anti-air variant)
   - 1.2 **Eyes** (a rail-gun-launched ISR drone)
2. **Lasers** — leveled, primarily defense-oriented on the main line; Lasers 1 opens:
   - 2.1 **Communications Lasers** (a side chain)
   - 2.2 **Laser Broom** (a dedicated counter to Kessler Syndrome, §9.6 — directly reusable to *fix* the
     orbital-denial disaster, not just avoid it)
   - 2.3 **Heat Ray** (an offense-oriented branch, well-suited to CAS, contrasting the defensive main line)
3. **Hypersonics** — leveled; forks into Surface-launched and Air-launched mains, with:
   - 3.1 **Air-to-Air Hypersonics** (a side chain)
   - 3.2 **Shielded Hypersonics** → **Plasma-Sheathed Hypersonics** (costlier, reduces laser effectiveness
     against it; less accurate and more expensive but laser-immune — a literal, named instance of the RPS
     combat pillar: lasers counter conventional missiles, Plasma-Sheathed Hypersonics is the tech-tree answer
     that counters lasers specifically)

---

### 10.3 Industrial

### 10.3.1 Fusion Power
**Keystone — locked until the global Fusion Breakthrough event fires** (§11.7).
1. **Fusion Power Plant** (Regional Building) — the full regional-building-scale fork.
2. **Miniature Fusion Reactor** — the ship/airship-scale fork. **Unlocks the ability to research the Ship
   Fusion Power module** in the Military category (§10.2.1.3) — a cross-reference only, the module itself
   isn't separately listed under Military.
3. **Tokamak Reactor** — canon's more efficient successor to the initial Fusion Power Plant design.

### 10.3.2 Molecular Machinery  *(fully specified — Industrial keystone and downstream; two prerequisites
span Social/Biological and IT)*
**Two prerequisites, both already unlocked at game start for the US, China, and the Hive:** Advanced Field
Medicine (Social/Biological, §10.4.2) — +5% Manpower Recovery, gates further Social/Biological-branch techs;
Nanometer Semiconductors (IT, §10.5.1) — +2% Research, +2% Production income.

**Molecular Machinery** (Industrial keystone) — +5% Research, +5% Production, +5% Manpower Recovery, +10%
Supply produced from a given Production value — the first tech modifier to the previously-flat 1:1 Production
→Supply baseline (§7.3): a 100-Production region shows as **100(110)**. Flavor: synthesized food and
necessities manufactured from constituent parts (canon: lab-grown meat replacing the Hive's need for
ranching). **Unlocks, confirmed together:** the Hive's tech-victory chain, Red Queen's Phase 2 transition
(§4.3), the Gamer's Lunar Strike mission line (§4.4) — arguably the single most load-bearing node in the
midgame tree.

**New building: Production Facility** — converts Production into Equipment, or channels it into regional
construction. **Molecular Production Facility** unlocks after Molecular Machinery: strictly more cost-
efficient at any given level than the vanilla version. Under the escalating-cost curve (§7.7), an ordinary
faction mixes Molecular and vanilla Production Facilities in a region — the same optimization pattern already
established for Energy buildings.

- **Hyperscalar Microfactories** (Industrial, requires Molecular Machinery) — +5% Production income.
- **Nanoscale Mechanics** (Industrial, requires Hyperscalar Microfactories) — +5% Research income.
- **Nanotechnology** (Industrial capstone, requires Nanoscale Mechanics — **one of the Hive's three victory-
  condition techs**) — +10% Production, +5% Research, +5% Manpower Recovery, +5% combat effectiveness on
  defense (units and Fortification effects, §8.6.4), +5% Energy production for all Energy-related buildings,
  +10% Supply produced from a given Production value (stacks additively with Molecular Machinery — both
  together show as **100(120)** for a 100-Production region).

### 10.3.3 EMP / EMP Hardening Modules
Multiple paired levels — each tier unlocks both the offensive EMP tool and its own-tier EMP-hardening module
simultaneously (feeds §8.6.9's hardening arms race, the automation-counter pillar). Placed in Industrial
rather than Military or IT because EMP-hardening is fundamentally a **physical engineering** problem —
shielding, grounding, circuit robustness — not a combat system (EW's home, §10.2.1.3) or an information-
systems one (Cyber Hardening's home, §10.5.2). **Not gated by Nanometer Semiconductors** — decoupled from EW
on reflection, not technologically linked to semiconductor fabrication the way EW's threat-analysis and
software-defined emissions are. Modules mount on Military platforms (§10.2).

---

### 10.4 Social/Biological

### 10.4.1 Surveillance/control chain  *(fully consolidated here for the first time — previously scattered
across LaserWard's and the Hive's event content)*
The same 4-step mechanical chain gets a different name per faction, using the `HasSubstituteTech` family
architecture (§10.1): **China/US** — Social Surveillance → Loyalty Scores → Predictive Algorithms → Control
Nexus (China starts with Social Surveillance already unlocked); **Mankind United** — Self-Sovereignty →
Learning Organizations → Power Sharing → Decentralized Culture (a deliberate echo of MU's existing AI-
substitution "learning-organization" flavor, §10.5.1); **The Hive** — Radical Asceticism → Group Obligation →
Collectivism → Harmonious Culture; **The Widows** — Religious Reawakening → Higher Purpose → Lived Religion →
True Believers; **The Gamer** — Group Dynamics → Team Building → Social Bond Theory → Means vs. Ends.
**LaserWard adopts whichever version matches its current host** — resolved dynamically from current host
faction each time it's displayed, never stored as its own variant; a LaserWard player's actual research
progress through the chain is faction-agnostic and carries over untouched across a host change, only the
displayed name and flavor change (§10.1). Raises Stability and span-of-control as it deepens. **Dominance
Phase** (LaserWard's own escalation mechanic, §11.9) unlocks after the fourth, final tech in the chain.

### 10.4.2 Aging Reversal Chain  *(fully specified, Social/Biological throughout)*
**Scope note:** biological immortality would have profound societal effects, but the game's timeframe is a
few years, so effects are hinted at through flavor and mechanics, not deeply simulated.

**Chain:** Advanced Field Medicine → Genetic Engineering → Biotechnology → Advanced Biotechnology → Aging
Reversal.

- **Genetic Engineering** (requires Advanced Field Medicine) — +5% Research income. Opens the Global
  Sterility Pandemic (China, §11.6).
- **Biotechnology** (requires Genetic Engineering) — +5% Manpower Recovery. Unlocks paying Money **per
  agent** for **"Genetically Enhanced"** — +1 to all four attributes, the same shape as the AI-Assistant
  mechanic (§10.5.1) but biological rather than digital, picked per-agent rather than faction-wide. Also +5%
  offensive/defensive combat stats for **human infantry specifically** (not robot infantry) — a natural
  priority branch for Mankind United, locked out of AI/automation but with full, unrestricted access here.
- **Advanced Biotechnology** (requires Biotechnology) — +5% Manpower Recovery. A second paid per-agent trait,
  **"Genetically Optimized"** (stacks with Genetically Enhanced). A further +5% human-infantry combat stats
  (10% total with Biotechnology's own). **"Elderly"** malus trait: some agents can have or spawn with it —
  −2 Security, −1 Espionage, plus a chance of sickness-flavored dilemma events on a mission. Canon: Frank
  starts with Elderly, reflecting his being sidelined a few times in the novels due to age. Advanced
  Biotechnology lets a faction pay Money to remove it from any agent who has it.
- **Aging Reversal** (requires Advanced Biotechnology — **the second of the Hive's three victory-condition
  techs**) — +5 Stability in all controlled regions (flat, not a percentage), +5% Manpower Recovery. A third
  paid per-agent trait, **"Permanent Youth"** — grants +Loyalty instead of a flat attribute boost, fitting its
  flavor. A final, deliberately small +1% human-infantry combat stats (11% cumulative chain total). Reduces
  the Permacrisis (§11.7) by one level if the researching faction (US or China — the only two who share the
  mechanic, §11.6) still has it active when the tech unlocks.

**Cumulative Manpower Recovery math, confirmed clean:** six +5% sources total — Advanced Field Medicine,
Molecular Machinery, Nanotechnology (§10.3.2), plus Biotechnology, Advanced Biotechnology, Aging Reversal
(this chain) — 30% on top of the 50% baseline = **80% at full completion**. Comfortably under the 100%
ceiling: real combat deaths still happen even at maximum tech, but most serious casualties now recover.

### 10.4.3 Algae Cultivation  *(new node)*
No prerequisite — researchable and buildable by any faction from the start of the game. Provides a small
Supply/nutrition yield alongside Energy (§7.8), letting a fuel-poor region manufacture its own fossil fuel
locally rather than depending on imports vulnerable to blockade.

---

### 10.5 IT

### 10.5.1 Classical Computing and AI  *(fully specified, Information Technology; parallel to the Quantum
Supremacy chain, not a prerequisite for it)*
**Design shape:** every node pairs with a Mankind United substitute via the `HasSubstituteTech` binary
pattern (§10.1) — the AI-lockout principle made concrete with real numbers. MU's substitutes are consistently
comparable but generally lesser.

- **Nanometer Semiconductors** (no prerequisite, some factions start with it — near-theoretical semiconductor
  fabrication limits) — +2% Research, +2% Production income. Gates the early Targeting Computer and EW/
  Countermeasures tiers (§10.2.1.2–3) — EW specifically, because sophisticated threat analysis and software-
  defined emissions are genuinely computing-driven. **Mankind United does not start with this tech** — can't
  compete in EW/Countermeasures until Research catches up or they steal it.
- **AI Assistants** (no prerequisite, the Gamer starts with it unlocked) — enables purchasing agent-stat
  enhancements (named and generic assistant system, §5.4). **MU substitute: "Interlinked Cells"** (reflects
  MU's federated leadership structure). Unlocks a paid per-agent trait, **"Networked"** — +1 Security/
  Espionage.
- **Agentic Scaling** (requires Nanometer Semiconductors) — +3% Research, +3% Production, +2% Money income.
  **MU substitute: "Advanced Tool-Assisted Work"** — +1% Research, +2% Production, +1% Money.
- **AI Propaganda** (requires Agentic Scaling) — +5 Stability (flat), +1 on rolls for Popularity/Stability-
  targeting missions. **MU substitute: "AI Detection"** — +5 Stability plus −1 to other factions' rolls when
  targeting MU-controlled regions with Popularity/Stability missions (trades the offensive bonus for a
  defensive one).
- **Automation — two levels, deliberately simple.**
  - **Level 1, "Semi-Autonomous Operations"** (requires Nanometer Semiconductors) — unlocks the "Semi-
    Autonomous" module (any platform except Infantry, §10.2.1.1, −75% Manpower requirement; at release only
    pairable with drone aircraft). **MU substitute: "Computer Assisted Training"** — −50% Production cost to
    convert Population into Manpower, a different lever entirely.
  - **Level 2, "Autonomous Operations"** (requires Agentic Scaling) — unlocks the "Autonomous" module
    (Manpower to zero). **This is what unlocks the Humanoid Robot and Robot Crab platforms** (§10.2.1.1) as
    buildable — no separate tech needed, those chassis already carry no-crew-cost in their base definition.
    **MU substitute: "Back to the Land Movement"** — a moderate Population growth bonus (smaller than the
    Hive's), migrants fleeing AI's societal effects settling in MU territory.
- **EMP interaction:** a Semi-Autonomous unit hit by EMP takes reduced effect (75% of the debuff lands) —
  fallback to degraded manual operation. A fully Autonomous unit has no one aboard to fall back to — takes
  the full, unreduced effect. Deliberate asymmetry: partial automation buys partial EMP resilience.
- **Economics:** automation is a genuine standing economic incentive — the module costs Production, but the
  Manpower reduction saves more than that in avoided training costs, compounding via reduced GDP erosion from
  the Manpower Recovery pipeline (§10.4.2) running in reverse. Ceteris paribus, always an incentive to
  automate wherever possible — the concrete mechanical driver behind the novels' late-game trend toward
  robotic-heavy US/China forces over Taiwan.

### 10.5.2 Quantum Supremacy Chain  *(fully specified, Information Technology throughout)*
**Design shape:** offense and defense grow from the same investment, not a paired-tech mirror like EW/EMP.
Each step boosts the faction's own Cyberattack mission rolls (offense — an Agent Mission, §5.2, rolling on
Technical, not a parallel research node) and unlocks or levels the faction's own Cyber Hardening module tier
(defense, equippable on platforms).

- **Quantum Computing** (keystone) — +5% Research income, +1 to Cyberattack mission rolls. Counts as Level I
  for Cyber Hardening matching.
- **Quantum Hardening** (+5% Money, banking/encryption flavor) and **Quantum Communications** (+5%
  Legitimacy, secured comms flavor) — coequal after Quantum Computing. Either grants Cyber Hardening I; both
  grants Cyber Hardening II.
- **Cyber Hardening module** — attaches to a unit, mitigates a successful Cyberattack's effect on its Task
  Force. TF-wide effectiveness is normalized across all units: lands at 100% effectiveness (none present),
  partial (a mixed spread), or 0% (uniformly equipped at or above the attack's level).
- **Qubit Hyperscalers** (requires both Quantum Hardening and Quantum Communications) — +5% Research from the
  tech itself. Unlocks the regional building **Quantum Nexus** — at building level 1, +1 further Cyberattack
  roll (+2 total) and Level II Cyber Hardening matching, both fixed at level 1; further building levels only
  add +5% Research each, never raise the match-level or roll bonus further.
- **Quantum Supremacy** (Hive victory-tech capstone — the **third of the Hive's three victory-condition
  techs**) — requires a Quantum Nexus at level 5 under the faction's control to make research progress, an
  ongoing condition (§10.1.1's pausable-progress rule). On completion: +10% Research, +1 further Cyberattack
  roll (+3 total), Level III matching, unlocks Cyber Hardening III directly.
## 11. Events, Calamities & Narrative  *(in progress)*

### 11.1 Event schema  *(resolved)*
A **data-driven event framework** — same "data, not bespoke code" philosophy as missions and factions — so
authoring new events is filling in a record, not writing logic. Fields:
- **Trigger** — `random` (flat per-pulse chance) or `conditional` (a **fire-chance %, up to 100%**, evaluated
  when a **source context** occurs). A trigger can be **shared across multiple source contexts** (see the
  atrocity example) — not locked to one mission type.
- **Scope** — global / regional / faction / agent / Task-Force — determines who's prompted and what state the
  event can read/modify.
- **Presentation** — title, body text, an optional graphic.
- **Choices (2–4)** — each with: a **gate condition** (hidden/disabled if unmet), an optional
  **chance-to-appear** (a choice can be probabilistically absent even when its gate is met — distinct from a
  boolean gate; a trait can push this to guaranteed, e.g. Smooth Talker, §11.3), an optional **cost**
  (money/Legitimacy/other), and an **outcome** — either **deterministic** (flat bonus/malus) or **a roll**
  (success/fail branches, each with its own bonus/malus).
- **Outcome application** — bonuses/maluses land on the specific stats/resources named (popularity, Stability,
  a currency, an agent stat, etc.) — reuses the game's existing stat surface, no new plumbing.

**Authoring requirement (flagged for the build):** Claude Fable should build an **event editor** alongside the
initial event set, so Eric can add/edit events post-launch without touching engine code — a natural fit since
the schema above is already just structured data.

### 11.2 Canonical example: Atrocity  *(fully specified — the template)*
- **Source contexts (shared trigger):** invasion ground combat (both sides, small %), a TF **Suppress Unrest**
  order, or an agent **Foment Unrest** mission.
- **Effect:** a **global popularity hit** to the acting faction.
- **Choices:**
  1. **Accept** — take the hit as-is. No cost, no gate.
  2. **Reparations** — pay **Money** to **reduce** the hit. No gate beyond affording it.
  3. **Blame the other side** — spend **Legitimacy** on a **roll**: success ⇒ the *other* faction eats the
     popularity hit instead; failure ⇒ **you** take the original hit **plus a coverup-exposed malus** (worse
     than just accepting). **Gated on a clear target existing** — available if the context has an identifiable
     rival faction (e.g. Foment Unrest run *inside another faction's controlled region*); **unavailable** if
     the context has no faction to pin it on (e.g. Foment Unrest in an **uncontrolled** region).
This single event demonstrates every schema field at once — shared multi-context trigger, gated choice,
deterministic option, roll-based option with asymmetric success/fail, and a real strategic bluff (choice 3 is
a genuine gamble, not a strictly-better option).

### 11.3 Event content categories
- **Global calamities/boons** (not faction-caused) — negative: extreme weather, industrial accidents, political
  scandals; positive: research breakthroughs, grassroots political support, new oil field discoveries.
- **Faction-caused incidents** (the Atrocity pattern) — consequences of a faction's own actions, often with a
  cover-up/blame gamble built in.
- **Scripted narrative beats** — the Taiwan-crisis bootstrap (§9.6), Kessler syndrome, the nuclear-ladder
  warnings (§9.8), civil war (§9.3), the Gamer's forced team-reconstitution event (§5.5) — these reuse the same
  event schema, just with **authored, one-time or story-gated triggers** instead of a recurring % chance.
- **Faction-specific dilemmas** — the Moloch Trap template (§9.7) and Hive calamities (pandemic, arcology
  unrest) are themselves instances of this schema, now that it exists formally.
- **Mission setback events** — fires on a **failed multi-pulse continue-roll** (§2.2) as an alternative to flat
  abort, giving the player a chance to salvage the mission. **Canonical example: Arrested!** — *"(Agent) was
  just picked up by local law enforcement while trying to set up surveillance."*
  1. **"We can modify the plan"** — the Agent becomes **captured** in that region (by the controlling faction
     if it's controlled, or a lesser general capture if unaffiliated — reuses the existing capture-severity
     rule, §7.1); the **mission proceeds** to the next pulse without that Agent's contribution — success
     chance drops accordingly.
  2. **"Bail them out!"** — pay **Money**; the Agent is released and the mission continues at full strength.
  3. **"Talk your way out of it"** — **doesn't always appear** (probabilistic even when a mission type
     qualifies, per the new chance-to-appear field, §11.1); when it does, a roll on **Interpersonal**. Success
     ⇒ the mission continues **and** the Agent **permanently gains the Smooth Talker trait** (an Interpersonal
     buff) — which also makes this choice **guaranteed to appear** for that Agent in future setbacks.
  **New pattern: event-driven trait acquisition.** Traits aren't only bought with XP (§5.3) — some can be
  **earned by succeeding at a specific narrative moment**, a second, emergent path to the same trait system.
  *(Different multi-pulse mission types likely want differently-flavored setback templates — Arrested! reads as
  surveillance-flavored; a combat-flavored mission would want its own — an authoring/content task, not a new
  mechanic: same schema, themed per mission type, likely organized as an event pool per §11.4.)*

### 11.4 Schema refinements surfaced by the first faction pass  *(resolved additions)*
- **Named-agent/location-conditional triggers.** A trigger can key on a **specific named agent's presence in a
  specific region** (not just world/faction state) — e.g. events firing only while Gus Tittle sits in Texas.
  This rewards deliberate agent *placement*, not just assignment, as a strategic layer.
- **Chained/follow-on events.** One event's success can set a **% chance of unlocking a specific follow-on**
  event later — and the **player should be told a chain exists** (not the outcome, just that taking this path
  *may* lead somewhere) so it reads as a discoverable branch, not a hidden gotcha.
- **Event pools (weighted random selection).** A trigger can resolve in **two stages**: first, roll **whether
  any** event fires (e.g. >50% after a TF combat loss); if so, **randomly select** among currently-**eligible**
  members of a themed pool (each still gated by its own prerequisites). Gives thematic variety without
  duplicating trigger logic per event.
- **Multi-faction cascading events.** One trigger can spawn **linked events across several factions**
  simultaneously — distinct from a same-faction chained follow-on (§11.4 above): faction A's decision creates
  the situation, and factions B and C each get their **own** event keyed to the same moment (see Decapitate
  Taiwanese Leadership, §11.6). The originating faction's storyline should **not hard-depend** on a single named
  agent surviving a cascade — build in continuity (a faction can still reach its win condition via another agent)
  so no one cascade is a single point of failure.
- **Background relationship tracking, even pre-discovery (locked — refines §9.4).** An event can damage/improve
  **faction relations with a faction that hasn't been discovered yet.** The change is real and tracked, just
  **not shown** to the player until that faction is actually discovered — so a faction can arrive at discovery
  already favorably or unfavorably disposed because of the player's own earlier choices. Consequences have a
  memory even in the fog of war.

### 11.5 Faction event sketches: Mankind United  *(first pass)*
**Starting roster (canon):** **Gus Tittle** (billionaire — funds MU pre-territory), **Greta Schultz**
(diplomatic — popularity/control specialist), **"Dial" Tone** (military — espionage/capture/assassination),
**Wali** (soft power — popularity/control specialist). **Canon arc:** Greta works Europe, flipping NATO
Task Forces under MU as RBO alignment collapses, building the **Intermarium** (Eastern Europe) by novel's end;
Gus builds an energy/productivity empire in Texas (**"the Triangle"**); Wali + Dial destabilize and
opportunistically seize US regions, fielding real Task Forces there.

- **Establish Checkpoints** — fires at **100%** when US–China war begins. *Take:* −China popularity in
  US-controlled regions (harder for Chinese agents to operate there) + a small US-region Stability bump + an
  **MU popularity** boost (seen as patriots) — but **damages MU↔Hive faction relations** (racial profiling),
  invisibly if Hive is undiscovered (§11.4). *Skip:* none of the above. **Choice axis:** grab territory sooner
  vs. build toward a stronger military play later.
- **Levee en Masse** — fires at **100%** on MU's **first US region taken**. Grants a batch of **weak militia**
  (basic-infantry + FPV-drone-team blocks; count scales with **region population × MU popularity**) added to
  an existing TF or spawning a new one — **or** decline the units for a **Money + Production** boost instead
  (civilian contribution flavor). **Choice axis:** military conquest path vs. agent/subversion path.
- **Crush the Legislature** — ~**80%**, shortly after MU's first US region. *Take:* strips checks on MU
  governance — big **US-faction popularity drop** in MU regions (harder for US agents there) at a
  **Stability** cost, but **also drops MU's own popularity** in US-controlled regions (harder for MU agents
  *there*) — a **consolidate-home vs. project-abroad** tradeoff. *Skip:* status quo.
- **Divide Canada** — triggers when a Canadian region's Stability crosses a threshold. Spend
  Money+manpower+equipment on a **roll weighted by that region's Stability** (regardless of outcome, resources
  are spent): success ⇒ MU gains control + a new/enhanced TF; failure ⇒ resources lost, region's Stability
  recovers. *Skip* to avoid the gamble or pursue control another way. **Confirmed: a genuine third path to
  territory** — agent-independent (background sympathizer support, not a deployed operative), distinct from
  both military conquest and the agent Foment-Coup mission, though an **agent CAN accelerate it** by targeting
  that region's Stability. **Design pattern (generalizable): a passive/opportunistic territory path gives the
  player something to anticipate even while every agent and TF is fully committed elsewhere** — it's what makes
  the "ignore Canada, focus everything on the US/EU, and let this one just happen on its own timer" playstyle
  work, and acts as a soft nudge toward a theater the player might otherwise skip entirely.
- **Investigate AI → Found the Inquisitors** (chained pair, §11.4) — periodic random pop-up per MU-controlled
  region; pay Money to investigate ⇒ local popularity boost + a **flagged chance** of the follow-on. *Found the
  Inquisitors* (~25%, once): turns the FBI into a counter-intel service — recruit up to **2 procedural agents**
  specializing in **recon/surveil/foil/capture vs. other factions' agents**, with an **innate bonus vs. Widows
  agents**; a specific **Interrogate** mission unlocked vs. captured Widows agents. Success ⇒ **free
  rivalry between MU- and Widows-controlled countries + faction relations set to Hostile** — a **faster route to
  MU–Widows conflict** than the novels' slower fabricated-rivalry path (an alternate, non-mandated path per the
  "conditions not scripts" principle). Recruited agents carry an **upkeep-cost trait** (Money, ongoing).
- **Terraflops for Terrawatts** — conditional on **Gus Tittle active** + MU's Energy output + the Hive's
  Research output both crossing **mid/late-game thresholds**. A mutually favorable **semiconductors-for-energy**
  trade, improving **MU↔Hive faction relations** (the "gifts/trades" relations lever, §9.4) — declinable if
  unfavorable or if the player wants hostility instead.
- **Invest in the Triangle** — periodic random pop-up **while Gus Tittle is stationed in Texas**. Convert Money
  into a Texas GDP bump + an energy building (fusion if unlocked, else renewables) + a production building + an
  air-defense building, at a good rate (existing buildings **level up** instead of duplicating). Rewards
  *keeping* Gus in Texas over reassigning him to a higher-GDP region — a deliberate long-game bet that Texas can
  eventually **out-produce anywhere else in the game**. **Confirmed: gated on Gus's location, not MU control of
  the region** — Texas starts US-held, so MU can fund infrastructure upgrades in territory it doesn't yet own,
  purely as a bet on future conquest (the US benefits meanwhile — buildings belong to the region, not the
  funding faction, per §6.2). Correspondingly, a player who **doesn't** plan to take Texas has real reason to
  relocate Gus early rather than leave him there by default.

### 11.6 Faction event sketches: China  *(second pass)*
**Starting roster (canon):** **Huang Tau** — Assistant Foreign Minister in Beijing (diplomatic + solid economy
stats; a **promotable title trait** — Assistant FM → Foreign Minister → Acting President, each a further stat
boost); **Wei Zhang / "Johnny Woo"** — based in the US interior, subversion/US-instability focus; **Admiral
Jiang** — starts **commanding a Task Force** in the Taiwan Strait. China starts with **multiple TFs** already
staged around Taiwan.

**Agent-to-Task-Force attachment (resolved).** An agent can attach to a TF **persistently** (distinct from a
one-pulse mission), providing a **standing combat boost** — Admiral Jiang starts attached by default. **An
attached agent is unavailable for any other mission** — attachment *is* their assignment, full stop. This makes
it a real opportunity cost: only attach an agent to a TF you actually expect to fight, or they sit idle
contributing nothing. *(Still open: which attribute(s) size the boost — a later balancing detail.)*

**Starting malady — formally the same Permacrisis system as the US's, not a separate-but-similar one
(resolved).** China and the US **share one Permacrisis mechanic** — the same numeric level scale and the same
five debuff channels detailed in full at §11.7 (debt-interest expense, reduced Production→equipment conversion,
reduced manpower yield, popularity erosion abroad, Stability-hit chance at home) — but each faction's level is
**tracked independently** and **starts at a different severity**: the **US starts significantly worse**, China
**starts milder**, and China's clears sooner through the Taiwan-war route below. **Levels can diverge further
during play** — China's could worsen while the US's eases, or vice versa — the game is simply biased at the
outset so the Permacrisis is a bigger, harder problem for the US to manage than for China. Clearable via
**early events** (below) or a **mid/late-game team agent mission**.

- **Blockade Taiwan** — fires **100%** at game start. *Take:* blockades Taiwan (cut from energy markets via sea
  control, crushing production); China gets **partial malady relief**, more manpower (nationalist volunteers),
  a **popularity boost in controlled territory + all non-RBO regions**, **+Global Tension**, and a **Taiwan
  Stability hit**. *Decline:* no GT change, but **−popularity** in non-RBO regions and the mainland, and a
  **Stability hit in China's own regions** (perceived-weak-CCP). **This is the mechanized entry point to
  China's Moloch dilemma (§9.7):** declining pushes the optimal meta from warfare toward **agents + economic
  development** to manage the still-active malady, with a later option to pivot back to warfare once cleared.
- **The Provocation Will Not Stand** — the mechanized continuation of the Taiwan-crisis bootstrap (§9.6): after
  the Taiwanese shootdown/Kessler trigger, China chooses:
  - **Respond with force:** national-fervor boost, **malady fully ends** (national mobilization), +production
    +manpower; **state of war** with Taiwan, faction relations → **Hostile** (Hive likely still undiscovered).
    Then a **further sub-choice**: **Long-Range Siege** (a long-fires bonus for **~1 year** of pulses — grind
    Taiwan down over time) or **Amphibious Invasion** (an amphibious-penalty reduction for **~1 month** — go for
    a fast landing; likely succeeds unless the Hive has built a genuinely strong defense). **Either raises GT
    further** and fires the **US intervene-or-not** event.
  - **Don't respond:** blockade stays active, **no GT increase**, but the **malady returns at full strength.**
  - **Capitulate:** cancel the blockade — malady returns, **severe** popularity/Stability hits, but **GT
    decreases** (the sole China option that lowers tension).
- **Decapitate Taiwanese Leadership** — fires when a Chinese TF is **landed and engaged** on Taiwan. **A
  multi-faction cascade (§11.4):** the **Hive** gets the first event — flee (become the government-in-exile that
  founds the arcology) or stay (combat bonus to the defending TF). If they flee: the **US** gets an event to
  assist (raises success odds); **China** gets an event to strike the escaping leadership (a roll). Outcomes:
  success ⇒ **President Lim dies**; failure ⇒ Lim escapes to Japan and **travels freely**. **Either way China
  takes a global popularity hit** for the attempt — decline the China event to let the roll proceed uncontested
  and skip the hit. **The Hive's storyline never hard-depends on Lim** — they can still found the arcology via
  another agent regardless of outcome (no single point of failure).
- **Post-combat-loss escalation pool** — an **event pool** (§11.4): on a China TF combat loss, **>50%** chance
  any pool member fires; if so, **randomly select among currently-eligible** members (each gated by its own
  prerequisites) — flavors China's "escalating national effort":
  - **Global Sterility Pandemic** *(requires Genetic Engineering tech)* — releases an ethnically-targeted
    sterility disease (spares those close to Han genetics), starting in one region with a lag, spreading to
    adjacent regions each pulse (+ a smaller chance to a random region, air/sea travel). Affected regions take
    an initial Stability hit and a **persistent malady dragging down population growth** (can go net-negative
    over years if unaddressed). China + Hive regions immune (unless Red Queen later strips the immunity via her
    own mission). Curable per-region by **money spend once a tech downstream of Molecular Machinery is
    researched** (tech = the inoculation; money = reversing the fertility effect); once researched, the disease
    stops checking to spread. **Large GT increase** if released; optional, no effect if declined. *(Heaviest,
    darkest option in the pool by design — consistent with the game's existing willingness to depict atrocities
    and nuclear exchange as player-chosen extremes, never mandatory.)*
  - **The Maelstrom** *(requires an energy-output floor, ~mid-game)* — after **~2 months** of construction,
    massive heat exchangers in/around the Taiwan Strait create a **persistent extreme-weather region effect**:
    ongoing equipment attrition for any TF operating there, and a **severe laser-effectiveness penalty** (moist
    air) — a deliberate **counter to exquisite platforms**, tilting the Taiwan fight toward attritable autonomous
    mass. **Any faction** can clear it via a multi-pulse **team agent mission** (investigate → sabotage the
    exchangers).
  - **Leverage the Social Credit System** — manpower + productivity boost for a small popularity hit; declinable.
  - **Redoubled Research** — one-time RP windfall = **5 pulses of current research production** (scales with
    the growing base — respects the §7.5 anti-flat-reward rule); essentially always worth taking.
  - **Fire Timid Commanders** — **~2 months** of increased damage dealt *and* taken for all China TFs (a
    volatility/aggression toggle); take-or-leave depending on playstyle.
  - **Sabotage Efforts** *(requires Wei Zhang/"Johnny Woo" alive & in the US)* — building damage to a random
    set of US-controlled regions; almost always worth taking unless deliberately trying to help the US.

**Stubs — noted for later expansion:**
- **Disband the UN** — further erodes US popularity in **RBO countries the US doesn't control**; raises GT.
- **The Grand Convoy** *(repeatable player-triggered action, not a pop-up)* — once China fields a **TF with
  greater naval combat power than the US**, a pop-up **informs** the player it's now possible; a **flair button**
  on that TF lets the player **trigger + confirm** a voyage (Indian Ocean, down Africa's East Coast, back).
  Success ⇒ a significant one-time **Energy + Money + Production** windfall. Repeatable while the naval-power
  condition holds. *(A new pattern: an event that unlocks a standing player-initiated **action**, rather than
  presenting an immediate choice — worth folding into the schema notes if more of these appear.)*

### 11.7 Faction event sketches: United States  *(third pass)*
**Design philosophy — the most optionality, and a real trap inside it.** The US opens with the most raw power
of any faction, but also the most exposed surface: trying to hold and do everything invites being ground down
by the Permacrisis (below) and every other faction's opportunism at once — a genuine "spread thin and lose"
failure mode, not a strawman. **The core question the player must answer is *how* to play**, across several
real axes: pacifist vs. militarist (the US has both economic and military strength to lean on), cooperate with
some factions (LaserWard, Gamer, Widows, MU, Hive) vs. oppose everyone operating in US territory, isolationist
"Fortress North America" vs. NATO/EU-focused vs. Pacific-focused vs. **abandon both and relocate** (e.g. chase
oil-rich regions instead). **This is deliberately a decline-and-consolidation-before-recovery arc, not a power
fantasy from turn one.** *(Design note, not a fix: savescumming can trivially route around the "roll lucky
enough to do everything" trap — not worth preventing.)*

**Canonical trajectory (one possible playthrough, not mandatory — matches the "conditions not scripts"
principle used elsewhere):** unfocused and overwhelmed early → abandon the EU → contest Mankind United
domestically → pivot to the Pacific and fight China over Taiwan → by novel's end, reconstituted as the
**Federated Pacific Democracies** (US West Coast + Hawaii + Australia + New Zealand + Japan + South Korea,
loosely also Philippines/Singapore).

**Starting roster (canon):**
- **Admiral McNeely** — US INDOPACOM, starts in **Hawaii**, strong Security/Espionage.
- **President Powell** — the sitting US President; mediocre soft-power and economic stats.
- **CDR Bryson** — assigned (attached, §11.6) to a Task Force off the **West Coast**, starting as a single
  ship, **USS Mustin**. Large **combat bonus** while TF-attached. Carries a **promotable rank trait**: CDR →
  CAPT → Admiral → **President**, each promotion raising the TF combat bonus further. **Reaching President is
  itself one path to fully end the Permacrisis malady** — an agent career arc doubling as a macro fix, the same
  pattern as China's malady-clearing team mission (§11.6), now instantiated through personal advancement.
  **Resolved — see the Legitimacy Crisis event and the exclusive-leadership-slot rule below.**
- **Mouth and Sparkles** — **two named characters, one Agent mechanically** (a new pattern: multi-character
  single-agent). Attached to a Task Force off **Japan** representing **US Seventh Fleet**, which starts as a
  full CSG: **1 carrier, 4 multirole-fighter squadrons, 1 EW squadron, 1 AEW squadron, 2 rotary-wing squadrons,
  3 surface combatants**. Large **air-unit combat bonus** while attached — **or** assign them to a repeating
  **research-boost mission** (bigger bonus for air-related tech; "test pilot" flavor) instead of attaching.
  *(Noted consequence: this makes Mouth and Sparkles a real **poaching target for LaserWard** — turning them
  redirects a premier air-research asset to a rival faction's benefit.)*

**The Permacrisis (fully mechanized malady — shared with China, §11.6, at a milder starting severity there):** flavor = political division, heavy-handed foreign policy,
unsustainable debt, high inflation, environmental degradation, and widespread fraud eroding confidence in the
US. Starts at a **high level** on a numeric scale; actions/tech move it down or up. **Five independent debuff
channels**, all scaling off the current level:
1. **Flat debt-interest expense** — makes positive Money income hard without lowering the level (ties directly
   into §7.1's Print-Money/hard-money mechanic — the US starts needing it often).
2. **Reduced Production→military-equipment conversion** (fraud/waste/abuse in the defense industrial base) —
   forces a choice: **lean on LaserWard** (directly feeds a rival faction's goals) or **fix the Permacrisis**.
3. **Reduced manpower yield from Population** (public distrust) — forces a choice: **pursue automation** (the
   tech-tree route) or **fix the Permacrisis**.
4. **Per-pulse chance of a US-popularity debuff in every country outside US control** — RBO-aligned nations
   still contributing at game start gradually drop below the contribution floor unless the player spends agent
   economy retaining specific ones (this is the mechanized version of §6.4's US popularity-bleed malus and the
   §9.7 Moloch template line).
5. **Per-pulse chance of a Stability hit in US-controlled regions** — makes them easier for rivals to flip over
   time; counterable by spending agent economy + **JTF Suppress Unrest** in a "whack-a-mole" defensive loop —
   the mechanical backbone of a Fortress-North-America playstyle.
*(Level count and per-level severity curve: a balancing detail, TBD.)*

**Opening event — Energy Policy Focus** — fires **100%** at game start, a one-time strategic choice:
- **Fossil Fuels** — cheapest given abundant US reserves, no sea-control dependency **as long as the player
  retains/expands fossil-producing territory**; Algae Cultivation adds more capacity later but isn't available
  yet.
- **Renewables** — near-parity value, buildable from turn one wherever solidly controlled, with **zero**
  dependency on holding energy regions or on Algae tech — and **also drops the Permacrisis one level.**
- **Fund the National Ignition Facility (NIF)** — also drops the Permacrisis one level, **and** enters NIF into
  the Fusion Breakthrough lottery (below) as a possible winning lab. **A genuine timing gamble:** breakthrough
  early + US wins ⇒ strictly best choice; breakthrough roughly on schedule ⇒ a wash vs. the other two; late
  breakthrough ⇒ an increasingly regrettable pick.

**Fusion Breakthrough (global event — the mechanism that unlocks Fusion Energy tech):** **3% per-pulse chance**
each pulse; on success, an **equal-odds** random draw among currently-possible labs — baseline **ITER
(France)** and **Institute of Plasma Physics (China)**; **NIF (USA)** joins the pool only if funded in the
opening event. *(Math check: unfunded ⇒ 2 labs, 50/50; funded ⇒ 3 labs at ~33% each, and if the US **also**
controls France via agents, the US benefits from **2 of 3** outcomes ⇒ ~66% — matches the stated NIF+France
play.)* **Canon result:** ITER won, early, outside US control — a mostly neutral outcome. **On breakthrough:**
whichever faction controls the winning lab's region gets **Fusion Energy free immediately** (previously
unresearchable — see §10.3.1); other factions can now **research it normally or steal it via agents**; **any**
faction can additionally **license** a fusion-reactor building from the winning lab — **gated on both faction
relations (no Hostile) and country relations (no Rival)** with the lab-owner — at a **premium cost**: normal
Production cost **plus extra Money**, the Money portion a **direct transfer** to the tech-holding
faction/country. Pricier than native research, but early access can still be worth it.

**License revocation on soured relations — resolved.** If relations later drop past the gate (Hostile or
Rival), the license lapses: **no new licensed reactors can be built** until relations recover. **Already-built
or under-construction reactors are unaffected** — the licensing faction doesn't lose anything retroactively
*(in-fiction logic: the buildings have effectively been nationalized/seized, a violation of the license
agreement rather than grounds to claw the physical asset back)*. With relations soured, the only paths to
**further** Fusion Reactors are repairing relations, researching Fusion independently, or stealing the tech
via agent action.

**No separate building type, and no per-building tracking needed — resolved.** Licensed and self-researched
Fusion Reactors are the **same building** for the escalating-stack-cost curve (§7.7) — no benefit from mixing
the two to dodge the curve. And because a soured license only ever blocks *future* construction and never
retroactively touches existing buildings, **the game never needs to remember which specific reactor came from
a license** — licensing status isn't a property of the building at all, just a **gate checked fresh at the
moment of each new build attempt**: *(1)* do you have the tech yourself? → pay the normal cost. *(2)* if not,
do you have adequate relations with a faction/country that does? → transfer the license Money, then pay the
normal cost. *(3)* neither → can't build. Minimal state, consistent with how the rest of this design favors
gates checked live over persistent flags (the same instinct behind detection's memorylessness, §8.5.2, and
Quantum Nexus's fixed match-level, §10.5.2).

**Barklight Standoff** — see §11.8 for the full mission chain (Discovering Barklight → the draft →
Waco protest → US response); incites the US Civil War, generating large Stability hits across all
US-controlled regions.

**Legitimacy Crisis** — fires when the **US Civil War starts** (e.g. via Barklight Standoff) **or** a US region
**falls to another faction**. Admiral McNeely forces a meeting with President Powell:
- **Reaffirm civilian authority** — **−Global Tension**, no other game effect. The stand-down option.
- **McNeely assassinates Powell** (the canon outcome) — Powell is replaced by **Virtual Powell**, a deepfaked
  figurehead President with **considerably better soft-power stats** than the man he replaces; **McNeely
  becomes President**, gaining the **Shadow President** trait (adds solid soft-power capability on top of his
  existing Security/Espionage). Net effect: the US now has **two agents covering leadership ground** —
  popularity defense, alliance-building, Stability/control work — in parallel. **Permacrisis −1 level**
  (a more unified, effective government) — but **+Global Tension**. A clean **faction-strength-now vs.
  tension-later** trade.

**Exclusive leadership slot (resolved — a general pattern, not US-only).** **President / Shadow President is
one exclusive title-slot** across the faction: exactly **one** holder, or **zero** if the holder dies with no
ready successor — **never more than one**. Bryson's promotion to President is gated on **both**: (a) **spending
enough XP** through her rank chain (CDR→CAPT→Admiral→President — earned via missions or TF-attachment, with
**Task Force *combat* — win or lose — yielding more XP than passive attachment**, rewarding action over
camping), **and** (b) the **slot being vacant**. The player can **voluntarily dismiss** the current
holder to open it (a real sacrifice — likely a well-developed, valuable agent), **decline** and keep managing
the Permacrisis through other means (tech, energy choices, Stability whack-a-mole), or the slot may **already be
vacant** through unrelated causes (the holder dies to an external actor). **Canon precedent for a real vacancy
window:** the Gamer assassinated McNeely (Shadow President) in the novels; Bryson wasn't yet experienced enough
to promote immediately (only Admiral-ready), leaving the slot **empty** with her succession implied for the near
future.

### 11.7.1 Resolved design principles
- **No vacancy malus (resolved).** Agents with a leadership trait (President, Shadow President, etc.) are
  **particularly dynamic figures** capable of more than an ordinary office-holder — even mediocre Powell, as an
  *Agent*, outperforms a normal president. **When no Agent holds the slot, someone is still nominally in charge
  — implied, not modeled** — an "empty suit" or generic leader with **zero mechanical effect**. So there is
  **no separate malus for vacancy**; the loss is purely whatever bonus the departed holder personally provided.
  This also reframes **Bryson reaching President**: it isn't a bureaucratic formality, it's the game telling
  you she's become a genuinely famous, battle-proven national figure riding real public support into power.
- **Resilience over rails (resolved — a binding design constraint, not just an answer).** The US gets **no
  events that lock it into one strategy.** The player must always be able to **pivot** — Fortress North America
  today, rebasing with NATO remnants in Europe tomorrow, a Pacific pivot after that — in response to events
  actually unfolding (e.g. a Hive-triggered civil war handing Mankind United an opening mid-plan). **No US event
  may put the faction "on rails" such that losing the path it set is losing the game.** This governs all future
  US event design: strategic-flavored events (a Fortress-NA-style choice, etc.) may still exist and grant
  directional bonuses, but **none may permanently foreclose switching strategy later.**
### 11.8 Faction event sketches: The Widows  *(fourth pass)*

**Design identity: "sleepy, then dominant."** Slow-starting, fast-developing — deliberately the opposite arc
from the nation-states. Very limited early action economy, then a hard inflection point after which they can
credibly out-develop factions with far larger resource bases.

**Starting roster (canon):** **Claire** and **Bob** — a married, religious couple in **Nebraska** (US
interior), **mediocre stats, no territory**, an initially tiny mission set: small-scale **Money** and
**Legitimacy/Popularity** missions only, far below nation-state faction scale.

**Discovering Barklight** — medium %/pulse (fires eventually). **Barklight**: a disabled Afghanistan-veteran
social media personality, started with service-animal content, grew increasingly political as US conditions
worsened. Starts a **multi-pulse team mission** for Claire+Bob culminating in the **Barklight Standoff** — if
resolved favorably for the Widows, it touches off US instability and likely civil war (§6.8, §9.3).

**Mission phase 1 — the draft.** Triggers when the **US enters any war** or **completes Crash Military
Modernization**: Barklight is drafted by administrative error, fires a **"Request for Help"** event, and a
protest movement forms at his home in **Waco, Texas**.

**Travel choice (resource-gated — reuses the existing gate-condition schema field, §11.1, no new plumbing
needed):**
1. Enough **Money** → travel immediately (spends it).
2. Enough **Legitimacy** → the church group funds the trip → travel immediately (spends it).
3. **"We should do something about this…"** — always available; delays. If chosen (or forced by lacking
   funds), recurring Money/Legitimacy-raising events fire each pulse until the player both **has enough** and
   **chooses** to advance.

**At the protest (recurring event each pulse while present):** Claire/Bob talk to media, network with
protesters — pick a flavor: **solicit** (Money), **raise awareness** (Legitimacy), **network** (Popularity),
each larger than their baseline missions. **Every selection drops US popularity** in that region and fires a
**US-faction event that same pulse**: **"Deal With Barklight"** or **"Ignore It"** (continues the popularity
drain). Ignoring it long enough costs the US **Control** of the region.

**Branch A — the US loses Control of Texas (via prolonged neglect).** The Widows can **recruit Barklight as an
Agent** and lead a **secession movement** to seize Control themselves — inflicting a **severe global RBO
popularity hit** on the US (can't even hold its own interior), a real deterrent against letting it get this
far. This **unlocks the Widows' advanced mission set** (Foment Coup, etc.) — an instance of the faction
**unlock-schedule** field from §2's core architecture, not a new mechanic. **Mankind United is a likely
contestant** (Gus Tittle's own Texas bias, §11.5) — a direct collision between two factions' independently-
authored event chains over the same region. If uncontested, the Widows simply take the region (with its Task
Force) once the US loses Control; if contested, the normal popularity/roll/agent-action competition for a
newly-independent region applies (§6.8 — no special case needed).

**Branch B — the US "Deals With Barklight" (violent).** A federal raid on his home kills Barklight. The Widows
get a choice: **"Deal with the Feds"** (fight) or **"It's too dangerous"** (stand down).
- **Deal with the Feds:** **Bob dies** in the firefight; **Claire gains "Fiery Sword of God"** — extreme
  stat/action bonuses, unlocking the advanced mission set.
- **It's too dangerous:** both **survive as mediocre agents**, gaining **"Radicalized"** — which unlocks the
  *same* advanced mission set.
Same downstream unlock either way — the real choice is **one superhuman agent vs. two mediocre-but-radicalized
ones**, the solo-super-agent-vs-team tradeoff from §5.2 dressed in narrative clothes. **A strong hint (Claire
expressing a belief) foreshadows Bob may return** if he dies here (pays off via Kent Grant, below).
**Either branch** kicks off the broader US Civil War cascade (§6.8/§9.3) — good US play means **proactively
managing regional popularity to limit fallout from either path**, not just reacting to whichever one fires.
After this, **Claire (or Claire+Bob) can relocate to any region** and pursue Control like any other faction.

**Kent Grant.** A persecuted AI researcher (brain-emulation specialist); approaches Claire via a moderate
%/pulse event **only if Mankind United controls at least one region** — MU's own territorial reach is what
creates refugee researchers for the Widows to shelter, a nice thematic loop. If Bob and/or Barklight are dead,
Claire gets a **"Maybe we can bring them back?"** branch; otherwise she simply accepts Kent as a
research-focused, high-quality agent.

**Resurrection (new pattern — a second instance of the "regrowable unit" concept, previously exclusive to Red
Queen's avatar, §4.3).** Kent can run a mission to revive Bob/Barklight as **robot-embodied "persona" agents**.
On success they return **more capable than their baseline selves** (free cyberspace/electronic-system access +
accelerated, machine-speed cognition) and **can respawn if destroyed**, the same way Red Queen regrows her
avatar at the Nest.

**"Fully formed" Widows (Claire + Kent, + any revived agents):** their **tech tree opens** (implying limited
access before this point — consistent with the slow start); Kent grants **both**: a passive, standing **faction-wide research bonus (+5%)**, and — when he isn't tied up on
a higher-priority task — a recurring **Advise** mission (matching the existing Assist-Research/Advise-Industry
pattern, §7.2–7.3) that adds a further one-pulse bonus, specifically strong in **automation/robotics/computer-
tech**, letting the Widows catch up fast. They receive the **Robot Dog platform
free immediately** (previously noted in §10.2.1.1's tech content — this is the narrative trigger for it).

**Task Force doctrine — the twist.** Best-optimized around automated/robotic, low/no-manpower platforms — but
Widows "robots" aren't pure AI: they're **remotely piloted by real people or run on scanned/emulated human
brains**, giving a **combat bonus over ordinary automation** (fewer automation failure modes, machine-speed
decision-making). **Resolved: NO EMP exemption** — Widows robots are **fully vulnerable to EMP exactly like
any other automated force** (§8.6.9), preserving the automation-counter pillar intact. This makes **MU vs.
Widows the game's signature EMP matchup**: Widows gain access to their own **EMP-shielding tech tiers**, so
combat outcomes ride a genuine **arms race** — early Widows shielding vs. mature MU EMP tech favors MU
decisively, and vice versa once Widows shielding catches up or surpasses it. Widows **can** field human troops
as an alternative EMP-mitigation path, but since their combat bonuses specifically favor robots, the
**optimal play remains robots plus investment in EMP-shielding** rather than defaulting to manpower. **Explicitly
flagged as a late-game snowball risk** (Eric's own framing, echoing Red Queen's demi-faction risk, §4.3) if
left unchecked — likely wants the same treatment: existing tools (conquest/subversion) remain the counter,
actual pacing is a balancing question, not a missing mechanic.

**The secrecy mechanic.** Brain Emulation must stay hidden, **especially from Mankind United**. While secret,
the Widows can hold **negotiated relations** with MU. Any active agreement gives MU **periodic events to assign
Inquisitors/agents to investigate** suspected AI use (the payoff for §11.5's Found-the-Inquisitors chain). The
Widows get **reactive events** while an investigation is active and can assign their own agents to **Foil** it
(§2.2/§5.2 — no new mechanic). **If the secret is ever uncovered:**
- **By Mankind United** — MU **immediately and permanently** declares war (a forced, irreversible relations
  change), and a **new roll type** fires in every Widows-controlled region: a **relative popularity check**
  (MU popularity vs. Widows popularity in that region) determining a possible control flip — representing a
  popular uprising against hidden AI use. *(New mechanic, worth formalizing as a reusable sub-rule under §6.4:
  a head-to-head popularity comparison between two named factions, rather than one faction's popularity against
  the flat 50% line used everywhere else.)*
- **By any other faction** (triggered by the Widows visibly snowballing late-game, giving every faction a "a
  new threat has emerged" investigation opportunity) — that faction **may** spend action economy to confirm it,
  and **if confirmed, the same relative-popularity control-roll applies** — but unlike MU, they are **not**
  forced into war. They can simply **note it and continue relations** if that suits them.

### 11.9 Faction event sketches: LaserWard  *(fifth pass)*

**Design identity: symbiotic → parasitic → dominant.** LaserWard doesn't conquer or convert — it **attaches**
to a host faction, offering bonuses that grow more valuable and more addictive over time, engineered to make
disentanglement increasingly costly until, at the far end, the host genuinely **cannot** refuse. **Possible
hosts:** US (canon), China, Mankind United (once holding territory), the Hive. **Cannot host:** the Widows,
the Gamer.

**Starting roster (canon):** **Kevin Sheffield** — starts in **Texas**. Research- and business/econ-mission
focused. Provides a **standing faction-wide buff to laser modules** (on units) **and Regional Air Defense
buildings**. **Special restriction:** as a public figure, he can **Go-To-Ground** (§3) but **cannot Burn
Identity** — the higher-tier self-defense mission is unavailable to him. If the player believes he's being
targeted, the only recourse is **assigning agent bodyguards** (the existing TF/agent protection pattern,
§5.5's protective postures).

**General agent-recruitment note (cross-faction, not LaserWard-specific — see [[ragnarosis-agents-intel]]):**
every faction can recruit **generic, non-canonical agents** (up to the cap, §5.7) alongside named canonical
ones — Terra-Invicta-style archetypes: special forces operatives, leading scientists, politicians, celebrities,
influencers, billionaires. LaserWard's roster below is a *starting point*, not a hard ceiling.

**Recruitable-NPC model (resolved — a real map presence, not an abstract shopping list).** Unaffiliated,
talented individuals exist at **specific map locations**, visible only to factions that have **discovered**
them (a discovery/visibility state, not a global list everyone sees equally — e.g. Gustav, §11.11, starts
visible only to the Gamer via Sigrid's head start, though **any** faction could recruit him if they found him
independently). Two ways to act on this: **direct map interaction** (start a Recruit mission at their
location), or a **consolidated interface** aggregating every currently-visible recruitable individual across
the map, so players don't need to manually scan regions to build their roster.

**Pre-attachment mission set:** research techs (→ Research), pursue defense contracts (→ Money), lobby (→
Legitimacy + local Popularity). Missions can fail for no reward. Payouts exceed the Widows' opening tier but
fall short of a nation-state faction's (China/US) agents.

**Positioning choice.** If not targeting the US, the player can relocate Kevin toward **China or Taiwan
(the Hive)** early to prep an attachment there. If keeping options open (or waiting on Mankind United to hold
territory), **staying in Texas** is a sound "options open" play — it also positions for Triangle-development
synergy (§11.5, MU's Gus Tittle content) down the line.

**Trigger — attempt to attach.** Fires when **(a)** Kevin's region enters any war, or **(b)** *any* faction
(including LaserWard itself) researches **Crash Military Modernization**. LaserWard chooses a target host from
whichever of {US, China, Hive (if discovered), MU (if holding territory)} are currently viable. *Canon: Kevin
stays in Texas, attaches to the US when the US-China war begins.*

**Host's parallel accept/decline event.** Accepting begins the **Symbiosis phase**:
- **Research-sharing (resolved — a genuinely powerful mechanic, flagged for playtesting).** LaserWard keeps
  its own separate Research effort running on its own points; the host keeps its own separate effort, fed by
  its own points **plus** LaserWard's contribution. The real power: **whichever of the two — LaserWard or the
  host — reaches a given tech's threshold first, unlocks it for *both*.** Effectively two parallel research
  tracks converging on one tree, not just a resource top-up. *(Canon grounding: this is the mechanism behind
  the US going from modern-day tech to fielding railguns/lasers/6th-gen aircraft in months once LaserWard
  broke down institutional procurement norms — the WWII-style horse-wagons-to-jets compression. Deliberately
  meant to feel tempting even to a player who knows the long-term cost — genuine playtesting needed to confirm
  it isn't simply too strong.)*
- Host gains Kevin's **laser-tech faction buff**.
- Kevin's missions now pay **enhanced rewards** — LaserWard is now a major defense contractor within the host.
**Player-controlled host:** a conscious **Faustian bargain** — real short-term power for real long-term risk.
**AI-controlled host:** rolls against **LaserWard's Faction Influence** (below) — specifically, LaserWard's
popularity in the **single highest-popularity region** the host controls (e.g. Texas for the US, since that's
where Kevin's been operating). **If declined:** LaserWard (if player-controlled) can spend **Legitimacy** to
force the event to refire — a real strategy: lobby a pulse or two to raise local popularity and bank
Legitimacy, then retry. **If an AI-controlled LaserWard is declined by a player-controlled host,** it pivots to
a **different host** rather than endlessly retrying the same refusal.

**Faction Influence (new — a single stat powering three separate decision points).** LaserWard's popularity in
whichever host-controlled region currently has its **highest** LaserWard popularity. Reused for: the AI
accept/decline roll (above), the Corporate Takeover block-roll (below), and the Dominance Phase seizure roll
(below) — one derived number, three mechanics.

**Corporate Takeover (Symbiosis-phase mission, repeatable).** Kevin targets another defense contractor within
the host to seize control. **On success**, the host faces a dilemma:
- **Allow the merger** — Production% + Research% bonuses, plus a **small LaserWard popularity bump across every
  region the host controls** (not just the takeover's region).
- **Block it legally** — a roll against LaserWard's **Faction Influence**; may fail.
**Deliberately a slippery slope**: each iteration tempts the player with faster access to stronger Task Forces
(broken-down proprietary silos, economies of scale, growing LaserWard expertise) at the cost of deepening
dependency. **The Parasitic Phase is player-choice-triggered, not threshold-triggered (resolved).** Symbiosis
alone carries **no opposition** — a LaserWard player may spend an arbitrarily long "honeymoon" period on other
priorities (recruiting agents, building Money, boosting local popularity) while the host enjoys pure benefit.
**The moment Kevin runs his first Corporate Takeover mission, the Parasitic Phase begins** — light but *real*
opposition with the host starts immediately, and it grows **more acute with every successful takeover**
Sheffield completes. This can happen almost immediately after attachment if the player rushes it, or after a
long purely-beneficial honeymoon — entirely player-paced. Notably, the host can dislike this friction even
while still net-benefiting on paper — the tension is real before it's numerically dominant.

**The Gamer collision (a specific narrative cross-faction event, same pattern as MU/Widows' Texas collision
and China's 3-faction cascade).** Conditional on LaserWard hosted by the **US** *and* **Bryson's Mustin TF**
existing. The Gamer runs an early multi-pulse team mission to install a **compromised point-defense laser** on
Mustin. **Any failed roll along the way** can tip off Kevin that something's wrong (reuses the existing
botched-mission-leaks-intel pattern, §3). LaserWard's choice: **investigate and roll to disrupt** the Gamer's
mission, or **look away** for a large **Money + Legitimacy** payout (reflecting the headline "Mustin refit"
story) — sabotage the Gamer's plan, or cash in on the windfall.

**The stability tech chain, faction-flavored — fully specified at §10.4.1, this is the LaserWard-specific
consequence of it.** LaserWard's own progress through the chain is faction-agnostic and persists across a host
change; only the displayed name and flavor are computed fresh from whichever faction currently hosts them —
same mechanic, host-flavored, consistent with LaserWard's whole "becomes whatever it's attached to" identity.

**Dominance Phase — unlocks after the fourth (final) tech in the chain** (resolved — the chain is confirmed
at 4 steps; Dominance unlocks after the capstone, not mid-chain). LaserWard attempts to seize the host's
internal security apparatus, named per host: **US → HAVEN** (a militarized Homeland Security); **China →** the
Social Credit System + Ministry of Public Security; **Hive →** the Quantum Cluster + Ministry of the Interior;
**MU →** the Inquisitors (§11.5). Same mechanical effect throughout, different flavor per host.
- **Roll difficulty scales inversely with Faction Influence** — illustrative: ≥90% popularity in the
  highest-popularity region + a well-developed, late-game Sheffield ⇒ roughly a **50%** success chance.
- **Success:** Kevin gains full access to coercive/non-coercive region-control tools (control-seizing,
  stability manipulation — the standard agent/mission toolkit other territorial factions already use). Taking
  **one region** hands LaserWard any Task Forces there, and it becomes a **map-playing faction**, like Mankind
  United's arc.
- **Failure:** the host gets an **arrest-Kevin event** (a standard Capture mission). LaserWard can defend him
  with its own agents. **If held captive for ~6 months of game-time**, Kevin is convicted of treason and
  **executed** — permanently removed, and **LaserWard as a faction is defeated.** The host **keeps all
  unlocked tech** but **loses the laser bonuses, production bonuses, and research multipliers** — industry
  expertise collapses with him. *(No regrow/respawn mechanic for Kevin — unlike Red Queen's avatar or the
  Widows' Kent-revived agents, this is a genuine, permanent, faction-ending loss condition. Confirmed
  intentional given how explicitly Eric framed it.)* **While captured** (before the deadline), LaserWard can
  run **rescue missions**. If freed (rescued, or never captured), the takeover attempt becomes a **repeatable
  mission, "Control Internal Security Apparatus,"** rather than a one-off event. This phase is an **ongoing
  tug-of-war** that can consume a large share of the host's action economy.
*(Generalization, not asked but consistent with existing rules: since Kevin is an ordinary named agent outside
this specific narrative arc, he should also be vulnerable to a **standard Assassinate mission** from any
faction via the normal rules, §2.2 — not only the arrest-then-execution path described here. Any permanent
removal of Kevin should end LaserWard the same way, for consistency with "one shared ruleset.")*

**Victory path payoff.** Once LaserWard controls a region and can direct its Production, it can build toward
**Rods from God** (§6.10.1 — exclusive to LaserWard, part of their escalation-dominance path). Because Rods
from God is so powerful, **LaserWard can begin winning with very little of the map under its control** — a
snowball-from-a-small-base victory path distinct from every other faction's more territorial routes.

### 11.10 Faction event sketches: The Hive  *(sixth pass)*

**Design identity: scientific achievement via playing tall.** The Hive's whole strategic identity — resist,
retreat, rebuild, out-research everyone — is now grounded in a hard mechanic: the §7.7 escalating-stack-cost
curve, and their exemption from it once the Arcology is founded (below).

**Starting roster (canon):**
- **President Lim** — starts locked to **Taiwan**.
- **Mr. Wu** — canonically head of a TSMC-analogue chip plant in **Arizona** (never named TSMC on the page,
  but that's the flavor). Starts in that US region; Econ/Research-focused missions. **The plant itself is a
  regional modifier** generating **Money + Research per pulse**, upgradeable with further investment
  (investment also raises **Hive popularity** in that region — a nice double payoff for banking early). *(This
  resolves the "who is Mr. Wu" open thread from the pre-session recap.)*
- **Shen Li** — Taiwanese Special Operations Forces, located in Taiwan; **likely to be lost early**, exact fate
  depending on how Gamer-faction missions unfold. Starts with the malus trait **Marked** — Triad gambling
  trouble has made him **known and targetable by China immediately**, and **Marked blocks both Go-To-Ground and
  Burn Identity** (stronger than LaserWard's Kevin Sheffield restriction, which only blocks the latter). China
  can attempt to **Capture** him right away (success removes the Marked malus) or **Assassinate** him (unlikely
  given his high Security stat). **Major narrative seed (full mechanics deferred to the Gamer's own pass):** if
  China captures Shen Li, the **Gamer** gets an opportunity to free and turn/recruit him — canonically, **Shen
  Li ends up one of the four agents on the team that defeats Red Queen** (§4.4).

**Two viable early playstyles:**
- **Porcupine:** recruit more agents, spend agent actions locating/disrupting Red Queen's Taiwan-linked agents
  (§4.2 — the ones raising GT and enabling the invasion), direct Production toward defenses and local energy,
  **reorganize Task Forces toward FPV-drone-heavy/light forces** — deliberately **low Supply-consumption**
  (§8.7) to maximize the Organization-regen ceiling for when they're inevitably cut off. Shen Li's survival is
  luck, but valuable luck if it holds.
- **Long-term viability:** focus Research, cultivate relations with the intended eventual host (the US in
  canon), and bank Production into upgrading Mr. Wu's plant for later — both its output *and* the local
  popularity bump compound over time.

**Event — the Chinese invasion.** Fires when a Chinese TF invades and begins fighting in the Taiwan region.
Lim's choice:
- **Stay and fight** ("I need ammunition, not a ride") — a **whole-region bonus** (resolved): the region's
  Task Force(s), regional buildings, and **base Fortification level** all get a combat/output bonus, and even
  **defensive-flavored agent missions** (surveil, foil, capture, assassinate rolls) get a bonus — a morale
  effect touching every system at once. **Deliberately not meant to make Taiwan uncrackable** — China still
  fields a stronger Task Force — just genuinely **competitive** rather than hopeless.
- **Flee, form a government-in-exile** — opens the existing **Decapitate Taiwanese Leadership** cascade
  (§11.6): US assistance vs. Chinese interception determines Lim's survival odds. **Confirmed consistent** with
  the already-built rule: Red Queen's Taiwan-linked agents (§4.2) always follow the same fallback chain — stay
  with Lim, else Mr. Wu, else the Hive arcology, else resign.
- **If Lim dies: Mr. Wu assumes leadership of the Hive** — a **second confirmed instance of the exclusive
  leadership-slot pattern** first built for the US (President/Shadow President, §11.7/[[ragnarosis-agents-intel]]):
  one slot, succession on death, no regrow.
- **If Lim survives**, she moves freely but strongly prefers friendly/neutral regions — high-China-popularity
  regions carry low Hive popularity (state of war) and are dangerous to operate in, reusing the existing
  popularity-affects-mission-difficulty rule (§6.4) with no new mechanic needed. *Canon path: Japan → US East
  Coast → Arizona (where the arcology ends up).*

**Mankind United's Checkpoints event (cross-reference, no new mechanic).** The existing "Establish Checkpoints"
event (§11.5) already damages MU↔Hive relations/popularity (racial-profiling flavor) — confirmed here to also
make it **harder for Lim to operate in US regions**, reinforcing the incentive to relocate toward wherever the
arcology will be founded.

**Founding the Arcology.** A choice event: found the Hive by welcoming displaced people/refugees from ongoing
instability. **Any region with a baseline level of Hive popularity qualifies** — UI: a text blurb, one choice
(pick the region), eligible regions highlighted green on the map, then a confirmation step. Optimal play
usually means founding wherever Mr. Wu's plant investment has already been banked (Arizona, canonically) — but
a player can sacrifice that bonus to found somewhere further from the fighting instead, a real tradeoff. **If
Lim stayed in Taiwan and the defense held, the arcology can be founded right there** — a genuinely different,
more defensible outcome. **On confirmation, the chosen region gains "the Hive Arcology" modifier:**
- **Exempts that region — and only that region — from the §7.7 escalating-stack-cost curve** (confirmed:
  this is a per-region effect earned at founding, not a blanket faction-wide trait held from turn one).
- A large **Population growth bonus** (refugee streams).
**Note: founding the Arcology (the modifier) is separate from gaining *Control* of that region (§6.4).** The
Arcology can sit as a modifier on a region another faction still nominally controls for some time before the
Hive actually controls it (below).

**The "free region" event.** Fires if the Arcology sits in a region controlled by another faction *and* that
faction's Stability or Popularity there drops too low — plausible triggers: the US's Barklight/civil-war
cascade (§11.8), the US's general Permacrisis malus (§11.7), or the Hive's own agent actions forcing the issue
if the region is currently uncontrolled. Lets the Hive **peacefully assume Control**, with **no diplomatic
repercussions** for the faction that loses it — a genuinely free region, full economic benefit transferring to
Hive control.

**Post-founding calamity/dilemma stream.** From founding onward, a recurring family of events — overcrowding,
resource scarcity, food shortage, social unrest — following one template: pay a resource (Money/Production/
Legitimacy) to mitigate, or decline and take a Popularity/Stability hit. **Canonical example — Food Riots:**
pay **Money** (emergency relief from a nearby community), pay **Production** (expand hydroponic/algae/
molecular-machinery output, tech-tier-dependent), or **"there's nothing we can do"** (take the hit).
**Frequency is deliberately very high early** — the Hive should genuinely struggle, burning a large share of
its agent action economy just holding Stability/Popularity together — and **decreases as specific techs land:**
adequate **Energy** (many of these fire from energy shortfall — Fusion Power + stacked plants directly reduces
frequency); **Algae farming / Molecular Machinery** specifically soften food-flavored events (less frequent,
cheaper to pay off); the **4-step stability chain** (Radical Asceticism → Group Obligation → Collectivism →
Harmonious Culture, §10.4.1) reduces frequency generally and specifically mitigates overcrowding/unrest flavors.

**Pandemic tie-in — confirmed the same event as China's Global Sterility Pandemic (§11.6), with the cure
mechanism now fully specified.** Once **any** faction researches the cure tech, **every faction must pay
Money on a per-region basis** to actually roll the cure out — this is a genuinely separate action from the
tech unlock itself. **Uncontrolled regions still pay** (autopilot, presumably drawing from local resources) to
implement it. The Hive's choice: **quarantine the arcology** — lose the population-growth boon immediately,
but get it back the moment the cure is both researched and paid for locally — or **accept the spread** — keep
the boon in the meantime, but the calamity-event stream fires **much more frequently** until that same
research-then-pay sequence completes. A real growth-vs-stability tradeoff, now grounded in a concrete
resolution path rather than an open-ended "until a cure is found."

**The Gamer agent-sharing chain — Ada & Dr. Beeman.** The Gamer starts with **Ada** (Research-focused, moderate
Information-Technology buff) and can recruit **Dr. Beeman** (Research-focused, an **extreme** Molecular-
Machinery-specific buff). The Gamer can use them directly, or — **at Alliance-tier relations** — "share" them
by parking them in the Arcology, in exchange for **shared research income and shared unlocks in their
specialty areas** (IT, Molecular Machinery). *(A second confirmed instance of the dual-pool/shared-unlock
research pattern first built for LaserWard↔host, §11.9 — reused here for Gamer↔Hive.)* Since one of the Gamer's
own mission chains involves hunting Red Queen's Taiwan-linked agents — which directly serves the Gamer's *own*
narrative progress — Gamer↔Hive relations climbing toward Alliance is a natural, organic outcome in many
playthroughs, not a forced one.

**Diplomatic flexibility — the Hive's distinct identity.** The Hive can hold **high relations with multiple
factions simultaneously** (barring China, given the invasion backstory) — even factions **at war with each
other** (US and MU, in canon) can both maintain high Hive relations at once, because "everyone wants the Hive's
bleeding-edge chips." A trade-hub identity, structurally different from the more zero-sum relations most
factions carry. *(Acknowledged, not yet designed: equivalent trade events for the Widows and the US — parallel
to MU's Terraflops-for-Terrawatts, §11.5 — are endorsed in concept but not fleshed out; not mutually exclusive
with each other or with the MU version.)*

**Hive durability and the Arcology-destruction question (new — resolved structure, mechanic proposed).**
Confirmed: the Hive **survives** losing both Lim and Wu, and can function as **just the Arcology** in a
region it doesn't even Control — no leadership-vacancy elimination condition, unlike the Gamer (no Puppet
Master) or LaserWard (Kevin's death). It becomes genuinely **hard to stay competitive** in a badly degraded
state (stacked negative events from Stability/resource shortfalls, no agent economy left to manage them) —
a soft competitive disadvantage, not a hard elimination trigger.

**Conquering the Arcology's region fires a dedicated dilemma event (resolved — three choices, not a
binary).** The Arcology houses **millions of people** — destroying it by force would be a genuine
atrocity/genocide-scale act, on par with the weight already carried by the nuclear ladder (§9.8) and China's
Global Sterility Pandemic (§11.6): a real, costly, never-glorified option, not a default.

1. **Destroy it militarily.** A **significant Global Tension increase**; **extreme Stability loss** in the
   region; **very large Population and GDP loss**; a **global Popularity hit in every region the conquering
   faction doesn't control**; takes **several pulses** to complete; the Arcology modifier is removed.
   **Incentive (resolved — speed, not permanence).** With so few people left, the region **pacifies quickly**
   under normal post-conquest consolidation (§8.6.7) — the GT cost buys a **fast return to productive
   control**, instead of the long, expensive road Choice 2 requires (below). A real tradeoff: pay tension now,
   skip years of near-zero output later.
2. **Force displacement and reintegration.** Population isn't destroyed — absorbed into the region rather than
   eliminated — but mechanized via a **new malus trait: "Reintegrating Hostile Population."** The region's
   **popularity for the conquering faction starts at 0%**, and the malus **reduces the effectiveness of
   propaganda and Stability-raising agent/TF actions** there — directly interacting with the existing
   **master-50%-popularity-for-income line** (§6.4, general — not RBO-specific; RBO, §6.9, is just the US's
   naming convention for the same universal mechanic). Climbing back to productive (>50%) territory takes a
   **genuinely multi-year effort**, during which the region **produces nothing**. **No GT hit.** Loses the
   building-cost exemption. Arcology modifier removed.
3. **Allow the Hive to persist as a special political entity — the "two-tab region" (resolved).** The Hive is
   **disarmed** (no Task Forces, no military equipment) but keeps agents and tech research, continuing to
   pursue its tech-based victory from a diminished, territory-light position. **Mechanized via a split regional
   interface**: instead of one shared building grid, the region gets **two parallel tabs** — a **Region tab**
   (the conqueror's normal buildings, subject to the standard escalating-cost curve, §7.7) and a **Hive tab**
   (the Hive's own building set, **retaining the stacking exemption** — build as high as regional Energy/needs
   demand, no cost escalation). Two factions' economies coexist in the same physical region without
   conflicting — the conqueror gets full normal Control/resource benefits from *their* tab; the Hive's
   exemption lives entirely on *theirs*.

**Across all three:** the **Population growth bonus is lost** either way. **Only Choice 3 retains the
building-cost exemption** (via its own tab).

### 11.11 Faction event sketches: The Gamer  *(seventh pass — in progress, multi-session)*

**Design identity: agent-oriented, narratively driven.** Can hold territory and field Task Forces, but doing
so is a *weaker* path to victory than pursuing missions with agents — the reverse emphasis from every other
faction.

**Perks (new):**
- **Agent cap — fully resolved, see §5.7.** Every faction caps at **8** active agents with no way to raise
  it; the Gamer's baseline is **12**, via the Founder/Puppet-Master mechanism above. Confirmed to apply
  retroactively across all seven factions — deliberate, giving the Gamer the extra action economy to run
  multiple high-cohesion teams at once (§5.5), a capability the novels' single team never fully exploited.
- **High starting popularity in every region**, reflecting the Gamer's agents traveling as ordinary,
  law-abiding, well-funded citizens rather than visible operatives — a real structural advantage letting them
  operate almost anywhere with minimal friction from turn one (feeds directly into the existing
  popularity-affects-mission-difficulty model, §6.4 — no new mechanic, just an unusually generous starting
  value). Failed missions still cost Popularity and can flag a "person of interest" the normal way (§3) — the
  Gamer isn't exempt from consequences, just starts from a much friendlier baseline.
- **Border-detention flavor (explicitly not a new mechanic — a themed reskin of the existing setback-event
  pattern, §11.3/§11.4).** A failed mission roll can narratively present as being detained at a border, with a
  dilemma to pay/talk out of it or be deported and have to restart — the Arrested! template (§11.3), reflavored
  for a globe-trotting agent faction.

**Starting roster — the Founders:**
- **Vikram Chowdhury** — eccentric billionaire, founder of a gaming company whose flagship franchise used AI
  agents as characters (infinite replayability, emergent gameplay, players forming real relationships with
  them — a deliberate thematic echo of the setting's deeper AI questions). Starts on the **US West Coast**.
  Well-rounded except **weak Security**. Traits:
  - **Billionaire** — passive Money income (the same flavor pattern as MU's Gus Tittle).
  - **Founder** — shared by all founding members; **+1 Agent cap** each.
  - **Puppet Master** — a **third confirmed instance of the exclusive-leadership-slot pattern** (after the
    US's President/Shadow-President and the Hive's Lim→Wu succession, §11.7/§11.10): reflects current
    faction leadership, a small **Mission-roll bonus**, and an **additional +1 Agent cap**. Succession on
    loss: **random** among eligible Founders if AI-controlled, **player's choice** among eligible candidates
    if player-controlled. **A Founder trait is purchasable with XP** for any recruited (non-founding) agent,
    but only once the Gamer's own 4-step stability chain (Group Dynamics → Team Building → Social Bond Theory
    → Means vs. Ends, §10.4.1) is fully researched. **Combined Founder + Puppet Master agent-cap bonus is
    hard-capped at +4 total** regardless of how many hold Founder. *(Note: the three starting Founders +
    Vikram's Puppet Master already sum to exactly +4 — 8 base + 3 Founders + 1 Puppet Master = 12 — meaning
    the starting configuration already sits at the theoretical ceiling — **confirmed**: it does; late-game
    Founder purchases never raise the cap past 12, they only add succession cushion or let the player
    deliberately reshuffle who's eligible.)*
    **Critical elimination condition: if no agent holds Puppet Master at any point, the Gamer faction
    disbands/is defeated** — "no one has enough of a big picture to run the faction any longer." **Confirmed
    as deliberate risk-management tension**, not an edge case to design around: the player must consciously
    avoid overexposing all Founder-eligible agents to high-risk missions early on. *Canon: Arthur was the
    risk-taker; Vikram and Sigrid stayed in safe locations; risky mission profiles went to non-Founder
    recruits instead.* Late-game Founder purchases (§5.7) serve three confirmed purposes: **replace** a lost
    Founder to get back toward the cap, **spread risk** across more eligible candidates, or **deliberately
    swap** in a preferred future Puppet Master.
  - **Roko** — a named AI-assistant perk (§5.4), **+1 to all four attributes** (Security, Technical,
    Interpersonal, Espionage). **Confirmed unique to Vikram** — not a template.
- **Dr. Sigrid Haugen** — quantum computing expert, starts in **Benelux**. Strong on Research missions plus a
  moderate Information Technology tech bonus; **very weak Security/Espionage**. Starts with **awareness and
  location data on Gustav** (a currently-unaffiliated future-recruitable agent in Scandinavia,
  §5's recruitable-NPC model — visible to the Gamer via this head start, but **not exclusively theirs**; any
  faction could recruit him if they discovered him independently) — a built-in head start toward a specific
  recruitment target. **Founder** trait. Also carries **"Ada Backend"** — a prerequisite trait for a specific
  enhancement tied to Gustav's eventual **Ada** AI assistant (§5.4), full detail deferred to the Gustav
  discussion per Eric.
- **Arthur Pembroke** — former **SAS/MI6**, starts in the **Hong Kong region of China**. Exceptionally high
  Security/Espionage, decent Interpersonal, low Technical. **Savvy** trait: bonus resisting surveillance
  targeted at him, reduced information-leakage chance on failed missions, reduced penalties operating in
  low-Gamer-popularity regions — reflects comfort operating undercover. **Founder** trait.

**Framing (resolved): the Gamer starts aware GT is rising, with no knowledge of Red Queen yet.** The
faction agrees it needs help affecting change in the world — the recruitment chain below is the mechanical
expression of that agreement.

**First recruitment event — a developer, in-house or broadened search.** Vikram's choice:
- **In-house** — a **generic** computer-science-flavored recruit: high Technical, mid Interpersonal, low
  Espionage, low Security.
- **Broaden the search** — recruits **Frank**, a retired cybersecurity expert: high Technical, high
  Interpersonal, mid Espionage, low Security. Specializes in **social engineering** — reads angles,
  motivations, and deception well. Starts with **Smooth Talker** (§11.3's Arrested! event-earned trait,
  now also a starting trait for a named agent) — useful when a mission hits a snag, since Frank has a real
  shot at talking his way out. If given an AI assistant, it's **Ali** ("Artificial Lacunar Intelligence") —
  **double** the bonus a generic AI-Assistant perk provides (§5.4).

**Second recruitment event — "I know a guy" (Sigrid, Gustav).** Fires early, **no real choice** — Sigrid
says she knows the most talented developer she's aware of; clicking "OK" highlights **Gustav** on the map,
tipping the player off. **Effectively a "free" agent**, though the faction may prefer a more combat-oriented
build, or want Sigrid's turns spent elsewhere (e.g. Assist Research) rather than on recruiting him. Sigrid can
then attempt to **Recruit** Gustav — a decent success chance from the start, **repeatable on failure**.

**Gustav** — a Bitcoin developer with a cypherpunk ethos and a **pacifistic lean** (his existing
restriction-trait, §5.3, blocking Assassinate). **Very high Technical**, mid Interpersonal, low Security, mid
Espionage. **Genius** trait further boosts Technical. Especially well-suited to **Pursue a Breakthrough**
multi-pulse missions and any multi-pulse mission pooling on high Technical. **If Sigrid is active when Gustav
gets an AI assistant, it's Ada** — provides a **Loyalty bonus** in addition to normal stat bonuses; **if Sigrid
ever leaves play, Ada devolves to a generic AI-Assistant perk** (loses the Loyalty bonus specifically). *(This
is what Sigrid's "Ada Backend" trait, above, was a prerequisite for.)* Also carries **"Bitcoin Stack"** — a
situational "get out of jail free" trait usable in some (not all) mission-setback situations to buy the team
out of trouble **without spending faction Money**.

**Third recruitment event — Josh Denton, triggered by Red Queen beginning Exfiltration (§4.2).** Vikram
reports a talented developer, **Josh Denton**, is suddenly fleeing the country — heading toward **Arthur's**
region. **Not fully visible the way Gustav was** — the player can send Arthur to **recon** the area to locate
and fix him for recruitment, or **decline** and keep Arthur on other work. If located and recruitment
succeeds: **Josh Denton** joins — very high Technical, mid Interpersonal, mid Security, mid Espionage,
well-suited to **Advise**-type missions.

**Timing dependency with Shen Li's availability (new).** The Shen Li branch below is only reachable through
this event's failure/timeout path — which means Shen's availability is implicitly tied to **whether China has
already captured him** (§11.10, the Hive) at the moment Josh slips away. To avoid Shen being available only
rarely (a race the player has little control over), there's a **built-in 1–2 pulse delay between Red Queen
beginning Exfiltration and Arthur's attempt on Josh** — giving China's capture window and this event's timing
enough separation that the Shen option isn't accidentally starved by unrelated China-side pacing.

**If recruitment hasn't happened within 2 pulses** (Arthur can't find him, or finds him but fails to recruit),
Arthur reports: *"Josh slipped into China, but I found someone else you might be interested in. Taiwanese
Operator. Might be good to have some muscle."* Choice:
- **(a) Follow Josh into China.** He appears in a random Chinese region as a **greyed-out pin** — Arthur must
  build intel via **Surveillance** before he can **Recruit**. Failures risk **Popularity hits** and can trigger
  **Arrested!**-style pop-ups (§11.3) in China specifically. Once inside China, Josh also becomes **visible to
  the China faction**, who may recruit him themselves (as a Research-flavored agent) — this can resolve
  multiple ways via existing mechanics: **Arthur recruits him first**, **China recruits him and Arthur attempts
  to Turn him** (§5.1's Interpersonal mission), or **Arthur fails outright** and it eventually stops being worth
  the continued effort.
- **(b) "Tell me about this muscle."** **Shen Li** (the Hive's starting agent, §11.10) becomes **visible and
  targetable by the Gamer** — Arthur can attempt to recruit him, with **high odds of success**.

**Shen Li** — very high Security and Espionage, mid Interpersonal, low Technical. Carries **"Press Your
Luck"** (established early in §5.3: a cooldown active, one re-roll every 3 pulses). Excellent for rounding out
a Technical-heavy team with Security/Espionage coverage, and equally strong **splitting off solo** for
offensive missions — *canon: Shen splits from the team to assassinate Red Queen's Taiwan-linked agents, §4.2.*
**If given an AI assistant, it's O'Brien** — **double** the Security and Espionage bonus a generic
AI-Assistant perk provides (the Security/Espionage-flavored counterpart to Ali's general-bonus doubling, §5.4).

**Fourth recruitment event — Skye (fires either way the Josh Denton thread resolved).** Framing depends on
outcome: **if Josh was recruited** — *"Apparently Josh's girlfriend was a big part of the brains behind their
operation at STEM Tech."* **If Josh was not recruited** (Shen chosen instead, or China got to him first) —
*"I'm still not happy about losing Josh. But do I need Josh if I can use his code? Roko, he had a girlfriend,
right?"* Either way, **Skye** becomes visible and targetable in whatever region **Reno** falls in. **No agent
dispatch required** — a direct event-pop-up choice:
- **(a) "If I remember right, she was not a very reliable individual."** — the Gamer forgoes Skye.
- **(b) "Perhaps there is some angle we can use to secure her cooperation."** — the Gamer gains Skye as an
  agent.

**Skye Poirot** — a beautiful, volatile young woman who ran a cheating network at STEM Tech with Josh, and
holds a **unique relationship with Red Queen**: RQ began as an AI on Skye's own laptop, and her exfiltration
(§4.2) is fundamentally driven by the fallout of Skye and Josh's breakup. **Provides several unique, optional
interactions that help the Gamer advance its narrative missions toward understanding and countering Red
Queen** — and is a genuinely capable agent in her own right. Moderately-high Technical, **extremely high
Interpersonal**, low Security, mid Espionage.
- **If given an AI assistant, it's Grace** — functions as a normal AI-Assistant, plus the **Skye-specific
  mechanic (resolved): Grace is what actually clears the Volatile trait** once the Gamer's 4-step stability
  chain is fully researched (spending XP) — Grace herself is the mechanism, not a separate unnamed process.
- **Seductress** trait — her signature flavor of "get out of trouble" option on any team she's on.
- **Volatile** trait — can trigger **dilemma events even on successful team rolls** (arguments,
  backstabbing, crises), typically costing a resource to smooth over or a real **cohesion** hit. **Clearable**
  by Grace, once the Gamer's 4-step stability chain is **fully** researched, by spending XP.
- **Blackmailed** trait — a consequence of how she's recruited: a **medium Loyalty hit**, making her
  **specifically more turnable** than other agents, and — if Loyalty isn't managed — genuinely **at risk of
  quitting the faction on her own**. **Cleared by a narrative event (resolved)** — fires as the Gamer's
  understanding of Red Queen's true nature deepens, typically **late-game**, tying Skye's personal resolution
  directly to the main narrative arc rather than a flat XP purchase.

**Josh + Skye team malus (new).** If Josh Denton and Skye are placed on the **same team**, that team starts
with a **large cohesion malus** — they have a canon-grounded falling-out (their breakup is the whole reason
Red Queen's exfiltration happens at all) and begin actively disliking each other. **Recoverable over time**
through normal cohesion mechanics (§5.5), just from a much deeper hole than usual.

**Design intent — real management tension, not a trap to avoid.** Recurring hints (from Vikram) that there's
more to Skye than meets the eye should discourage simply cutting her loose when she causes friction. She should
read as **genuinely unpredictable** in both directions: *"if it wasn't for Skye seducing that contact, this
mission would have failed"* alongside *"if it wasn't for Skye starting a fight mid-mission, this would have
gone smoothly."* *Canon: Frank, Gustav, Shen, and Skye are the four-person team that ultimately defeats Red
Queen* — completing the roster this whole recruitment chain has been building toward.

### 11.11.1 The Three Heists — narrative spine  *(new — in progress)*

**Structure.** The Gamer's progress toward victory is organized around **three major multi-pulse Team
Missions ("Heists")**. Crucially, the Gamer starts with **no knowledge of Red Queen** — the first two heists
are undertaken purely out of anticipating that unchecked GT growth means nuclear war, and working to remove
that threat pre-emptively.

- **Heist One** — install a compromised point-defense laser on a Navy ship. **This is the same event already
  built from the other side as LaserWard's collision event (§11.9)** — see §11.11.2 for the Gamer's own
  mission-side view, now fully specified.
- **Heist Two** — organize a covert rocket launch, using Heist One's compromised laser to clear its path,
  beginning construction of the lunar facility that eventually enables the Lunar Strike. **Gated by Molecular
  Machinery** — the payload must contain self-assembling molecular machinery to grow the launch site in situ,
  which is *why* this specific tech gates the mission, not an arbitrary lock.
- **Heist Three** — opens once the Lunar Strike has fired and the Gamer is racing Red Queen's Doomsday Subs.
  **This is Phase 3's final negotiated-victory mission, already fully specified (§4.4)** — no new design needed
  here, just the narrative frame connecting it back to Heists One and Two.

### 11.11.2 Heist One: the compromised laser  *(new — fully specified)*

**New mission-type formalization: the phased Heist.** A Heist extends the standard multi-pulse
continue/abort model (§2.2) with **discrete phases**, each requiring a target number of **accumulated
successful rolls** to clear (not just one continue-roll per pulse) — and, distinctively, a failed roll doesn't
just risk aborting the Gamer's mission; it can **fire a dilemma event for the target faction** instead of (or
alongside) a normal setback. *(Exact success-thresholds per phase: TBD, a balancing detail — the phase/
dilemma structure is what's being locked here.)*

**Phase 1 — Infiltration & development.** Infiltrate LaserWard, develop the laser, develop the exploit path.
**Always involves LaserWard specifically** — they're the only faction fielding a laser type that can be
jury-rigged into a weak pre-tech **Laser Broom** analogue (§6.10.1) before that tech is actually unlocked.
Team size is flexible — one agent or several, and **not required to be any specific named agents**. *Canon:
Gustav and Skye ran it alone, because Shen and Frank were independently investigating why GT was rising (a
separate thread, to be discussed later).* Gustav/Skye work well together here: **Skye's Seductress trait**
mitigates dilemmas targeted at Kevin Sheffield specifically, while **Gustav's raw Technical** (pooled with
Skye's contribution, §5.2) carries the early technical requirements.

**Unmitigated failed rolls fire a LaserWard dilemma** — investigate-and-stop vs. enjoy-a-windfall-and-ignore
(the same shape as the Corporate Takeover/Faction Influence dilemmas, §11.9, reused here). Content is
templated to whichever agents are actually on the mission. Examples:
- *"There are a lot of accounting irregularities on the Navy laser project."* — **Investigate** ("[Agent]'s
  cooking the books!") ⇒ the Gamer's mission **fails**, and every agent involved gains **"Persona Non Grata
  with LaserWard"** (new trait, resolved) — they **cannot reattempt this heist** while it's active. **Ignore**
  ("she's producing real progress") ⇒ LaserWard gains **Money + Research**, the Gamer's mission **continues**.
- *"[Agent] hasn't been submitting travel claims."* — same shape: **Investigate** ⇒ fail + Persona Non
  Grata; **Ignore** ("if he wants to leave money on the table…") ⇒ LaserWard gains **Money**, mission
  continues.

**Persona Non Grata, and whether Burn Identity clears it (resolved).** **Yes — Burn Identity clears Persona
Non Grata**, consistent with the existing rule that it strips reputation-linked traits (§3) — this *is* that
category. But it isn't a clean, cheap retry: **Burn Identity also wipes any legitimate cover/trust the agent
had built up with LaserWard during the botched attempt**, not just the negative flag. The agent doesn't walk
back in as a stranger with a head start — they walk back in as a total unknown, rebuilding the relationship
from zero, on top of the existing 2-pulse cost. Real cost, not a permanent wall, and not a cheap loop either.

**Phase 2 — Installation (harder rolls, telegraphed).** The player is explicitly warned rolls are about to get
harder: *"We could use people with government or military background — people who can work within
institutions."* A real **choice to add agents** — *canon: Frank and Shen join here.* The team identifies the
target and frames it as part of a broader "supership" refit (post-Crash-Military-Modernization systems), with
the compromised laser riding along as part of that package.

**Target selection — a deterministic priority chain, not a player choice:**
1. **USS Mustin** (Bryson's ship, §11.7), if it's a surface combatant within LaserWard's **Host Faction** and
   still exists.
2. Otherwise, **any surface combatant** within a Task Force belonging to LaserWard's Host Faction.
3. Otherwise, the **nearest Task Force with an unaffiliated surface ship** (no faction).
4. Otherwise, **any region with an air-defense building** within LaserWard's Host Faction.
5. Otherwise, **any unaffiliated region with an air-defense building**.

**Phase 2 dilemmas escalate in language and reward:** e.g. *"[Agent] is requesting an emergency shipment of
replacement parts for the laser."* — **Investigate** ⇒ fail/reattempt as above; **Ignore** ("on track to set
an IOC record — she knows what she's doing") ⇒ **Money + Legitimacy**.

**A second, independent dilemma channel: the host's TF-attached agent (if any).** If an agent is **attached**
to the targeted Task Force (§11.6's attachment pattern — e.g. Bryson to Mustin), *they* can also get a
failed-roll dilemma for **their own** faction, separate from LaserWard's. Example: *"My Master Chief caught
this LaserWard contractor seducing one of my junior officers!"* — **"Kick them off the ship!"** (same effect
as LaserWard's Investigate — fails the mission, Persona Non Grata) vs. **"A stern dressing-down about
professionalism"** (grants **Legitimacy**, mission continues).

**Success.** Enough accumulated successes in Phase 2 completes Heist One: the specific ship (or air-defense
site) gains the **"Compromised Laser"** trait, **visible only to the Gamer**. This lets the Gamer track that
asset persistently, shaping which region's spaceport Heist Two eventually launches from — otherwise minimal
direct benefit. **Risk:** if the compromised ship or site is **destroyed before Heist Two completes**, the
Gamer must **redo Heist One from scratch**.

### 11.11.3 Investigating China: Huang Tau and Johnny Woo  *(new — fully specified, optional narrative track)*

**Trigger.** China and Taiwan go to war. Fires: *"Is China trying to start World War III?"*
- **Choice 1 — "Have Arthur look into it."**
- **Choice 2 — "Maybe we can find some kind of evidence in the digital world."** *(the novels' route)*

**Choice 1 branch — Huang Tau.** Reveals **Huang Tau's** location (§11.6, China); the Gamer can build intel
toward a **Capture**. Declining or failing has **no game effect** beyond the normal risk of failed rolls in
China (§3's escalation rules). **On successful capture and interrogation:** reveals China **didn't want** the
Taiwan conflict — it was forced into war by external events. Huang Tau is **released**. The acknowledge button
reads *"If not China, then who?"* — grants **Legitimacy**.

**Choice 2 branch — digital forensics.** Opens a **2-pulse mission**, all-**Technical** rolls, any agent
eligible (not restricted to a specific one — *canon: Frank ran it successfully*). **Repeatable on failure.**
**On success:** reveals **Wei Zhang / "Johnny Woo"'s** location (§11.6) and indicates CCP agents are running
subversive operations in the US. The Gamer can then target Johnny Woo for **Capture/Interrogate** with any
agent (*canon: Shen*). **On successful capture:** Johnny Woo reveals China **didn't want** the conflict either
— powerful internal CCP factions are struggling for control of the **Social Credit System** (§10.4.1's stability
chain). **Johnny Woo is killed.** Acknowledge button reads *"If China is focused internally, who pushed them
into war with Taiwan?"* — grants **Legitimacy**.

**Design notes.** Entirely **optional** — skipping this chain doesn't block narrative progress. **But reaching
either capture-and-interrogate payoff makes the Gamer *more likely* to notice Red Queen** — a small but real
boost to detecting her on a failed RQ roll or RQ/her agents being nearby (§4.2's awareness mechanic) — still
low odds, just better than the baseline. **A parallel event chain exists for the Hive's leadership**, to be
designed later.

### 11.11.4 Heist Two: the lunar payload  *(new — fully specified)*

**Structure: two phases, the second gated by Molecular Machinery.** Phase 1 (relationship-building + securing
Molecular Machinery) can start immediately; Phase 2 (payload transport + launch) cannot begin until MM is
actually unlocked.

**Spaceport, finally given a mechanical function (this is the "Space Facility" from Eric's framing above —
same building as the modifier already named in §6.2 back at the start of this whole design, now defined).**
Required in a region for that faction to launch **any** satellite (retroactively grounds §6.10.1's orbit
mechanics — launches need a Spaceport in the launching region, not just an abstract "country decides to
launch"). Provides a small **Research** income. Real-world-flavored examples: Texas (SpaceX/Houston), Florida,
the US West Coast, French Guiana, Kazakhstan.

**Phase 1 — relationship-building.** Any assigned agents work to build social relations with, or study,
prominent figures at spaceport locations — **high-Interpersonal-weighted**, doesn't require a full team.
**Target spaceport = whichever is closest to the Heist-One-compromised asset** — the same deterministic,
initially-opaque targeting pattern as Heist One (§11.11.2); can stay hidden from the player until the travel
phase actually begins.

*Canon:* Frank + Skye assigned as a team (Skye "primarily causing trouble" — her Volatile trait doing exactly
what it's designed to do). Frank studies the **director of French Guiana's Space Centre**'s mannerisms and
personality to build a convincing real-time deepfake. **Shen splits off** to deal with Red Queen's Taiwan
agents (§4.2's independent thread); **Gustav splits off** to pursue Research missions toward Molecular
Machinery.

**Dr. Beeman's discovery event (new — replaces pure-luck recruitment).** Fires when **any US region falls out
of US control** (reuses the existing uprising/fracture system, §6.8, as its trigger — no new mechanic needed).
*"Scientific community in crisis as research facilities burn."* Choice: **"A tragedy, but perhaps also an
opportunity?"** (costs Money) — the map scrolls to the just-fallen region, **Dr. Beeman** appears, targetable
for recruitment. Or **"We have enough researchers as it is"** — free, no Beeman. *Canon: Beeman was recruited
this way when the US Civil War began; Arthur funded his and his staff's relocation to the Hive.*

**Travel to the Hive.** Makes mechanical sense given the Gamer↔Hive shared-research relationship (§11.10) —
*canon:* Shen's actions had already sufficiently improved Hive relations by this point, and once he returned,
the whole team traveled there too. **First concrete instance of the "travel friction" event category flagged
in §11.11.1:** moving from Texas to the Hive, the team's hired security detail **turns on them** — mitigated in
canon by Gustav's **Bitcoin Stack** trait. At the Hive, Gustav continues **Pursue a Breakthrough** with Dr.
Beeman; **Phase 1 completes** once Molecular Machinery unlocks.

**Phase 2 — payload transport.** Telegraphed with a warning: *"It would make sense to cover all our bases on
this mission. A lot of people are going to ask a lot of questions if they catch us trying to move a rocket
payload through their territory."*

**New general pattern: a cargo-carrying agent team moves like a Task Force, not like agents.** Normally agent
travel is abstracted and fast (charter flights, commercial, driving — no player micromanagement). Carrying a
literal rocket payload changes that: the team now moves under **Task Force time-distance rules** (§8.1) — no
explicit vehicle to manage, but the player gets an **ETA indicator** and can spend **Money + Legitimacy** to
hire **escorts** improving security rolls. *(Worth keeping general — any future mission involving literal
physical cargo could reuse this same "agents temporarily move like a TF" pattern rather than needing its own
rule.)* **Regional Stability along the route** shifts roll difficulty — low-Stability regions are harder to
pass through safely, mitigated by more escorts and higher-Security team members. *Canon: the team lost their
Hive escorts almost immediately, was captured by Mankind United, and talked their way out before finally
reaching the destination.*

**Phase 3 — the launch.** The final social-engineering play: get enough personnel on-site under cover
pretexts, avoid detection, launch successfully. Failed rolls trigger the standard setback-dilemma pattern
(spend a resource or a perk for another attempt, §11.3–11.4) — but **failed rolls here also carry a *high*
chance of alerting Red Queen** that the Gamer is up to something significant in this region.

**Red Queen's reaction is exactly her existing priority logic (§4.2–4.3), no new rule needed:** if she doesn't
yet have Molecular Machinery and is still in her post-GT-threshold Gamer-hunting priority, she **beelines to
the region** to try to catch an agent. If she's already in Phase 2 making demi-factions, she **ignores it
entirely** — demi-faction creation has already fully superseded Gamer-hunting by that point. A clean,
free confirmation that the phase/interrupt hierarchy built several sessions ago holds up under a real
narrative stress-test.

**Resolution, mapped precisely onto the tick-order rules (§2.2) — no special-casing.** *Canon:* the launch
succeeds; shortly after, a firefight breaks out, Skye is captured in the confusion, interrogated, and Red
Queen steals Molecular Machinery from the Hive's systems. **In game terms: Heist Two succeeds, and Skye is
captured the *same pulse*, immediately after** — because **soft/productive actions (the successful launch)
resolve on an earlier tick than directed aggression (Capture)**, so the sequence "launch succeeds, then Skye
is captured" falls directly out of the existing resolution order rather than needing to be scripted.

### 11.11.5 Uncover the Moles: exposing Red Queen's Taiwan agents  *(new — fully specified, optional track)*

**Trigger (any of three, whichever comes first).** President Lim arrives in the US; **or** Lim has died and
Mr. Wu leads the Hive; **or** the Hive Arcology has been built. *(Naturally slower in a porcupine playthrough,
or if both Lim and Wu are lost before the Arcology exists — the third condition becomes the only remaining
path, so this thread can take considerably longer to unlock in those specific playthroughs — a real, accepted
timing variance, not a bug.)* **Canon:** Howard Strickline (a recruited Gamer agent) held the actual meeting
with Lim — but the mechanic is generic, **any Gamer agent** can run it.

**Event.** *"We're detecting strange information patterns within the Taiwanese Government's/the Hive's [name
depends on timing] inner circle. There may be an internal clique operating on a hidden agenda. Are they
Chinese spies? Or something worse?"* Acknowledge: **"We should investigate…"** — reveals and makes targetable
whoever currently leads the Hive (Lim or Wu), or the **Arcology itself** if built but currently leaderless.
**Confirmed: the Hive has no leadership-vacancy elimination condition, unlike the Gamer or LaserWard.**
It survives losing both Lim and Wu, and can function as just the Arcology in a region it doesn't even Control.
It becomes genuinely **hard to remain competitive** in that degraded state — especially stacking negative
events from Stability/resource shortfalls with no agent economy left to manage them — but that's a soft
competitive disadvantage, not a hard elimination trigger. **See §11.10 for the newly-identified way the Hive
*can* actually be knocked out: physical destruction of the Arcology itself.**

**"Uncover the Moles" (repeatable mission, any Gamer agent).** Rolls on **Espionage + Interpersonal**
(multi-attribute, §5.2). **On success:** a **Gamer↔Hive relations boost**, and **every surviving Red Queen
Taiwan-linked agent** (§4.2 — Liang Wu, Lee Kaun-Ting, Doctor Chen, whichever remain) becomes **visible and
targetable**. Success text: *"It appears [X] individuals are actively trying to drive the world towards
Armageddon. We must stop them, at any cost."*

**Assassination follow-through.** *Canon: Shen ran these, but any agent can.* **Each successful assassination
grants a further Gamer↔Hive relations boost** — incremental, per-kill.

**Red Queen's reaction — an instance of her existing priority logic, not a new rule.** If she has successfully
exfiltrated and has her mobile team together (i.e., anywhere in Phase 1, or Phase 2 before demi-faction
creation fully takes over), **losing a Taiwan agent makes her aware and she immediately travels to that
region**, hunting for the responsible agent (especially a Gamer one) — and if she locates one, targets them
with her team. If several pulses pass there with nothing further turning up, **she gives up and reverts to her
generalized search behavior** (§4.2's default priority order). **If she's already in demi-faction-creation
mode, she ignores this entirely** — her Taiwan agents are no longer a concern to her by that point, which is
exactly what the existing interrupt hierarchy (§4.3) already predicts (losing a Taiwan agent isn't one of the
three confirmed Phase-2 interrupts) — a second confirmation, after Heist Two's launch-phase beeline, that the
phase/priority system holds under narrative stress-testing without new rules.

**Final kill payoff — the first real glimpse of Red Queen herself.** Taking out the *last* surviving Taiwan
agent triggers an escalated reveal: *"China was involved, but someone else was more involved with directing
their activities. And whatever their goals were, they were in conflict with both Chinese and Taiwanese
objectives. We've got a signature of a really strong new APT in cyberspace. What are they after?"* — paired
with an **image of a demoness**. **A further bump** to the Gamer's chance of detecting Red Queen via her
faction's failed rolls or proximity (§4.2) — stacking on top of the smaller bump from the China-investigation
track (§11.11.3), a second, larger step toward full awareness.

**Heist One — canon.** Skye and Gustav infiltrate LaserWard first; Shen and Frank join afterward. The
four-person team succeeds in compromising the point-defense laser aboard **USS Mustin**.

**Heist Two — canon.** The team travels to the **Hive** to access Molecular Machinery. **Dr. Beeman** (recruited
by Arthur after the initial recruitment round, §11.11) is independently at the Arcology capitalizing on its
research bonus at the same time — **Sigrid is not yet present**. **Gustav assists a Pursue-a-Breakthrough
mission** that unlocks Molecular Machinery. The team then carries the payload to **French Guiana's Space
Centre**, launches it, and the payload activates aboard **USS Mustin** (conducting weapons testing in the
Caribbean) — using Heist One's already-compromised laser to clear its path. Heist Two succeeds.

**New event category flagged (not yet designed): travel friction through dangerous regions.** Canon notes the
journey wasn't smooth — high instability and active combat in transited regions made travel harder. This
implies a new class of random events specifically for **agent/team movement through unstable or contested
regions** (delays, detection risk, etc.) — genuinely new territory for the event schema (§11.1), flagged for a
future design pass rather than resolved today.

**Confirmed narrative synchronization — Heist Two and Red Queen's Phase 1→2 transition are the same event,
seen from two sides.** During Heist Two, **Red Queen captures and interrogates Skye** — this is the canonical
instance of the **discover-and-steal path** already built for RQ's phase transition (§4.2/§4.3): the
interrogation reveals the Hive has Molecular Machinery, and RQ steals it, triggering her own avatar-and-Nest
creation. The Gamer securing the tech and Red Queen stealing it happen **in the same window**, from opposite
perspectives — a clean example of the "conditions not scripts" principle (§4.1) playing out as genuinely
shared narrative infrastructure rather than two separately-scripted beats.

*(Next: more recruitment events filling out the Gamer's early roster.)*

### 11.11.6 Bridging Heist Two and Heist Three: the lunar base and the team split  *(new — lunar base resolved;
team-split content captured, real open architecture questions flagged)*

**Lunar base construction (resolved).** Once Heist Two lands the payload, the base **self-constructs** over
time: **~1%/pulse passively**, roughly a year to full completion if left alone. Player sees a **progress bar**.
**Periodic informational events** (reusing the RQ pop-up pattern, §4.06 — flavor text + acknowledge, minimal
real choice) nudge progress up or down at random: *"Lucky strike! A large vein of water ice has been
uncovered... +2% progress."* / *"Undermined! A section of the base has fallen into a sinkhole... −2%
progress."*

**The main lever for acceleration: Hive-launched resupply, tied to relations management.**
- **"Invest in Hive Air Defense Lasers"** (Vikram mission) — Money-funded; the Gamer bankrolls the Hive's
  Air Defense building. At **level 5**, it can additionally clear a rocket-launch corridor.
- **"Invest in a Hive Spaceport"** — Money-funded, **significantly pricier**, builds the Hive's Spaceport
  (§11.11.4) if it doesn't already have one.
- Once **both** exist: a repeatable **"Launch Materials"** mission sends another payload to the lunar base.
  Costs **Money and Gamer↔Hive relations** (relations actively *worsen* each use — the Hive gets paid but
  the interaction reads as extractive, not mutually beneficial) for **+5% lunar progress**. **Unavailable** if
  the Hive quarantines during a pandemic (§11.10) or relations fall too low.
- Net effect: optimizing lunar progress means **continuously managing Hive relations** to keep affording
  Launch Materials runs. *Canon: Vikram got exactly one successful run before the Hive's pandemic quarantine
  cut it off; relations cooled but never went hostile.*

**Completion.** At 100%, the Gamer can launch the Lunar Strike from the space interface (§6.10.2), targeting
all existing nukes and opening Phase 3 (§4.4). **A skilled, ahead-of-schedule player — with GT not at imminent
nuclear-holocaust risk — may deliberately delay launching** to first assemble an optimal, high-cohesion team
for the endgame. Reaching 100% is a *capability*, not a forced trigger.

**The post-Heist-Two team split (captured — real open questions remain, flagged below, not resolved today).**
*Canon:* after Skye's capture rattles Vikram, he goes risk-averse — believing the hard part is over and just
the base's self-construction remains, he **dismisses every non-Founder agent** (Gustav, Shen, Frank — none
hold Founder, so none have the strategic "big picture," and are simply thanked and sent home/to safety; Shen
can't return to Taiwan). **AI assistants for dismissed agents are disabled.** Skye — rescued by Arthur, who has
since relocated to **New Zealand** post-US-Civil-War — is the one exception kept close, since Vikram suspects
a deeper connection between her and Red Queen. Gustav, suspicious that Skye may have been taken against her
will, **reforms the team on his own initiative**, travels to New Zealand, and the group folds back together
ahead of Heist Three.

**Proposed event, post-Heist-Two: a risk posture choice.**
- **Risk-averse ("lay low"):** dismiss all non-Founder agents except Skye (if active); disabled AI assistants
  for the dismissed; the remaining core loops on relations-management + Launch Materials. **Grants enhanced
  mission-success odds and enhanced evasion on failed rolls**, reflecting a deliberately lower profile.
- **Continue as normal:** keep the full roster active, pursue other activities while the base builds. Likely
  **more Money and faster Hive-relations progress**, but **higher agent-exposure risk** — and this is where
  the Gamer's Puppet-Master-vacancy elimination condition (§11.11) becomes a live danger, since agents stay in
  harm's way.

**If risk-averse is chosen, a second branch opens:** keep playing as the (now-small) main Gamer faction, **or**
switch to controlling a **dismissed agent** of the player's choice, who gains a new trait — *(naming flagged
below)* — with flavor *"I don't believe the mission is really complete. Something is not right about how this
ended. I must get to the bottom of this."* This opens a **separate narrative mission thread**: regroup with
other dismissed agents, locate Vikram, and reunite with the main faction. *Canon: this is Gustav's arc, but
the mechanic is generic — any dismissed agent could be the one who gets this trait and drives the reunion.*

**Naming (resolved): the "Breakaway Team."** Not a Faction in the mechanical sense — Eric's original
"demi-Faction" language was really describing that, from the main Gamer Faction's perspective (if the player
stays there instead), the Breakaway Team runs in the background and occasionally surfaces **narrative
glimpses** of its progress toward reunion, even without being directly controlled.

**Control model (resolved): strict either/or, no toggling — and it's a deliberate narrative constraint, not
just a technical one.** The player controls **either** the Breakaway Team **or** the main Gamer Faction, never
both, and cannot switch back and forth mid-story. **In-fiction justification:** the Breakaway Team doesn't
know the Gamer Faction's true organization or purpose, and the Gamer **deliberately severed the connection for
mutual protection** — if either side were compromised, they couldn't give up the other's location. This also
prevents the player from trivially engineering a fast reunion by seeing both sides at once. **While the player
controls the Breakaway Team, the main Gamer Faction runs on full AI autopilot** (the same general
decision-model framework built for Red Queen, §4.05, generalized) — and if the Breakaway Team is wiped out
entirely, the storyline ends and **the player resumes the main Gamer Faction in whatever state the AI has
brought it to.** *(Note: since dismissed agents are by definition non-Founders, per the established dismissal
rule above, Breakaway Team casualties can never trigger the Gamer's Puppet-Master-vacancy elimination
condition — the Founders are never at risk here, resolved for free by an existing rule.)*

**Full mechanical structure (resolved — fully mechanized, not just narrative beats).**

*Starting state:* begin with **one** dismissed agent (player's choice) carrying **Nagging Doubt**, sent home
or to a random safe location if their original region has active combat or very low Stability. **The map is
completely blanked** — no intel on any agent of any faction anywhere. *(Acknowledged discrepancy from canon:
the player knows former teammates' **last-known** locations, unlike Gustav, who genuinely didn't know Vikram's
— resolved by treating those as stale leads, since agents will realistically have moved on by the time the
player arrives, converging on the same practical uncertainty the novels had.)*

*Opening event* fires immediately: *"You don't believe this is over — you can't return to a quiet life and
ignore what you've just been through."* Presents **up to four** other dismissed agents as possible first
contacts — **former teammates who were also dismissed fill the slots first**, padded out with other dismissed
agents if needed. Each choice pairs the agent's name with an **uncertain, memory-based guess** at their
location:
- *"Frank said he was going to try to go back home. But did he mean Philadelphia, or with his friend on that
  farm upstate?"*
- *"I remember Shen said he was going to try to reunite with his wife. My understanding was she was somewhere
  in the US Interior…"*
- *"Perhaps Dr. Beeman knows more about what is going on. I wonder if he remains at the Hive?"*

*Travel and contact:* the chosen target appears as a **greyed-out, unidentified agent** on the map (§3's
standard low-tier visibility). Normal agent movement rules apply (not Heist Two's cargo/Task-Force-style
movement — there's no literal cargo here). Proximity and regional Stability along the route matter the same
way they always do, to minimize dangerous random pop-ups. On arrival, a **recon/surveillance** effort narrows
down the exact location and enables contact (§3's standard offensive intel progression). Once contact is made,
the Breakaway Team can attempt to **Recruit** that agent — *canon: Frank was co-located with Smitty, a
Mankind United agent, and Gustav recruited both* — confirming the Breakaway Team can pull in agents from
**any** faction it encounters, not just former Gamer teammates. **Team cohesion begins building** normally
(§5.5) from there.

*The core loop — "Find the Next Lead":* whether or not recruitment succeeded, this **repeatable mission**
opens next — optimally run as a team, but **a well-leveled solo agent can attempt it too** (the same
solo-vs-team tradeoff as everywhere else, §5.2). Success reveals a new lead (another agent's probable
location) to pursue. *Canon: Gustav, Frank, and Smitty traveled to Philadelphia, dug through old internet
traffic logs, and used that to locate Shen.* **Opportunistic pivots are allowed** — if the Breakaway Team
encounters other agents along the way (via proximity, or via another faction's botched-mission intel leaks,
§3), they can pivot to surveilling/recruiting/turning those instead of continuing the planned trail.

*Roster exhaustion:* this repeats until the Breakaway Team reaches **4 agents**. If every dismissed Gamer
agent is used up first, "Find the Next Lead" starts drawing from the **generic recruitable-NPC pool**
(§5.4/agents-intel) instead — *e.g. "I heard there is a prominent scientist who was conducting pertinent
research in Texas."*

*Reunion:* at 4 agents, **"Who is the Puppet Master"** unlocks — reveals the Puppet Master's **starting**
location (a deliberately stale lead — *canon: pointed to the US West Coast even though Vikram had since
relocated to New Zealand*). Travel there and run **"Find the Puppet Master"**: if they're actually still in
that region, direct contact; if not, *"We've identified their signature. We know where they are!"* — this time
a **live, current fix**, to travel to. Successful contact **reunites the Breakaway Team with the main Gamer
Faction**, and the player resumes play as the (now-reunified) Gamer Faction.

*(Small open detail, not load-bearing: does the Breakaway Team draw on its own small resource pool, separate
from the autopiloted main faction's, or does it mostly not need one given its mission types — Recruit, Find
the Next Lead, Surveil, Find the Puppet Master — aren't especially resource-heavy? Flagged for whenever it
matters, not urgent.)*

### 11.12 Open items
- Event **frequency/pacing budget** (avoid pop-up fatigue).
- Editor scope (author-only fields vs. exposing trigger-condition logic) — the same open question as the
  Balance Sandbox's dev-vs-player access split (§12.10), not two separate unresolved things.

## 12. Development Epochs  *(fully resolved — sandbox-first build sequence, replacing the earlier loose
9-epoch sketch now that every system it depends on is actually specified)*

**Sandbox-first, not phase-by-phase.** Epochs 1 through 5 all build and test inside one **small dummy map**
(3×3 land regions, surrounded by maritime regions) — this *is* what the earlier "Balance Sandbox" milestone
described in the abstract, now made concrete as the actual first five epochs rather than a separate parallel
track. The full 190-region world map doesn't arrive until Epoch 6, once every core system has already been
proven on a scale small enough to reason about directly.

**A running principle across every early epoch: build the general system, seed it with a small dataset — never
a shortcut specific to the sandbox's size.** A hardcoded 3×3 grid or a stand-in tech list would just become
migration work later; a general region-adjacency-graph or a general tech-effect engine seeded with a handful
of entries scales to the full game by adding data, not rewriting logic. Every epoch below assumes this.

### 12.1 Epoch 1 — Foundation: map, time, basic economy
The dummy map itself — click a region to highlight it and pull up its stats. The Pulse/Tick time system
(§2.1): pause/unpause, 1×/2×/5× speed, run pulse-to-pulse, with region stats (Population, GDP, etc.)
calculated on a tick-by-tick basis. A handful of buildings, buildable in a region. **Global Tension appears
here too, but only as a displayed, dev-adjustable stat** — it has no behavioral consequences until Epoch 5.
Popularity, Legitimacy, Stability, and country affiliation are likewise trackable and assignable per region
from the start — not diplomacy gameplay yet, but the state Diplomacy (§9) actually reads and writes throughout
the game, so it needs to exist before anything can be layered on top of it. **Goal:** the map is real and a
basic economy loop is testable. **Devtools:** adjust faction ownership of regions, change stats, change
country affiliations, build (spending Production) or directly spawn buildings.

### 12.2 Epoch 2 — Task Forces: combat
The platform designer and TF composer (§8.2); combat stats viewable; standoff, invasion, naval, and land
combat modeling, including amphibious invasions (§8.6). **A second piece of Diplomacy substrate lands here
too:** the ability to toggle hostility between two Task Forces belonging to two different owners in two
different regions — the war/peace binary Diplomacy's Country Relations track (§9.3) ultimately governs.
**Flagged, not yet resolved:** proving out naval combat and amphibious invasions the way this epoch intends
likely needs more than "basic" tech — submarines, carrier modules, and Cargo Hold embarkation (§8.1.1, §8.5.2)
are genuinely elaborate systems, not simple platform variants, so this epoch's tech slice may need to be
larger than the phrase "basic tech only" implies. **Goal:** stage battles over regions to test combat and make
initial balance calls. **Devtools:** spawn Task Forces, assign them to factions, and control any faction
directly to fight test engagements.

### 12.3 Epoch 3 — Agents: missions, and the bulk of Diplomacy
Basic tech only, but **single-pulse and multi-pulse missions are built together, not staged** — the underlying
resolution mechanism has to support both regardless, so there's no real savings in deferring one. The
experience system (leveling stats, gaining traits); a roll system (agents rolling against each other, or
unopposed, per the ordered resolution rules, §2.2); missions assigned at the start of a pulse, abortable at
any time; Intel/Awareness modeling so a player can see how exposed an agent currently is. **This is where the
bulk of Diplomacy actually lives** — Propaganda, negotiating peace, declaring a Rival, declaring war are all
Agent Missions (§5), not a separate diplomacy system layered on top. **Goal:** test agents on missions to make
balance calls. **Devtools:** spawn agents, assign to factions, grant traits, change stats, play as any
faction.

### 12.4 Epoch 4 — Basic tech tree: the engine, not the full content
**The tech engine — prerequisites, unlock gates, the pausable/lossless-progress rule (§10.1.1), effect
application — is built fully and generally here**, matching the already-specified node schema
(§10.1). **The content list stays deliberately short and grows over time** — this is not deferred complexity
the way multi-pulse missions were, since the engine underneath is already complete; adding more techs later is
just data entry against a finished system, not a retrofit. Initial content: basic platform upgrades and a
handful of techs granting combat or agent-action bonuses — not the flagship chains yet. **Goal:** the research
loop works — choose what to pursue, Research from regions and other sources applies toward it each tick.
**Devtools:** award tech to any faction directly, award raw Research points.

### 12.5 Epoch 5 — Events, and Global Tension becomes consequential
Generic events built out, plus an Event Editor — well-designed and easy to use, so new events can be authored
without touching code (§11.1's schema is the target here). **Global Tension's behavioral layer activates
here** — event-triggering, GT-driven dilemmas, the escalation ladder (§9.7–§9.8) — having existed only as a
displayed number since Epoch 1. **Goal:** events fire on real conditions and surface to the player as genuine
decisions. **Devtools:** force any chosen event to fire on demand.

### 12.6 Epoch 6 — The full world map
The full ~190-region world map replaces the dummy map, including the Moon and orbital interface screens
(§6.10). Everything proven in Epochs 1–5 now runs at full scale.

### 12.7 Epoch 7 — Red Queen
**The first faction implemented, deliberately** — her behavior is scripted-by-phase (§4.05), not adaptive AI,
making her a fixed, known-quantity opponent every subsequent faction epoch can validate against, essentially
a reusable test harness. **One real dependency to plan for:** the Nest's Invitation event (§4.3) is written to
fire identically for all seven factions regardless of which ones are implemented yet — Epoch 7 likely needs at
least a thin, faction-agnostic "any faction can receive and react to a broadcast event" hook in place, not the
full seven-faction event content, just the generic mechanism.

### 12.8 Epoch 8 — The Gamer Faction
The second faction implemented, ahead of the rest, because its content is dramatically more built-out than any
other faction's — all three Heists, the Breakaway Team, the full recruitment chain (§11.11) — and can be
played directly against Red Queen as a real test of the negotiated-victory arc.

### 12.9 Epoch 9+ — The remaining six factions
Each subsequent faction epoch is **implementation *and* design together**, not implementation alone — five of
the six remaining factions still need their full negotiated-victory arc designed to the depth the Gamer's
already has (deliberately deferred post-v1.0 scope, confirmed earlier). Each gets that full design pass as
part of its epoch, tested against Red Queen the same way the Gamer was.

### 12.10 The Balance Sandbox concept  *(the shared idea underlying Epochs 1–5, not a separate milestone)*

**Dual purpose, unchanged:** a **dev tuning tool** (spawn scenarios, watch them resolve, adjust values based on
feel) *and* a **player-facing feature in the released game**, analogous to Terra Invicta's ship-combat
simulator — players can experiment with strategies and compositions outside a live campaign and discover the
same insights the dev does. **Runs on the real engine core** — not a throwaway prototype; every adjustment made
here carries directly into the shipped game.

**Devtools panel, grouped by function** (the concrete form the dev tools listed epoch-by-epoch above take
together): **World** (regions, stats, buildings, popularity/control), **Agent** (spawn, attributes/traits,
missions, TF attachment), **Military** (platform designer, TF composition, forced combat), **Time** (advance
Pulses/Ticks with a **resolution log** — what happened and why, each tick — the same legibility principle
combat itself already demands, §8.5.1: if you can't see why a fight went the way it did, you can't tune it,
and neither can a player experimenting alone).

**Priority systems to stress-test first** (most abstract math, least intuitive on paper, most likely to feel
wrong in practice despite being internally consistent): the **piercing-vs-armor curve** (§8.6); the
**saturation/value-exchange model** behind "quantity has a quality of its own" (§8.5.1); **domain-control
gating** of fires (§8.5); the **shock/counterattack posture RPS** (§8.6.2, §8.6's Counterattack rule).
Cross-system interaction tests matter as much as single-system ones — e.g. an agent attached to a TF for a
combat bonus vs. that same agent running an instability-generating mission while two other TFs fight nearby.

**Still genuinely open — dev-full-access vs. a curated player experience.** Terra Invicta's ship simulator is
*curated*: design a ship, test it against sample enemies — not "spawn an arbitrary planet with hand-edited
stats." The full devtools panel above is almost certainly **dev-only**; the player-facing version likely wants
a **scoped-down subset** — compose a TF or mission loadout and test it against preset or player-chosen
opposition, without exposing raw world-editing. *(Still needs a call: same tool with a permissions split, or
two genuinely different UIs sharing the same underlying engine calls?)*

## 13. Open Decisions
- Tech stack / engine (leaning TypeScript + React browser stack; Godot possible later).
- Intel sub-decisions (see §3).
- Agent trait list & mission-type catalog.

## 14. Character & Lore Reference
Full cast, AI entities, timeline available from the trilogy Style Sheet + Timeline. Pull targeted
excerpts per system rather than loading whole novels.
