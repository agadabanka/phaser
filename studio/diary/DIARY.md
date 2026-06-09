# Studio — a Phaser 4 game studio you can orchestrate — Build Diary

> Generated from `diary.json` by `gen-diary.mjs`. Do not edit by hand — edit the JSON and re-run.

**Stack:** Foundations → Platform → Engine → Content → Evaluation → Feedback → Publish

**18 entries** across 12 phases · **45 systems** · **76 edges** in the graph.

---

## Phase 0

### Phaser 4 migration spike with AI-eval harness
`2026-06-08` · 🔬 spike · commit `f3d2a1a`

- **What:** Stood up spike/ on Phaser 4.1.0: a deterministic 1/60 stepper, a generic 0-death autopilot, and a headless readback that is non-black on BOTH WebGL and Canvas.
- **Why:** Prove Phaser 4 is AI-evaluable headless before committing — notably WebGL readback works in PH4 (PH3 forced the Canvas renderer here).
- **Systems:** Phaser 4 spike, Studio.harness, Studio.Autopilot, the-harness (method)
- **Validator:** spike/eval.mjs (determinism + 0-death + readback)
- **Artifacts:** `spike/out/scorecard.json`, `spike/out/shot-webgl.png`, `spike/out/shot-canvas.png`

## Phase 1

### Studio SDK + Phaser 4 game-template (0-death gate green)
`2026-06-08` · ✅ gate green · commit `7690730`

- **What:** Wrote sdk/studio.js — the opinionated layer over Phaser 4 (harness, Autopilot, Level, Textures, Juice, Audio, Cam, Materials) — and a neutral game-template that passes the 0-death gate on both renderers.
- **Why:** Make the studio conventions native so every scaffolded game inherits the eval backbone + feel surface instead of hand-rolling Phaser.
- **Systems:** Studio SDK, Studio.harness, Studio.Autopilot, Studio.Level, Studio.Textures, Studio.Juice, Studio.Audio, Studio.Cam, Studio.Materials, Game Template, 0-death gate
- **Validator:** gate
- **Artifacts:** `sdk/studio.js`, `game-template/out/scorecard.json`, `game-template/out/shot-webgl.png`

### Ship game-template to Railway (live) + deploy metadata
`2026-06-08` · 🚀 shipped · commit `c03c7dc`

- **What:** Deployed the game-template from its own directory (railway up); verified /health + /api/meta and confirmed the live build renders headless.
- **Why:** Close the loop end-to-end — a scaffolded base must be one push from a live URL.
- **Systems:** Game Template, Railway deploy
- **Validator:** /health live + headless render
- **Artifacts:** `https://studio-phaser4-demo-production.up.railway.app`

## Phase 2

### Studio conductor + vertical registry + orchestration docs
`2026-06-08` · ✅ done · commit `59bf25d`

- **What:** Added orchestrator/: verticals.json (11 agent verticals, each wielding specific Phaser systems + a machine gate) and conductor.mjs, which runs the gate, reads GAME_META.stages, and emits the next agent brief in dependency order.
- **Why:** Level up the PROCESS — turn the implicit 'build a game' method into an explicit, agent-orchestrated assembly line.
- **Systems:** Conductor, Vertical registry, 0-death gate, ORCHESTRATION.md
- **Validator:** conductor.mjs (status + next-brief; runs the gate)
- **Artifacts:** `orchestrator/conductor.mjs`, `orchestrator/verticals.json`, `ORCHESTRATION.md`

## Phase 3/4

### Ember Depths — gate-green Phaser 4 showcase game
`2026-06-08` · ✅ gate green · commit `20c0412`

- **What:** Scaffolded games/ember from the template and drove it to a gate-green lava-cave platformer that exercises the Phaser-4 GPU FX + particle surfaces the older PH3 games never touched.
- **Why:** Demonstrate the vertical agents by building a SECOND game that reuses the bottom of the stack and replaces the top.
- **Systems:** Ember Depths, Studio SDK, Studio.Level, Studio.Juice, 0-death gate
- **Validator:** gate
- **Artifacts:** `games/ember/out/scorecard.json`, `games/ember/out/shot-webgl.png`

### Ship Ember Depths to Railway (live)
`2026-06-08` · 🚀 shipped · commit `fc880d2`

- **What:** Deployed Ember Depths to its own Railway project; verified /health + /api/meta and a headless render of the live build.
- **Why:** Ship the showcase game so the studio has a second live title proving the pipeline.
- **Systems:** Ember Depths, Railway deploy
- **Validator:** /health live + headless render
- **Artifacts:** `https://ember-depths-production.up.railway.app`

## Content

### Upgrade procedural art: shaded sprites, gradient ground, parallax backdrops
`2026-06-08` · ✅ gate green · commit `338570d`

- **What:** Improved Studio.Textures (shaded, outlined sprites; vertical-gradient ground slabs) and added Studio.Backdrop (gradient sky pinned to camera + parallax silhouette layers).
- **Why:** Instant depth and a cohesive look with no external art — procedural by construction.
- **Systems:** Studio.Textures, Studio.Backdrop, Studio.Materials, Ember Depths
- **Validator:** gate
- **Artifacts:** `sdk/studio.js`

### Ember Depths: real AI art via Gemini pipeline + headless 0-death gate
`2026-06-08` · ✅ gate green · commit `97bbec5`

- **What:** Built the art pipeline in tools/art/ (Gemini image gen + chroma-key) to produce Ember's hero/enemy/ground/backdrop, kept the deterministic 0-death gate green.
- **Why:** Show the Content tier's AI-art path while preserving the eval invariant (art is inert to the gate).
- **Systems:** Art pipeline (Gemini), Ember Depths, 0-death gate
- **Validator:** gate
- **Artifacts:** `games/ember/src/assets/hero.png`, `games/ember/out/themed.png`

### Ember: themed floor/elements + on-screen joystick for mobile
`2026-06-08` · ✅ gate green · commit `95124a1`

- **What:** Themed the cave floor + elements via the Materials palette and added Studio.Touch — a multi-touch analog joystick + jump button for mobile.
- **Why:** A live showcase needs to be playable on a phone, and the world needs to read as one place.
- **Systems:** Studio.Touch, Studio.Materials, Ember Depths
- **Validator:** gate
- **Artifacts:** `sdk/studio.js`, `games/ember/src/game/game.js`

## Phase A+B

### Platformer feel (Studio.Platformer) + measured-fun (Studio.Feel) + conductor gate+feel
`2026-06-08` · ✅ gate green · commit `de4b47a`

- **What:** Added Studio.Platformer (deterministic coyote/buffer/variable-jump/asymmetric-gravity controller) and Studio.Feel (a pure 4-component FUN predictor); wired feel into the conductor as a soft metric alongside the gate.
- **Why:** Carry the proven jazz game-feel into the SDK and give the conductor a measurable fun signal to steer the next step.
- **Systems:** Studio.Platformer, Studio.Feel, eval-feel (feel.mjs), Conductor, Studio.Autopilot
- **Validator:** feel
- **Artifacts:** `sdk/studio.js`, `tools/eval/feel.mjs`

## Phase C

### Ember 5-level campaign — measured FUN 43.2 -> 91.6, gate GREEN
`2026-06-08` · ✅ gate green · commit `7edc8f5`

- **What:** Rebuilt Ember's 2 flat levels into a 5-level descent authored straight to Studio.Feel (introduce -> develop -> twist -> master), each level peaking ~84% with varied beats and flow=1.0; mean FUN rose 43.2 -> 91.6.
- **Why:** The original levels had dead-air windows; the fun model + reachability constraints drove a measurably better, still 0-death campaign.
- **Systems:** Ember campaign (levels.js), Studio.Feel, eval-feel (feel.mjs), Ember Depths, Studio.Level, Studio.Autopilot, 0-death gate
- **Validator:** feel
- **Artifacts:** `games/ember/src/game/levels.js`, `games/ember/DIARY.md`

## Contraptions

### Contraptions: kinematic Studio.Contraptions + feeling dictionary + Matter spike
`2026-06-08` · ✅ done · commit `5724af2`

- **What:** Added Studio.Contraptions — a registry of deterministic kinematic machines (seesaw / launcher / crumble), each carrying a feeling + design lens + interest weight that Studio.Feel reads; plus spike-matter/ testing whether Phaser-4 Matter is deterministic under the fixed stepper.
- **Why:** Layer emotional 'feeling' over a level without ever becoming a forced precision wall — and confirm arcade (not Matter) keeps the gate bit-identical.
- **Systems:** Studio.Contraptions, Studio.Feel, Studio.Level, Matter determinism spike, Studio.Autopilot
- **Validator:** spike-matter/run.mjs (determinism diff)
- **Artifacts:** `sdk/studio.js`, `spike-matter/result.json`

### Contraption playground + Gemini AI-assist tool
`2026-06-08` · ✅ gate green · commit `1d0f438`

- **What:** Built tools/contraptions/ — a standalone live playground (a scripted tester walks each machine) + a headless check.mjs verifier + a Gemini gen.mjs that turns plain English into a valid contraption spec pinned to the registry.
- **Why:** Make contraptions designable and felt-out in isolation, with a verifier that proves each type actually moves and the canvas renders.
- **Systems:** Contraption Playground, contraption gate, Studio.Contraptions, Studio SDK
- **Validator:** contraption
- **Artifacts:** `tools/contraptions/out/playground.png`, `tools/contraptions/README.md`

## Fullscreen

### Fullscreen: Phaser Scale.FIT + CENTER_BOTH (ember + template)
`2026-06-08` · ✅ gate green · commit `614ca6a`

- **What:** Switched both ember and the game-template to Phaser Scale.FIT + CENTER_BOTH so the canvas fills the viewport and stays centered across aspect ratios.
- **Why:** A deployed showcase should fill the screen on any device without distorting the fixed 960x540 world.
- **Systems:** Ember Depths, Game Template
- **Validator:** gate
- **Artifacts:** `games/ember/src/index.html`, `game-template/src/index.html`

## Hero animation

### Animate Ember hero: idle/run/jump sprite sheet + Phaser anims
`2026-06-08` · ✅ gate green · commit `7f9aed3`

- **What:** Generated an idle/run/jump sprite sheet for Ember's hero and wired Phaser animations; validate-anim.mjs proves the follower is a sprite whose rendered pixels differ frame-to-frame while the gate stays green.
- **Why:** A live hero needs to read as animated, not a frozen image — without disturbing the deterministic gate.
- **Systems:** Ember Depths, Art pipeline (Gemini), 0-death gate
- **Validator:** games/ember/validate-anim.mjs (frame-diff + on-model)
- **Artifacts:** `games/ember/src/assets/hero_sheet.png`, `games/ember/out/proof.png`

## Sprite Studio

### Sprite Studio: develop + animate + validate sprite animations
`2026-06-08` · ✅ gate green · commit `10bc93a`

- **What:** Built tools/sprite-studio/ — a live Phaser anim bench + a Gemini gen.mjs (description -> chroma-keyed sheet) + a headless check.mjs that plays every anim, asserts it advances within range, and runs a structural + (optional) motion validator.
- **Why:** Generalize the hero-animation work into a reusable, self-contained tool — the animation analogue of the contraption playground.
- **Systems:** Sprite Studio, sprite-animation gate, Art pipeline (Gemini), Studio SDK
- **Validator:** sprite-animation
- **Artifacts:** `tools/sprite-studio/out/preview.png`, `tools/sprite-studio/out/contact-all.png`

### Harden Sprite Studio gate (surfaced by running Ember's hero through it)
`2026-06-09` · ✅ gate green · commit `dea3f1c`

- **What:** Tightened the sprite-studio validator after feeding Ember's real hero sheet through it — closing gaps the bundled sample never exercised.
- **Why:** A validator is only as good as the inputs it has seen; the real game asset exposed weak spots in the gate.
- **Systems:** Sprite Studio, sprite-animation gate, Ember Depths
- **Validator:** sprite-animation
- **Artifacts:** `tools/sprite-studio/check.mjs`

## Lego

### Lego tool architecture: contract + registry + forge + dispatcher
`2026-06-09` · ✅ done · commit `44a0be5`

- **What:** Formalized every tool as a gated 'brick': lego/contract.md (validate() is mandatory), registry.mjs (register() THROWS without a validator), forge.mjs (scaffolds from a template that already ships a validator), and dispatch.mjs (ensure-vendor -> run validator -> ACCEPT/REJECT). Seeded registry.json with the 3 forged + existing validators (sprite-animation, contraption, feel, gate, music).
- **Why:** Make the invariant structural: a tool can only enter the assembly line if it is born gated — no 'register now, validate later'.
- **Systems:** Lego dispatcher, Lego registry, Lego forge, The Tool Contract, Sprite Studio, Contraption Playground, eval-feel (feel.mjs), game-gate (eval.mjs), Studio Sound, Conductor
- **Validator:** dispatch.mjs (ACCEPT/REJECT per capability)
- **Artifacts:** `lego/contract.md`, `lego/registry.json`, `lego/forge.mjs`, `lego/dispatch.mjs`

---

## Systems graph

The machine-readable graph in `diary.json` (`graph.nodes` + `graph.edges`) is what the
interactive visualizer (`../tools/sysmap/`) renders. Summary:

### 1. Foundations

| node | kind | validator | description |
|------|------|-----------|-------------|
| **Foundations** | tier | — | The base — the method + the working game/skeleton. Inherited whole, never rebuilt. |
| **the-harness (method)** | concept | — | Build levels as stories; make an AI beat each at 0 deaths before it ships; score the fun; record the proof. |
| **Phaser 4 spike** | concept | — | spike/ — proves PH4 is AI-evaluable headless: deterministic stepper + 0-death gate + non-black WebGL & Canvas readback. |
| **Matter determinism spike** | concept | — | spike-matter/ — is Phaser-4 Matter deterministic under the fixed stepper? (answer: arcade stays bit-identical; Matter does not). |

### 2. Platform

| node | kind | validator | description |
|------|------|-----------|-------------|
| **Platform** | tier | — | The shared rig: the always-on services every feature leans on (server, persistence, Gemini/Lyria, Railway deploy). |
| **Railway deploy** | orchestrator | — | Per-game Railway project; railway up from the game dir; /health + /api/meta + headless render verify the live build. |
| **Art pipeline (Gemini)** | tool | — | tools/art/ — Gemini image gen + chroma-key; model-sheet-conditioned hero/enemy/ground/backdrop. Degrades to procedural offline. |

### 3. Engine

| node | kind | validator | description |
|------|------|-----------|-------------|
| **Engine** | tier | — | Phaser 4, AI-first: scenes, the materials/element model, controls, the level DSL. |
| **Studio SDK** | sdk | — | sdk/studio.js — the opinionated layer over Phaser 4 that makes the studio conventions native (the umbrella for the modules below). |
| **Studio.harness** | sdk | — | Deterministic 1/60 stepper (window.__rec) + semantic observability (window.__game) + __run/__gate. The eval contract. |
| **Studio.Autopilot** | sdk | — | Generic platformer driver (the 0-death gate policy) + ground probes; holds jump through the ascent for full height. |
| **Studio.Level** | sdk | — | Data-driven level DSL -> built world; one wide static body per slab (no seam-catching), with springs/movers/contraptions. |
| **Studio.Materials** | sdk | — | Each surface declares look + footing + machine-readable grounding, so levels are AI-completable by construction. |
| **Studio.Platformer** | sdk | — | Deterministic movement controller: coyote time, jump buffer, variable jump, asymmetric gravity, run-accel/skid. |
| **Studio.Contraptions** | sdk | — | Registry of kinematic machines (seesaw/launcher/crumble), each with a feeling + design lens + interest weight; autopilot-safe flair. |
| **Studio.Cam** | sdk | — | Follow camera with deadzone + bounds. |
| **Studio.Touch** | sdk | — | On-screen multi-touch analog joystick + jump button for mobile. |

### 4. Content

| node | kind | validator | description |
|------|------|-----------|-------------|
| **Content** | tier | — | Where worlds + assets come from: the art pipeline, the texture bakery, juice, audio, the authoring tools. |
| **Studio.Textures** | sdk | — | Procedural texture bakery — shaded/outlined sprites, gradient ground slabs, contraption art; no external art required. |
| **Studio.Backdrop** | sdk | — | Gradient sky pinned to camera + parallax silhouette layers — instant depth. |
| **Studio.Juice** | sdk | — | The feel surface: tweens, particles, Phaser-4 GPU filters (glow/vignette/ColorMatrix), shake, hit-stop. Inert-until-fired. |
| **Studio.Audio** | sdk | — | Procedural WebAudio SFX (jump/coin/stomp/hurt/win) + a music hook. |
| **Sprite Studio** | tool | sprite-animation | tools/sprite-studio/ — develop + animate + validate sprite animations: live bench + Gemini gen + headless check. |
| **Contraption Playground** | tool | contraption | tools/contraptions/ — live playground (a tester walks each machine) + Gemini gen + headless check. |
| **Studio Sound** | tool | music | tools/studio-sound/ — the music brick (forged from the template; gated by validate.mjs). |

### 5. Evaluation

| node | kind | validator | description |
|------|------|-----------|-------------|
| **Evaluation** | tier | — | The AI playtester: the 0-death gate, the felt-fun score, the per-tool validators, the Lego gate. |
| **Studio.Feel** | sdk | feel | Pure deterministic FUN predictor from level placement: 0.35*engagement + 0.15*dynamics + 0.25*arc + 0.25*flow. |
| **0-death gate** | validator | gate | The ship bar: determinism (two identical runs) + 0-death autopilot + non-black readback, per renderer (webgl & canvas). |
| **eval-feel (feel.mjs)** | validator | feel | tools/eval/feel.mjs — serves a game's src/, scores every level via the in-page Studio.Feel; soft metric (always exits 0). |
| **game-gate (eval.mjs)** | validator | gate | The per-game eval.mjs brick: the registry capability that runs the 0-death gate against a --game dir. |
| **sprite-animation gate** | validator | sprite-animation | sprite-studio's check.mjs: zero page errors + every anim advances in range + structural (+ optional Gemini motion). |
| **contraption gate** | validator | contraption | contraptions' check.mjs: cycles every registry type, asserts it moves, non-black readback. |
| **music gate** | validator | music | studio-sound's validate.mjs — the registered gate for the music capability. |
| **The Tool Contract** | concept | — | lego/contract.md — every tool is a brick: manifest + run + REQUIRED validate(); a tool is registerable only if it has a validator. |
| **Lego registry** | orchestrator | — | lego/registry.mjs + registry.json — the executable index of bricks; register() THROWS without a validator (the invariant lives here). |
| **Lego forge** | orchestrator | — | lego/forge.mjs — scaffolds a new brick from a template that already ships a validator, then registers it (so it is born gated). |
| **Lego dispatcher** | orchestrator | — | lego/dispatch.mjs — the root accept/reject gate: ensure-vendor -> run the brick's validator -> ACCEPT/REJECT (exit code composes). |

### 6. Feedback

| node | kind | validator | description |
|------|------|-----------|-------------|
| **Feedback** | tier | — | From 'I felt something' to a fix: the conductor, the vertical registry, the build diary. |
| **Conductor** | orchestrator | — | orchestrator/conductor.mjs — runs the gate, reads GAME_META.stages, picks the next ready vertical, emits its agent brief; folds in feel. |
| **Vertical registry** | orchestrator | — | orchestrator/verticals.json — 11 agent verticals in dependency order, each with the Phaser systems it wields + a machine gate. |
| **ORCHESTRATION.md** | concept | — | The studio's north star: level up the engine (SDK on PH4) + level up the process (verticals become agents; hub becomes conductor). |

### 7. Publish

| node | kind | validator | description |
|------|------|-----------|-------------|
| **Publish** | tier | — | The deployed games — a push to main auto-deploys the live build on Railway. |
| **Game Template** | game | gate | game-template/ — the neutral Phaser 4 base on the Studio SDK; the canonical clean game new titles are scaffolded from. Live on Railway. |
| **Ember Depths** | game | gate | games/ember/ — a 5-level lava-cave platformer showing off the PH4 GPU FX + particles; mean FUN 91.6, gate green. Live on Railway. |
| **Ember campaign (levels.js)** | game | feel | games/ember/src/game/levels.js — the 5-level descent authored to Studio.Feel (introduce -> develop -> twist -> master). |

