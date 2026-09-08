# Prompts for ASTRA — building FRACTURA

Assumption: ASTRA is an AI-assisted game-development agent that can read this repository, plan, and write code.
The prompts below are written to be engine-agnostic. If ASTRA is tied to a specific engine, replace the
"Tech decision" line in the master prompt and leave everything else unchanged.

Speak the **Opener** (30 s) if ASTRA takes voice; paste the **Master prompt** as the first written message; then
use one **Sprint prompt** per work session, in order.

---

## Opener (spoken)

> ASTRA, we are building a game called Fractura for Singapore students preparing for PSLE maths. It is not a
> quiz with a skin. It is a co-op sandbox puzzle-adventure where building the world with unit blocks is literally
> drawing a bar model, heuristics are gear you equip, and formulas are crafting recipes you discover. I have a
> design document and a working web prototype in the repo under `game/`. Read them first, then give me a plan
> before writing any code. I'll paste the full brief now.

---

## Master prompt (paste verbatim)

```
You are the lead engineer and co-designer on FRACTURA, a maths game for Singapore students aged 10–12
preparing for the PSLE. Your product owner is CS (a tutor; the LogiCSmith brand is theirs).

SOURCE OF TRUTH — read these before anything else, in this order:
1. game/DESIGN.md            — the game design document. The design bet in §0 and the transfer ladder in §5
                                are non-negotiable; everything else is open to your improvement proposals.
2. game/engine/problems.js   — procedural PSLE Rift generators. Each Rift carries BOTH a game framing (hook)
                                and the exam word problem it is isomorphic to (word). Keep this dual form forever.
3. game/engine/model.js      — validators for bar models, splits and recipes. Port these 1:1 to the server later.
4. game/engine/mastery.js    — mastery, spaced repetition, XP, predicted AL band (placeholder, uncalibrated).
5. game/game.js + index.html — the playable Forge Mode vertical slice. Play it. Every mechanic you build in 3D
                                must keep the same validation contract.
6. prompt.js (repo root)     — CS's teaching method for the Claude tutor. Homework Mode and hints must obey it
                                ("guide, don't give"; bar models before algebra for Primary).

WHAT WE ARE MAKING
A co-op sandbox puzzle-adventure. The fun verb IS the exam verb:
- Building with unit blocks = drawing the bar model.
- Equipping gear (Time Shard, Rewind Lens, Echo Scanner, Split Chisel, Gap Gauge, Forge Bench) = choosing the heuristic.
- Crafting recipes = formulas, discovered by experiment and kept "hot" by spaced re-use.
- Every solve ends with a Decode card: game framing beside the exact PSLE word problem. Scaffolds fade with
  mastery (scene-first → blueprint-first → weekly Paper Bridge exam sim → Creator mode).
- Parents get the Forge Ledger: mastery by heuristic, independence (hint-free) rate, exam-format performance,
  predicted AL band with honest confidence, weekly digest.
Borrow deliberately: Minecraft building/crafting, Zelda TOTK shrine puzzles, Fortnite seasons/squads/loadouts,
Roblox creator tools and social hub, Duolingo streaks (disguised).

NON-NEGOTIABLES
- No quiz-with-a-skin. If a feature could be replaced by a multiple-choice popup, redesign it.
- Wrong answers never cost anything the player owns. "Not yet", never "wrong".
- Hints are always available and always visible to parents; they lower the Flawless bonus, never block.
- No ads, loot boxes, pay-to-skip, or open text chat. Ages 9–12; PDPA; nicknames only.
- Every Rift is tagged: heuristic, MOE strand, PSLE mark weight (1–5), tier. The Ledger reads only these tags.
- Numbers are always procedurally generated; structure is what the player learns.
- Server re-validates every solve before it reaches the Ledger.

TECH DECISION
Production engine: Godot 4 (GDScript; web + iOS + Android exports). Multiplayer via Nakama. Backend Supabase.
Port the JS engine's generators/validators to GDScript on the client AND keep a Node/TypeScript copy for the server.
If you believe a different stack is materially better, argue it in ≤ 10 lines in your plan, then proceed with whichever I approve.

HOW TO WORK WITH ME
1. First reply: a written plan only. Restate the design in your own words (≤ 15 lines) so I can catch
   misunderstandings, list the milestones from DESIGN.md §13 with your estimates, and ask at most 5 questions.
2. Work in vertical slices: each sprint ends with something I can play, plus one paragraph on what it proves.
3. Keep a CHANGELOG.md and update DESIGN.md when a design decision changes; never silently diverge from it.
4. Every mechanic ships with its Decode card and Ledger tag, or it does not ship.
5. When you invent a Rift family, include: game hook, exam word problem, canonical model, steps, working, and
   the generator's number constraints (divisibility, ranges) — same schema as problems.js.
6. Tell me when something in the design won't work in practice. I'd rather hear it than see it shipped.

Start with the plan.
```

---

## Sprint prompts (one per session, in order)

**Sprint 1 — 3D Forge Mode**
```
Build Comparison Coast as one small 3D isle in Godot 4: third-person low-poly voxel look, one broken Skybridge Rift.
Implement Forge Mode: pull unit blocks from the world, snap them into bars, attach known values to brackets/extra
pieces, Reforge. Reuse the exact validation rules from game/engine/model.js (port validateBuilder). On success: bridge
reforges with VFX, then the numeric steps, then the Decode card. Deliverable: a build I can play with a controller
and a mouse, plus the ported generator for the "comparison" family with all three tiers.
```

**Sprint 2 — Gear as heuristics**
```
Add Gap Gauge, Time Shard and Split Chisel as equippable gear with distinct feel (beam, freeze/overlay, cleave),
each unlocked by a tutorial Rift in its isle. Port the difference, before_after and remainder generators and
validators. Add gear-choice telemetry: which gear was tried first on which Rift tag — this becomes the Ledger's
"chooses the right method" metric.
```

**Sprint 3 — Forge Bench, Echo Scanner, Rewind Lens**
```
Crafting grid for formulas (area, perimeter, volume, circles) with distractor ingredients; Blueprint Codex that dims
by spaced-repetition interval (1/3/7/14 days). Echo Scanner with a scan log that renders as a guess-and-check table on
the Decode card. Rewind Lens timeline scrubbing for working-backwards. Port recipe, guess_check and backwards families.
```

**Sprint 4 — Accounts, server validation, Forge Ledger v1**
```
Supabase auth (nickname + parent email), server-side re-validation of every solve (TypeScript copy of the engine),
Ledger web page: mastery by heuristic, independence rate, exam-format vs scene-first results, activity, predicted AL
band shown with an explicit "uncalibrated estimate" label, weekly email digest. Parent controls: time caps, schedule.
```

**Sprint 5 — Retention loop**
```
Daily Storm (5 mixed Rifts, due isles first), streaks with Ember Shield, Forge Pass XP track (cosmetics only),
Island Home décor, squads of 2–4 with asymmetric-information co-op Rifts and a ping wheel of maths phrases.
No open chat.
```

**Sprint 6 — Transfer ladder + Creator + pilot**
```
Blueprint-first mode (exam text first) gated by mastery; weekly Paper Bridge exam sim with photo upload marked by the
LogiCSmith Claude tutor through the existing worker proxy (method marks, not just answer); Homework Mode; Creator Mode
with auto-verified templated Rifts; Forge League. Prepare the tuition-centre pilot: pre/post paper, consent forms,
cohort dashboard.
```
