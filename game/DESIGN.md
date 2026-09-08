# FRACTURA — Reforge the Shattered Isles
### Game Design Document · v0.1 (LogiCSmith Games)

> **One line:** A co-op sandbox puzzle-adventure where *building the world* **is** *drawing the bar model*.
> The heuristics PSLE students forget become gear they equip; the formulas they can't recall become crafting recipes they discover.

---

## 0. The design bet (read this first)

Every "maths game" that fails does the same thing: it takes a quiz, puts a skin on it, and pays the student for speed.
That trains recall under pressure. PSLE students don't lose marks on recall — they lose them at **the modelling step**:
reading a heuristic question, not knowing *which* method applies, and not being able to *draw the picture*.

So the mechanic we make fun must be the mechanic that is failing in the exam:

| Exam skill that fails | Game verb that trains it | Where it's borrowed from |
| --- | --- | --- |
| Drawing a bar model | **Building** with unit blocks that snap into bars | Minecraft building · Zelda TOTK *Ultrahand* |
| Choosing the right heuristic | **Equipping the right gear** for a Rift (Time Shard, Rewind Lens, Echo Scanner…) | Fortnite loadouts · Zelda tools |
| Remembering a formula | **Crafting recipes** discovered by experiment, kept "hot" by re-use | Minecraft crafting table |
| Multi-step 5-mark questions | **Boss fights** with one phase per sub-step | Any AAA boss design |
| Explaining working | **Co-op Rifts** where each squadmate holds half the info | Fortnite squads · Keep Talking & Nobody Explodes |
| Posing/recognising problem types | **Creator Mode** — students build Rifts for friends | Roblox Studio · Fortnite Creative |

The transfer trick — the thing that makes grades move — is the **Decode card**: every time a player reforges something,
the game flips the card and shows the exact PSLE word problem they just solved, next to their own model.
"That bridge you just built? That was 2019 PSLE Q14." Over time the scaffold fades (see §5) until the player is
solving exam wording first and *choosing* to build the model because it's the fastest way through.

---

## 1. Genre decision

**Co-op sandbox puzzle-adventure with a seasonal live-service wrapper.**

Why not the alternatives:
- **Runner / shooter "answer to fire"** — rewards speed, punishes thinking, trains nothing modellable.
- **Pure RPG with quiz battles** — the maths is a toll gate, not the play. Kids learn to hate the gate.
- **Idle / gacha** — parents (rightly) hate it; nothing transfers.
- **Sandbox + puzzle rooms** — the *only* genre where the fun verb (build, tinker, arrange) is literally the exam verb (model, split, compare).

Reference stack: Minecraft (blocks, crafting, creative), Zelda: Tears of the Kingdom (shrine puzzles solved by building),
Fortnite (seasons, squads, live events, cosmetic economy), Roblox (creator tools, social hub, avatars), Portal 2 co-op
(asymmetric two-player puzzles), Duolingo (streaks, spaced repetition — hidden inside the fiction).

---

## 2. World & fiction

**Fractura** was a whole world until the **Nulls** — beings of zero, the blank answer — shattered it into unequal parts.
Islands hang in the sky broken into *units*. Bridges are missing segments. Golems hold uneven shares of crystals.
Every broken thing is a comparison, a difference, a before-and-after.

The player is a **Forgeling**, apprentice to the Smiths (LogiCSmith brand tie-in), wearing the **Forge Gauntlet**:
pull *Units* out of the world, stack them into bars, split them, compare them — and when the model holds, the world
reforges in a burst of ember light.

The Nulls never say "wrong". They say "not yet". Nothing in Fractura punishes a wrong answer with loss; it just doesn't
reforge until the picture is true.

---

## 3. Core loop (moment-to-moment, ~3 minutes)

1. **Explore** a low-poly voxel island in third person (Minecraft/Roblox visual register — chunky, bright, readable).
2. **Find a Rift** — a broken thing. The scene *shows* the relationship visually
   (a gold chest visibly overflowing vs. a silver one; "×3" glyph floating between them; "48" on the gate).
3. **Forge Mode** (time slows like Fortnite build mode). Pull unit blocks, snap them into bars, attach known values to
   brackets and pieces. Gear abilities are the heuristics (see §4).
4. **Reforge** — if the model is consistent the structure locks and glows; then the *numbers* phase:
   "1 unit = ?", "3 units = ?". Hints are free, cosmetics are not: hint use lowers the Flawless bonus, never blocks progress.
5. **Decode card** — game framing ↔ exam wording, side by side, with the model working written the PSLE way.
   Card goes into the Codex. XP, Forge Coins, mastery tick.
6. **Loot & cosmetics** — gauntlet skins, emotes, island décor. Earned only by solving. Never sold for time-skips.

---

## 4. Heuristics as gear (the loadout)

Each PSLE heuristic is a tool with a *feel*. Matching tool to Rift is the meta-skill ("which method?") students lack most.

| Gear | Heuristic | What it does in the world | Isle (Season 1) |
| --- | --- | --- | --- |
| **Forge Gauntlet** | Model drawing — comparison (× as many) | Stack equal unit blocks into bars | Comparison Coast |
| **Gap Gauge** | More-than / less-than, excess & shortage | A measuring beam that snaps an "extra" piece onto a bar | Gap Gorge |
| **Time Shard** | Before–After (constant total / constant difference / constant part) | Freeze two snapshots of a scene and overlay them | Tidewell Harbour |
| **Split Chisel** | Units & parts, fraction of remainder | Cleave a bar into equal parts, then cleave the remainder again | Splitshard Caverns |
| **Echo Scanner** | Supposition / guess & check / systematic listing | Dial a guess, hear the echo ("too low"), the scan log *is* the G&C table | Echo Fields |
| **Rewind Lens** | Working backwards | Scrub a scene's timeline in reverse; each undo is an inverse operation | Rewind Ruins |
| **Pattern Loom** | Patterns, make-a-table, simplify the problem | A grid that grows a sequence row by row | Loom Heights (S2) |
| **Forge Bench** | Formulas — area, perimeter, volume, circles, angles, speed, average | Crafting grid: correct ingredients → blueprint learned | The Great Forge |

Design rules:
- Gear is **earned in its isle** by the first tutorial Rift, then usable everywhere. Later isles mix Rifts so choosing gear matters.
- Every Rift is tagged with heuristic, MOE strand, PSLE mark weight (1–5) and difficulty tier. The tag is what the Ledger reads.
- **Bosses** (Null Titans) are 4–5-mark multi-heuristic questions. Each boss phase = one sub-step; the HP bar is the unknown.

---

## 5. The transfer ladder (why grades will move)

Scaffolding fades per heuristic, driven by mastery, never by calendar:

| Rung | Mode | Trigger |
| --- | --- | --- |
| 1 | **Scene-first** — see the world, build, then Decode | default |
| 2 | **Blueprint-first** — exam wording shown *first*; player must build the model before the scene renders | mastery ≥ 50 %, every 3rd Rift |
| 3 | **Paper Bridge** — weekly 20-min Exam Sim in pure PSLE format; player photographs paper working (LogiCSmith tutor marks method, not just answer) | unlocks at rung 2 in 3+ isles |
| 4 | **Creator** — player *poses* a Rift of that type for a friend (Roblox-style); posing is the deepest encoding | mastery ≥ 75 % |

Spaced repetition is disguised as **"keep the forge hot"**: Blueprints dim if not re-forged (1 → 3 → 7 → 14 days);
dim isles show a 🔁 marker and pay double coins. That is Anki, wearing a helmet.

---

## 6. Progression & retention (Fortnite / Roblox layer)

- **Seasons** aligned to Singapore school terms (10 weeks). Each season = a curriculum arc + story arc + new isle + new gear.
  Season 1 (P5/P6 core heuristics) → Season 2 (patterns, speed, percentage, angles) → Season 3 (PSLE full mix, Boss Rush).
- **Forge Pass**: free track + premium track (cosmetics only). Progress is XP from solving — you cannot buy tiers.
- **Daily Storm**: 5 mixed Rifts, due-for-review isles first. **Streaks** with a one-day "Ember Shield" repair.
- **Squads (2–4)**: co-op Rifts where information is split across players (one sees the "×3", one sees the "48").
  Communication is *constrained*: a Fortnite-style ping wheel of maths phrases ("that's 1 unit", "total goes here"),
  plus optional voice for verified classmates only. No open text chat.
- **Forge League**: ranked ladder Bronze → Smith Master, seasonal reset. Two queues: *Precision* (accuracy) and *Blitz*
  (speed, only unlocked once precision rank ≥ Gold — speed is a reward for mastery, not a substitute).
- **Island Home**: base-building with décor bought with Forge Coins (Adopt Me / Bloxburg pull). Showcase decoded cards as trophies.
- **Live events**: end-of-season Null Titan raid — whole server co-op on a giant multi-step problem.
- **Creator Mode**: templated Rift builder (choose heuristic → set numbers → write the story). Published Rifts are
  auto-verified (the engine solves them) and rated by friends. Best community Rifts get featured on the map each week.

---

## 7. The parent side — the Forge Ledger

Parents don't buy fun; they buy *evidence*. The Ledger is the product for them.

- **Mastery map** of the PSLE Maths syllabus by strand *and* by heuristic — the same tags the exam setters use.
- **Independence score** per heuristic: solved cleanly / with hints / with errors. Hints are visible, not hidden.
- **Exam-format performance**: Blueprint-first and Paper Bridge results tracked separately from scene-first play,
  so parents see performance *on exam wording*, not just in-game.
- **Predicted Achievement Level (AL1–AL8)** with a confidence range and a trend line. *Honesty rule:* the prototype's
  band is an uncalibrated placeholder; production calibrates it against Paper Bridge results and, with consent,
  real school test scores. We show parents the calibration data, not marketing.
- **Weekly digest** (WhatsApp/email): "Amir mastered Before–After this week. Independence on Units & Parts: 40 % → 70 %.
  Predicted band AL5 → AL4." One screen, one graph.
- **Controls**: play-time caps, school-night schedules, "Homework Mode" (photograph a worksheet question → it becomes a
  Rift; hints come from the LogiCSmith Claude tutor, guide-don't-give).
- **Trust posture**: no ads, no loot boxes, no pay-to-skip, no open chat, PDPA-compliant, data export & delete in one tap.
- **The pledge**: if the Ledger's exam-format score hasn't risen after 8 weeks of ≥ 3 sessions/week, the next month is free.

### How we prove the linear relationship
1. Every Rift is mapped to a PSLE question type and mark weight → in-game data is exam-shaped from day one.
2. Weekly Paper Bridge = an actual mini-paper. Its score is the dependent variable parents care about.
3. Pilot with 2–3 tuition centres: pre/post test (same paper family), treatment vs. matched control, 8 weeks.
4. Publish the effect size in the Ledger's "Why this works" page. Parents can read it, teachers can check it.

---

## 8. Safety & ethics (ages 9–12)
- Nicknames only, no last names; avatars not photos. Friend codes, not search. Squads default to classmates only.
- All social text is from a curated phrase set. Voice only between mutually verified accounts, parent-toggleable.
- Wrong answers never cost anything the player owns. The only "loss" is the Flawless bonus.
- Sessions nudge a break at 30 min; hard cap configurable by the parent (default 45 min school nights).

---

## 9. Monetisation
- **Family subscription** (S$ 12–18 / month) — includes the Ledger, Paper Bridge marking, Homework Mode.
- **Forge Pass** cosmetics (optional, seasonal) — never affects progress or the Ledger.
- **Tuition-centre licence** — class dashboards, assignable isles, cohort reports.
- No ads. No loot boxes. No consumables.

---

## 10. Season 1 content plan (PSLE heuristics → isles)

Comparison Coast (comparison models) · Gap Gorge (more/less than, excess–shortage) · Tidewell Harbour (before–after:
constant total, constant difference, constant part) · Splitshard Caverns (units & parts, fraction of remainder,
equal fractions) · Echo Fields (supposition, guess & check, make a list) · Rewind Ruins (working backwards) ·
The Great Forge (area/perimeter incl. composite figures, circles, volume, angles) · **Boss:** the Null Titan of
Tidewell (4-step before–after + ratio, 5 marks).

Each isle: 1 tutorial Rift (teaches the gear), ~12 procedurally generated Rift families × 3 tiers, 1 mini-boss.
Procedural generation is a design pillar: numbers are never memorised, structure is.

---

## 11. Technical direction
- **Prototype (this repo, `game/`)**: vanilla JS, no build step, runs on GitHub Pages. The engine layer
  (`engine/problems.js`, `engine/model.js`, `engine/mastery.js`) is engine-agnostic and is the reusable asset.
- **Production**: Godot 4 (free, exports to web + iOS + Android, GDScript is beginner-readable) *or* Unity if
  the team already has it. Multiplayer: authoritative lightweight server (Nakama or Colyseus). Backend: Supabase/Postgres
  for accounts, Ledger, Rift telemetry. Rift generators and validators are ported 1:1 from the JS engine and
  shared between client and server (server re-validates every solve → cheat-proof Ledger).
- **AI**: the LogiCSmith Claude tutor (already in this repo) powers Homework Mode hints and Paper Bridge marking
  via the existing worker proxy — same "guide, don't give" prompt.

---

## 12. KPIs
- D1 / D7 / D30 retention (targets 55 / 30 / 15 %) · median session 18 min · Rifts per session ≥ 6.
- **Learning**: Blueprint-first clean-solve rate per heuristic ↑ week over week; Paper Bridge score slope > 0 for ≥ 70 % of active players.
- **Parent**: Ledger weekly open rate ≥ 60 %; subscription churn < 5 %/month.

---

## 13. Milestones
| # | Milestone | Proves |
| --- | --- | --- |
| M0 | **Forge Mode vertical slice** (this prototype, 7 Rift types, Decode, Ledger) | The core verb is fun and exam-shaped |
| M1 | One 3D isle (Comparison Coast) in Godot/Unity, gauntlet building, 12 Rifts, first boss | The fantasy holds in 3D |
| M2 | Accounts, server-validated solves, Ledger v1, weekly digest | Parents can see evidence |
| M3 | Squads co-op Rifts, ping wheel, Daily Storm, streaks | Retention loop |
| M4 | Paper Bridge + Homework Mode (Claude tutor) | Transfer to exam format |
| M5 | Creator Mode, Forge League, Season 1 launch, tuition-centre pilot | Growth + proof study |
