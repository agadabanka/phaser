# Studio — a Phaser 4 game studio you can orchestrate — Build Diary

> Generated from `diary.json` by `gen-diary.mjs`. Do not edit by hand — edit the JSON and re-run.

**Stack:** Foundations → Platform → Engine → Content → Evaluation → Feedback → Publish

**35 entries** across 18 phases · **76 systems** · **163 edges** in the graph.

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

### Self-gating pipeline: art-cohesion + distinctness + sound validators, conductor --validate-all
`2026-06-09` · ✅ gate green · commit `05f742e`

- **What:** Forged/ported 3 judges as registry bricks (studio-art 9-dim cohesion, studio-distinct 6-axis uniqueness, studio-sound SFX wiring) and taught the conductor a --validate-all mode that runs EVERY game-applicable validator through the dispatcher into one scorecard.
- **Why:** One command should answer "is this game good?" across every vertical — and the first full scorecard flagged a real problem (Ember art-cohesion 43.3 REJECT: placeholder tiles vs painterly backdrop).
- **Systems:** Studio Art (cohesion judge), Studio Distinct (uniqueness judge), Studio Sound, Conductor, Lego dispatcher, Lego registry
- **Validator:** conductor --validate-all (scorecard)
- **Artifacts:** `orchestrator/conductor.mjs`, `tools/studio-art/`, `tools/studio-distinct/`

### Sysmap deployed: the diary is a live, clickable system map
`2026-06-10` · 🚀 shipped · commit `603b32e`

- **What:** Shipped the interactive visualizer to Railway behind a tiny no-dep static server (root redirects to /tools/sysmap/ so relative fetches of diary.json + registry.json resolve).
- **Why:** A diagram you can open beats one you must build: every future diary entry/node appears on the live map on redeploy.
- **Systems:** Sysmap (interactive visualizer), Studio Diary (diary.json), Lego registry, Railway deploy
- **Validator:** headless render check (45 nodes / 76 edges, zero console errors)
- **Artifacts:** `https://studio-sysmap-production.up.railway.app`, `sysmap-serve.mjs`

## Polish

### texture-kit: the missing GENERATOR brick for the texturing capability
`2026-06-10` · ✅ gate green

- **What:** Gap analysis against the scorecard found we could JUDGE art cohesion but not PRODUCE cohesive art. Forged texture-kit: Gemini generates material tiles (stone/mud/ice/lava) + pickups (coin/spring/goal) with the game's own backdrop as style-ref; a 2×2 mirror quilt makes every tile seamless BY CONSTRUCTION; the deterministic validator measures seams (<8/255), texture energy, palette affinity vs the backdrop (hue-histogram cosine), and sprite keying. Ember's kit: 19/19 checks, 100.
- **Why:** The art-cohesion judge kept rejecting placeholder foreground tiles — the assembly line was missing the brick that closes that loop.
- **Systems:** Texture Kit (style-matched tiles), Lego forge, Lego registry, Lego dispatcher, Art pipeline (Gemini), Studio.Backdrop
- **Validator:** texturing (node validate.mjs --game games/ember → 100)
- **Artifacts:** `tools/texture-kit/`, `games/ember/src/assets/kit/`, `tools/texture-kit/out/contact.png`

### Ember polish pass: 43.3 REJECT → 6/6 ACCEPT (art-cohesion 77.8)
`2026-06-10` · 🚀 shipped

- **What:** Integrated the kit per-material (mud/ice/stone finally read differently underfoot), switched to LINEAR filtering (pixelArt:true was shredding painterly tiles into pixel noise — the single biggest cohesion killer), added molten rim-lights on every slab, de-synced tile patterns per slab, themed the crumble ledge, hid the touch joystick on non-touch devices and themed it for touch, stroked-serif HUD + level title cards, per-depth backdrop tints, a proc:cave WebAudio ambience bed in the SDK (music 0.9→1.0), outlined the hero/enemy for silhouette, compound late climaxes on L1/L4 (FUN 90.4→90.5, L1 89→89.5), and a victory stop so the won hero no longer runs off the world edge.
- **Why:** Make the flagship actually pass its own studio's full gate — quality measured, not asserted.
- **Systems:** Ember Depths, Texture Kit (style-matched tiles), Studio SDK, Studio.Audio, Studio.Touch, Studio.Juice, Ember campaign (levels.js), Studio.Feel, Studio Art (cohesion judge), Conductor
- **Validator:** conductor --validate-all → 6/6 ACCEPT (gate ✓, feel 90.5, music 1.0, art-cohesion 77.8, distinctness 75, texturing 100)
- **Artifacts:** `games/ember/`, `https://ember-depths-production.up.railway.app`

### Real music: Lyria 2 composed loop replaces the inaudible synth bed
`2026-06-10` · 🚀 shipped

- **What:** The "music 1.0" score was hollow — the bed was a 55Hz procedural synth you could not hear, and the validator only checked a hook existed. Built tools/art/lyria.mjs: Google Lyria 2 (Vertex AI) generates a ~30s instrumental, downmixed to mono, peak-normalized, CROSSFADE-LOOPED into a seamless asset, MP3-encoded (~0.5MB) with a measured {rms,duration,model} sidecar. Ember loads assets/music/cave.mp3 on first gesture (proc synth kept only as offline fallback). Upgraded the music validator to VERIFY the bed: a referenced music file must exist and be provably non-silent or the gate FAILS.
- **Why:** A passing score must mean what it says. "I can't hear any music" was correct — the gate could not tell silence from a song.
- **Systems:** Lyria Music (Vertex), Studio.Audio, Studio Sound, Ember Depths, music gate
- **Validator:** music (composed bed verified: lyria-002, 31.17s, rms 0.0456; playback proven in-browser)
- **Artifacts:** `tools/art/lyria.mjs`, `games/ember/src/assets/music/cave.mp3`, `https://ember-depths-production.up.railway.app`

### Playtest shell: pause + note-taking finally wired to the hub API
`2026-06-10` · 🚀 shipped

- **What:** Every game host has served the hub convention (/api/notes, /api/meta, /api/diary) since scaffold — but no game ever shipped the FRONT END. Built Studio.Shell (SDK): a DOM overlay with pause/resume (freezes the scene, ducks music), a 📝 note-taking panel that auto-pauses, releases the keyboard for typing, POSTs {text + where/level/x/coins/deaths} to /api/notes and lists the latest notes back, plus restart and mute (new Studio.Audio.setMuted reaches all registered beds). Wired into Ember AND the game-template so every future game inherits it.
- **Why:** Playtesting needs margins to write in: a note pinned to the exact depth/position it was felt at is the studio's feedback loop closing.
- **Systems:** Playtest Shell, Studio SDK, Studio.Audio, Ember Depths, Game Template
- **Validator:** browser proof: pause froze frame counter, note round-tripped through /api/notes with context, mute/restart verified; 0-death gate still GREEN (webgl+canvas)
- **Artifacts:** `sdk/studio.js (Studio.Shell)`, `https://ember-depths-production.up.railway.app`

### Sysmap: per-game lens + Flows (the order systems are called)
`2026-06-10` · 🚀 shipped

- **What:** The full map had become a 52-node hairball with no notion of sequence. Added (1) a LENS picker that filters the graph to one game's reachable subgraph (BFS over its depends-on/validated-by/feeds edges — "what does Ember actually use?"), and (2) FLOWS: a new optional diary.json section of curated, ordered walkthroughs the visualizer renders as numbered badges + an animated arrowed path with ◀ ▶ stepping and a per-step caption. Three flows shipped: the runtime frame loop (real update() order), the assembly-line vertical order, and the validate-all dispatch order. SCHEMA.md documents flows; gen-diary.mjs validates step refs and renders a Flows section into DIARY.md.
- **Why:** A static edge set can answer "what connects to what" but never "in what order" — and per-game questions drowned in the all-systems view.
- **Systems:** Sysmap (interactive visualizer), Studio Diary (diary.json), Conductor, Lego dispatcher, Ember Depths
- **Validator:** sysmap check.mjs extended: lensOk (ember subgraph strictly smaller, restores clean) + flowOk (badges == steps, stepping moves idx) — PASS; phone 390x844 verified no-overflow
- **Artifacts:** `tools/sysmap/`, `diary/SCHEMA.md (flows)`, `https://studio-sysmap-production.up.railway.app`

### RFC-001: simplify the engine to one bundle, one CLI, data-only games, notes that feed back
`2026-06-10` · 🚧 wip

- **What:** Architecture review with measurements: a new game owns 853 lines (only ~250 game-specific); studio.js exists in 5 copies (2 stale RIGHT NOW); 5 CLI entry points + 2 overlapping JSONs. Proposed four consolidations: (1) Studio.Game.boot(config) — games shrink to levels+theme+hooks (~80 lines); (2) build Studio INTO phaser-private as dist/phaser-studio.min.js with a stepMode engine flag (the deterministic stepper stops being a monkey-patch); (3) one `studio` CLI absorbing conductor/dispatch/forge/vendor, registry absorbing verticals, rules.json + a level-lint brick making the geometry contract data; (4) a notes-loop brick: pull /api/notes from every deployed game, Gemini-triage to capabilities, surface as backlog in `studio next`, credit closed notes in diary entries — play→note→triage→dispatch→gate→diary, the full circle.
- **Why:** The essential loop is one sentence — clone a game, apply rules, call the right tool, forge when missing, gate everything — and the architecture should be the same size as the sentence. The deterministic gates make the refactor safe: 6/6 ACCEPT is the acceptance test for every migration step.
- **Systems:** RFC-001 Engine Simplification, Studio SDK, Conductor, Lego dispatcher, Lego forge, Lego registry, Playtest Shell, Studio Diary (diary.json), Ember Depths, Game Template
- **Validator:** each migration step gated by conductor --validate-all staying 6/6 on ember + template
- **Artifacts:** `rfc/001-engine-simplification.md`

## Refactor

### RFC-001 implemented: Studio.Game.boot, studio CLI, rules.json + level-lint, notes-loop
`2026-06-10` · 🚀 shipped

- **What:** Executed the engine simplification. Studio.Game.boot(config) turns a game into data+theme+hooks (Ember's 513-line game.js → ~70-line config; one runtime owns world/theme/HUD/shell/autopilot/harness/win-death, runner + vertical archetypes). rules.json makes the geometry contract data; the forged level-lint brick gates levels statically before the browser gate. The studio CLI (new/next/run/lint/gate/feel/check/ship/notes) is the one front door; the registry absorbed verticals.json. The notes-loop brick (pull/triage) closes play→note→dispatch.
- **Why:** The essential loop — clone, apply rules, call the right tool, gate — should be the size of that sentence. The deterministic gates made the rewrite safe (Ember held 6/6 throughout).
- **Systems:** Studio.Game.boot, studio CLI, rules.json + level-lint, notes-loop, Lego registry, Conductor, Ember Depths, Game Template
- **Validator:** Ember --validate-all held ACCEPT across the port

## Game

### Nimbus Climb: a new vertical sky-climber proves the refactor (7/7 ACCEPT)
`2026-06-10` · 🚀 shipped

- **What:** Built a brand-new game in the clouds via boot({archetype:'vertical'}). New SDK verbs: updraft wind-columns (ride up, steer out), cloud/mist/crystal/storm materials, climb-axis Feel scoring, a waypoint-chain vertical autopilot. tools/level-gen/sky.mjs generates the 5 towers reachable-by-construction. Full Gemini art (painterly cloud backdrop, animated cloud-spirit hero) + Lyria sky music. Two validators were generalized beyond Ember's conventions in the process (music scans the vendored SDK for boot() games; texturing reads materials from theme-kit.json).
- **Why:** A second, differently-shaped game is the real test of "clone a game, apply rules" — and it forced the engine + validators to become genuinely archetype-agnostic.
- **Systems:** Nimbus Climb, Studio.Game.boot, sky level-gen, rules.json + level-lint, Lyria Music (Vertex), Studio Art (cohesion judge), Studio Distinct (uniqueness judge), Studio Sound, Texture Kit (style-matched tiles)
- **Validator:** gate GREEN webgl+canvas, deterministic; --validate-all 7/7 ACCEPT (feel, gate, music 1.0, art 64.4, distinct 91.7, texturing 100, rules 100)
- **Artifacts:** `games/nimbus/`, `https://nimbus-climb-production.up.railway.app`

## Parity

### Shell parity: deepfin-bar menus, save/progression, notes-SPACE fix, decorative vertical enemies
`2026-06-10` · 🚀 shipped

- **What:** Parity audit vs the reference games (deepfin screenshot as the quality bar) then filled engine-side: Studio.Menu (full-bleed backdrop, breathing hero art, generated WORDMARK lockup + tagline, zone rail of per-level thumbnail cards with locks + best coins/time, level-complete card, win screen, sound toggle — touch + keyboard) and Studio.Save (localStorage progression). New bricks: logo.mjs (Gemini wordmark per game) and menu-shots (auto-screenshots every level into its zone card via the additive __game.gotoLevel hook). Fixed the notes textarea swallowing SPACE (Phaser key CAPTURES preventDefault at the manager level — Shell now clears/restores captures). Nimbus regains visible storm-imps as decorative patrollers; interactive vertical enemies stay backlog after bisecting a sub-pixel landing race that diverged the gate.
- **Why:** Every engine game should boot like a finished product — deepfin set the bar; the engine way is to pay that cost ONCE in the SDK + tools.
- **Systems:** Studio.Menu + Save, logo + menu-shots, Playtest Shell, Studio.Game.boot, Nimbus Climb, Ember Depths, Studio SDK
- **Validator:** gates GREEN both games (nimbus double-gate 2426/2426 deterministic WITH enemies); menus verified live on both deploys
- **Artifacts:** `sdk/studio.js (Studio.Menu/Save)`, `tools/art/logo.mjs`, `tools/menu-shots/`, `https://nimbus-climb-production.up.railway.app`, `https://ember-depths-production.up.railway.app`

### Connected to the family: per-game repos, notes→ISSUES, hub registration, deepfin on the map
`2026-06-10` · 🚀 shipped

- **What:** Ember Depths + Nimbus Climb are standalone GitHub repos now (studio publish = subtree push; GAME_META.repo is truth). Playtest notes auto-file as GitHub issues (label playtest-note, note-id back-reference; the user's 5 rescued Nimbus notes became nimbus-climb#1–5, and a live test note became #6 end-to-end). Both games registered in game-engine hub/games.json (commit 6b952fa). Shell gained the deepfin corner links (DIARY / REPO / NOTES→ISSUES / ENGINE). The sysmap now shows the whole FAMILY: the hub + deepfin/jazz/the-platformer as sibling games, with the lineage edges (feel←jazz, menu←deepfin). Duplicate studio-sysmap Railway project deleted.
- **Why:** A game is not shipped until it lives where the rest of the family lives: its own repo, its notes in issues, its card in the hub.
- **Systems:** game-engine hub, Deepfin, Jazz, the-platformer, Ember Depths, Nimbus Climb, notes-loop, Playtest Shell, Sysmap (interactive visualizer)
- **Validator:** live POST /api/notes → nimbus-climb#6 created automatically; hub games.json lists 5 games; gates GREEN
- **Artifacts:** `https://github.com/agadabanka/ember-depths`, `https://github.com/agadabanka/nimbus-climb`, `game-engine hub/games.json@6b952fa`

## Archetype

### New archetype: vertical space shooter (Studio.Shooter) + Starlance, shipped
`2026-06-10` · 🚀 shipped

- **What:** Added a third archetype to the engine — a vertical space shooter — and built Starlance with it in one pass. Studio.Shooter is a distinct game loop (no gravity/platforms) that reuses the shared chrome (Shell/Save/Audio/Touch/harness/Menu-local). The deterministic 0-death problem for a shmup is solved by the SWEEPING-GAP BULLET CURTAIN: bullets rain in columns except a safe gap weaving on a fixed-dt clock; constants satisfy sweepSpeed·fallTime < gapW/2−shipHalf so the live gap is always a safe column the autopilot rides while auto-firing; formations are non-deadly score targets; the boss dies to sustained fire while the ship dodges. rules.json + level-lint encode the survivability bound as a checkable contract. Full Gemini art (ship, 3 enemies, mothership boss, powerup, 5 veil backdrops) + Lyria synthwave drive. Repo agadabanka/starlance (private), notes→issues server, registered in the hub (6 games), deployed.
- **Why:** A genuinely different genre is the proof the engine is an engine, not a platformer — and the curtain shows the "AI-completable by construction" discipline generalises beyond running and climbing.
- **Systems:** Studio.Shooter, Starlance, rules.json + level-lint, Lyria Music (Vertex), game-engine hub, Playtest Shell, Studio.Feel, Studio.Game.boot
- **Validator:** gate GREEN webgl+canvas, double-gate frame-identical (7875, score 3900, 0 deaths, boss destroyed); level-lint 100/100 (every veil provably survivable)
- **Artifacts:** `games/starlance/`, `https://github.com/agadabanka/starlance`, `https://starlance-production.up.railway.app`

### Fourth archetype: car RTS (Studio.RTS) + Roadwar — and a design-lens tool
`2026-06-11` · 🚀 shipped

- **What:** Added a fourth archetype — a toon-shaded car RTS — and built Roadwar (5 grounds) with it. Studio.RTS is a deterministic 3-lane lane-push: spend auto-income SCRAP to BUILD cars (scout/brawler/gunner) that drive up and brawl; win = fortress HP→0, lose = garage HP→0. The 0-death problem is solved WIN-BY-CONSTRUCTION via two STATIC economic bounds (rules.json + level-lint), not geometry: ACCUMULATION (income/cost > fortressTurret.dmg/(cd·hp) so the all-in-rally deathball grows unbounded and the finite-schedule fortress falls) and SIDE-LEAK (a garage-HP budget on off-rally scouts the all-lane base gun clears). New tools this pass: a pure-Node econ sim that tunes balance in ms before the browser gate, and — following the platformer's design-lens path — `studio lens`, a DESIGN DIAGNOSTIC (MDA + Schell lenses) that traces each weak Feel component to the lens that asks why + a concrete mechanic fix. The lens drove FUN 65→86.3 through real design: a Warlord boss climax, per-ground signatures (introduce→develop→twist→master), intensity escalating 9→45 to the finale. Also hardened `studio publish` to CREATE the repo (private) if missing — every game IS a repo. Full Gemini toon art + Lyria anthem. Repo agadabanka/roadwar (private), notes→issues, hub (7 games), deployed.
- **Why:** Two lessons made first-class. (1) A fourth genre on the SAME engine + autopilot — its win-by-construction expressed as ECONOMIC bounds rather than geometry — is more proof the engine generalizes past platformers. (2) 'Make it more fun' became a TOOL, not vibes: the design lens turns a low Feel number into the lens that asks why and the mechanic that fixes it, so fun rises by design (a boss, a ramp) and the score follows honestly.
- **Systems:** Studio.RTS, Roadwar, Design Lens, rules.json + level-lint, Studio.Feel, Lyria Music (Vertex), game-engine hub, Playtest Shell, Studio.Game.boot, Publish
- **Validator:** gate GREEN webgl+canvas frame-identical (9801, 0 deaths, all 5 grounds, boss fought); level-lint rts 100% (accumulation + side-leak); FUN 86.3 (bar 80) via design-lens; deployed live
- **Artifacts:** `games/roadwar/`, `https://github.com/agadabanka/roadwar`, `https://roadwar-production.up.railway.app`, `tools/design-lens/`

## Engine

### Engine polish pass: economy, per-level music, richer juice/props, composite FUN — and the hub unstuck
`2026-06-11` · 🚀 shipped

- **What:** A round of ENGINE-LEVEL upgrades (every game inherits them), driven by playtest notes. (1) ECONOMY: a buildable REFINERY (coin generation) in Studio.RTS — spend scrap to raise income, the army-vs-economy choice; the autopilot opens with refineries (autoEcon) on the later grounds and still gates 0-death (8966, deterministic). (2) PER-LEVEL MUSIC: Studio.levelMusic + Audio.switchMusic cross-fade a distinct track per level across ALL three archetypes (theme.musicByLevel / levels[i].music); the music validator now verifies every per-level track and scores per-level variety. Roadwar ships 5 distinct Lyria battle themes (desert/junkyard/neon/canyon/boss-metal). (3) JUICE + PROPS: Studio.Juice gains explode / ring / muzzle / popText / ambient-drift, wired through RTS combat (hit rings, ranged muzzle flashes, scaled death explosions, a WARLORD-DOWN pop, a fortress-fall explosion chain) plus procedural roadside props + ground atmosphere. (4) COMPOSITE FUN: the design lens now also scores PRODUCTION POLISH (Schell #58 juice · #62 spectacle · #40 reward · #31 variety · #63 beauty) — the real fun the geometry Feel model is blind to — and blends it with the level-design score for the headline FUN (Roadwar 86.3 design + 100 polish = 91.5). (5) The game-engine HUB 'stuck on loading' bug was fixed (cold-start cache-poisoning in /api/dashboard) and starsweeper registered → all 8 games show.
- **Why:** The throughline the playtests asked for: put the RULES in the ENGINE. Economy, per-level scores, juice and props aren't per-game hacks — they're SDK capabilities with validators, so the next game gets them free. And 'make it more fun' got a measurable home: the lens credits the production polish the Feel model couldn't see, so juice/spectacle/reward/variety/beauty count toward FUN by design, honestly.
- **Systems:** Studio.RTS, Roadwar, Design Lens, Studio.Feel, Lyria Music (Vertex), Studio.Game.boot, rules.json + level-lint, game-engine hub
- **Validator:** gate 0-death webgl+canvas (8966); music validator per-level (5/5 tracks, perLevelMusic ✓); design-lens FUN 91.5 (design 86.3 + polish 100); hub /api/dashboard 8 games, no hang
- **Artifacts:** `sdk/studio.js`, `tools/studio-sound/validate.mjs`, `tools/design-lens/`, `https://hub-production-6d28.up.railway.app`

### Isometric archetype (Studio.Iso + Studio.IsoRTS) + a strategy-sweep eval beyond 0-death
`2026-06-11` · 🚀 shipped

- **What:** Two building blocks. (1) ISOMETRIC: Studio.Iso is a reusable perspective-iso PROJECTOR (configure screen anchors once → project lx∈[-1,1] across + t∈[0,1] depth to a screen point with perspective scale + depth-sort; lxAt inverts a click) — the foundation for any future iso game of any genre. Studio.IsoRTS is a new archetype built on it: the car RTS on a FREER continuous-front battlefield (a continuous lateral lx, not 3 fixed lanes) drawn in 2.5D iso, REUSING the RTS economy + combat + win-by-construction (lane→lx band). Roadwar Iso ships with a full iso art set (5 backdrops + 10 sprites) and gates 0-death deterministically (9005). (2) A new KIND of eval: tools/eval/strategies.mjs sweeps 7 AI playstyles (brawler-ball, scout-swarm, gunner-line, eco-boom, no-eco, mixed-arms, spread-front) through every ground and reports strategic DIVERSITY (how many styles win = meaningful choices, Schell #32), TENSION (how close the garage came — stomp vs nail-biter) and a per-ground challenge profile. It immediately exposed what the binary 0-death gate hides: the grounds are STOMPS (every style wins, tension ≈ 0).
- **Why:** Per playtest steer: 0-death is one optimal strategy's yes/no — a weak signal. The richer questions are 'is it a stomp?' and 'does more than one strategy work?'. The strategy sweep + the fun-maximizer (design lens) are the new quality bar; 0-death becomes a sanity floor, not the goal. And the iso projector + archetype are engine building blocks, so the next iso/RTS game inherits them.
- **Systems:** Studio.IsoRTS, Roadwar Iso, Studio.Game.boot, Design Lens, Studio.Feel, rules.json + level-lint
- **Validator:** iso gate 0-death webgl+canvas (9005, frame-identical); strategy-sweep 7×5; design-lens FUN 91.7
- **Artifacts:** `sdk/studio.js (Studio.Iso, Studio.IsoRTS)`, `games/roadwar-iso/`, `tools/eval/strategies.mjs`

### Systematic difficulty: a tension model + auto-balancer (engine building blocks), beyond 0-death
`2026-06-11` · 🚀 shipped

- **What:** Made TENSION a systematic, declared, validated engine property instead of hand-tuning. Four building blocks: (1) Studio.rtsPressure (SDK) + tools/eval/pressure.mjs (the canonical mirror) — a level's `difficulty` (0..1) deterministically expands its schedule with FLANK waves (off-rally units that bypass the centre deathball and pressure the HQ → garage damage = tension, and a flank-aware strategy beats centre-only = depth). (2) tools/eval/rts-core.mjs — the shared pure-Node (Iso)RTS sim + 7 AI playstyles, the one simulator under every RTS eval. (3) tools/eval/strategies.mjs (studio strategies) — sweeps the playstyles → canonical (autopilot) tension curve + worst-case near-loss + strategic diversity. (4) tools/eval/balance.mjs (studio balance) — auto-tunes per-level `difficulty` to a target tension curve that RISES to the finale, keeping the canonical strategy winnable as the floor; writes difficulty back into the level data. Result on both Roadwar (lanes) and Roadwar Iso (continuous front): the strategy-sweep that showed STOMPS (every style wins, tension ~0.06) now shows a tension curve climbing 0.34→0.71 to a BRUTAL boss finale, with 89% strategic diversity (some playstyles genuinely fail = real choices) — and both gates stay GREEN 0-death (the floor). Also fixed rallyLx (lane-index vs lx disambiguation) so the sim is faithful to both archetypes.
- **Why:** The steer was that 0-death is one optimal strategy's pass/fail — a weak signal — and that whatever we build should be SYSTEMATIC in the engine. So difficulty/tension is now a knob the engine owns (rules, not per-level hacks): the designer declares a rising tension curve and the balancer realises it against the strategy-sweep, with the 0-death gate demoted to a winnability floor. The next RTS/iso game inherits the whole loop.
- **Systems:** Studio.RTS, Studio.IsoRTS, Roadwar, Roadwar Iso, Strategy Sweep, Studio.Game.boot, rules.json + level-lint, Studio.Feel
- **Validator:** both gates GREEN 0-death (floor); strategy-sweep tension 0.06→0.47 mean, curve 0.34→0.71 rising; diversity 89%
- **Artifacts:** `sdk/studio.js (Studio.rtsPressure)`, `tools/eval/pressure.mjs`, `tools/eval/rts-core.mjs`, `tools/eval/strategies.mjs`, `tools/eval/balance.mjs`

---

## Flows — the order systems are called

### Runtime: one Ember frame

What actually runs, in order, every 1/60s step of Ember Depths (game.js update()).

1. **Studio.harness** (step) — game.step(t, dt) — the deterministic stepper drives update(); same dt every frame, so runs replay bit-identically.
2. **Studio.Contraptions** (world tick) — movers + contraptions advance on the deterministic phase clock; the interaction pass may launch (geyser) or arm a collapse (crumble).
3. **Studio.Touch** (input) — read the player: keyboard + the on-screen joystick/JUMP (touch devices).
4. **Studio.Autopilot** (or autopilot) — in eval runs the autopilot senses ground/walls/enemies ahead and emits the decision instead.
5. **Studio.Materials** (footing) — probe the slab under the feet — ice is slick, mud is sticky; friction feeds the controller.
6. **Studio.Platformer** (movement) — Studio.Platformer applies coyote time, jump buffer, variable jump, asymmetric gravity, skid.
7. **Studio.Juice** (feel & FX) — state-driven hero anims, landing shake, ember bursts, glow/grade — visual only, never touches physics.
8. **Studio.Cam** (camera) — deadzone follow pans the cave after movement settles.
9. **Studio.Audio** (sound) — event SFX (jump/coin/stomp/win) + the Lyria cave loop under it all.
10. **Playtest Shell** (shell) — outside the loop: the playtest shell can pause the whole scene or pin a note to this exact frame.

### Assembly line: how a game gets built

The conductor drives the verticals in this order; each stage is gated before the next.

1. **Conductor** (conductor) — reads GAME_META.stages and prints the next vertical's brief — the studio's showrunner.
2. **Vertical registry** (story/concept) — Writers' Room + Showrunner briefs set the fiction and the verbs.
3. **Studio.Backdrop** (art theme) — the painterly backdrop locks the palette every later asset must match.
4. **Art pipeline (Gemini)** (characters) — Gemini hero/enemy sheets, chroma-keyed + sliced on-model.
5. **Ember campaign (levels.js)** (level design) — the campaign in the Level DSL — geometry rules keep every level AI-completable.
6. **Studio.Feel** (gameplay) — Studio.Feel scores FUN per level; beats are tuned to the interest curve.
7. **Sprite Studio** (animation) — animate the hero and run the sheet through the sprite gate.
8. **Texture Kit (style-matched tiles)** (texturing) — style-matched seamless tile kit generated from the backdrop itself.
9. **Lyria Music (Vertex)** (sound) — Lyria 2 composes the loop; SFX wired to every key event.
10. **game-gate (eval.mjs)** (QA gate) — the 0-death deterministic autopilot run, webgl + canvas.
11. **Railway deploy** (ship) — railway up — the game gets a live URL.

### Quality gate: conductor --validate-all

One command answers "is this game good?" — every registered validator runs through the dispatcher into a scorecard (Ember: 6/6 ACCEPT).

1. **Conductor** (collect) — gathers every game-applicable capability from the registry.
2. **Lego registry** (registry) — the Lego index — register() refuses any brick without a validator.
3. **Lego dispatcher** (dispatch) — runs each brick's validator, captures the JSON verdicts.
4. **game-gate (eval.mjs)** (gate) — 0-death deterministic run on both renderers.
5. **eval-feel (feel.mjs)** (feel) — FUN model on the level specs (Ember 90.5).
6. **Studio Sound** (music) — SFX wiring + the bed must be provably non-silent (Lyria sidecar).
7. **Studio Art (cohesion judge)** (art-cohesion) — Gemini vision, 9 dimensions, threshold 60 (Ember 73.9–77.8).
8. **Studio Distinct (uniqueness judge)** (distinctness) — uniqueness vs the stock-platformer baseline (Ember 86.7).
9. **Texture Kit (style-matched tiles)** (texturing) — seams, texture energy, palette affinity vs the backdrop (19/19) → scorecard verdict back at the conductor.

### Runtime: one Roadwar frame

What runs every 1/60s step of Roadwar (Studio.RTS update()) — deterministic, so eval replays bit-identically.

1. **Studio.harness** (step) — game.step(t, dt) drives update() with the same dt every frame.
2. **Studio.Autopilot** (build (rally)) — in eval the all-in-rally macro builds autoBuild on the rally lane whenever scrap allows — the win-by-construction strategy.
3. **Studio.RTS** (tickWorld) — scrap += income·dt; units (id-order) seek the nearest enemy ahead in-lane, hold at engage range, fight on cd, else advance or hit the HQ; HQ turrets defend all lanes; the finite enemy schedule spawns on the clock.
4. **Studio.RTS** (win/lose) — fortressHp≤0 → next ground / won; garageHp≤0 → death. Deterministic, no RNG.
5. **Studio.Feel** ((offline) score) — Studio.Feel reads the schedule as a rising battle-heat curve; the design lens turns weak components into mechanic fixes.

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
| **Studio.Game.boot** | sdk | — | the declarative game runtime: a game is data + theme tokens + hooks; all per-game glue (world/theme/HUD/shell/autopilot/harness/win-death) is one SDK impl. runner + vertical archetypes. |
| **Studio.Menu + Save** | sdk | — | deepfin-bar menu inside boot(): full-bleed backdrop, breathing hero, generated wordmark lockup, zone rail of per-level thumbnail cards (lock/best), level-complete card, win screen; Studio.Save persists unlocked+best. Eval-safe: harness reset() bypasses. |
| **Studio.Shooter** | sdk | — | the vertical space-shooter archetype: a separate game loop reusing Shell/Save/Audio/Touch/harness; the sweeping-gap bullet curtain is 0-death-by-construction (sweepSpeed·fallTime < gapW/2 − shipHalf). |
| **Studio.RTS** | sdk | — | The car-RTS archetype: deterministic 3-lane lane-push (build→rally→brawl). Win-by-construction via economic bounds (accumulation + side-leak), not geometry. |
| **Studio.Iso** | sdk | — | Reusable perspective-iso projector: lx+depth → screen with perspective scale + depth-sort. The building block behind any isometric game. |
| **Studio.IsoRTS** | sdk | — | Isometric continuous-front RTS archetype (built on Studio.Iso); reuses the RTS economy/combat/win-by-construction with lane→lx band. |
| **rtsPressure** | sdk | — | Difficulty→flank-pressure model (Studio.rtsPressure + pressure.mjs mirror): the engine's systematic tension knob. |

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
| **Texture Kit (style-matched tiles)** | tool | texturing | tools/texture-kit/ — generates a SEAMLESS material tile kit + themed sprites from the game's own backdrop as Gemini style-ref (2×2 mirror quilt); deterministic validator: seam/energy/palette-affinity/alpha. |
| **Lyria Music (Vertex)** | tool | music | tools/art/lyria.mjs — generates a real instrumental loop with Google Lyria 2 (Vertex AI), downmixes + crossfade-loops + MP3-encodes, writes a measured sidecar so the music validator can prove it is non-silent. |
| **sky level-gen** | tool | — | tools/level-gen/sky.mjs — generates vertical towers reachable-by-construction (staggered lanes, centre-column updrafts, storm framing). |
| **logo + menu-shots** | tool | — | tools/art/logo.mjs (Gemini wordmark per game, keyed) + tools/menu-shots (screenshots every level via __game.gotoLevel into zone cards that can never drift). |

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
| **Studio Art (cohesion judge)** | tool | art-cohesion | tools/studio-art/ — screenshots a game headless and scores 9-dim VISUAL COHESION 0-100 with Gemini vision (threshold 60). |
| **Studio Distinct (uniqueness judge)** | tool | distinctness | tools/studio-distinct/ — scores a game's UNIQUENESS vs a sibling or the stock-platformer baseline (Gemini vision, 6 axes). |
| **rules.json + level-lint** | concept | rules | the geometry contract as data (per archetype) + the cheap static gate that lints levels before the browser gate. |
| **Design Lens** | sdk | — | MDA + Jesse Schell's lenses as a tool: traces each weak Feel component to the lens that asks why + a concrete per-archetype mechanic fix; judges per-level quality AND campaign intensity escalation. |
| **Strategy Sweep** | tool | — | Runs many AI playstyles through a level → strategic diversity + tension + balance. A different kind of eval than the binary 0-death gate. |
| **Auto-Balancer** | tool | — | studio balance — auto-tunes per-level difficulty to a rising tension curve, floored by winnability, checked by the strategy-sweep. |

### 6. Feedback

| node | kind | validator | description |
|------|------|-----------|-------------|
| **Feedback** | tier | — | From 'I felt something' to a fix: the conductor, the vertical registry, the build diary. |
| **Conductor** | orchestrator | — | orchestrator/conductor.mjs — runs the gate, reads GAME_META.stages, picks the next ready vertical, emits its agent brief; folds in feel. |
| **Vertical registry** | orchestrator | — | orchestrator/verticals.json — 11 agent verticals in dependency order, each with the Phaser systems it wields + a machine gate. |
| **ORCHESTRATION.md** | concept | — | The studio's north star: level up the engine (SDK on PH4) + level up the process (verticals become agents; hub becomes conductor). |
| **Studio Diary (diary.json)** | concept | — | diary/SCHEMA.md + diary.json — the machine-readable build log + systems graph; DIARY.md is a render, the sysmap consumes it directly. |
| **Sysmap (interactive visualizer)** | tool | sysmap-check | tools/sysmap/ — vanilla JS+SVG force-graph of diary.json + registry.json; deployed at studio-sysmap-production.up.railway.app. |
| **Playtest Shell** | sdk | — | Studio.Shell — DOM playtest overlay every game inherits: pause/resume (scene + music duck), 📝 notes POSTing {text + live game context} to the host's /api/notes, restart, mute. Inert until clicked, so the deterministic gate is untouched. |
| **RFC-001 Engine Simplification** | concept | — | rfc/001-engine-simplification.md — one bundle (phaser-studio.min.js built by the fork), one CLI front door, games as data+hooks via Studio.Game.boot, rules.json as first-class data, and a notes-loop brick so every playtest note feeds the next dispatch. |
| **notes-loop** | tool | feedback | tools/notes-loop — pull /api/notes from every deployed game, Gemini-triage to capabilities; closes play→note→dispatch→diary. |

### 7. Publish

| node | kind | validator | description |
|------|------|-----------|-------------|
| **Publish** | tier | — | The deployed games — a push to main auto-deploys the live build on Railway. |
| **Game Template** | game | gate | game-template/ — the neutral Phaser 4 base on the Studio SDK; the canonical clean game new titles are scaffolded from. Live on Railway. |
| **Ember Depths** | game | gate | games/ember/ — a 5-level lava-cave platformer showing off the PH4 GPU FX + particles; mean FUN 91.6, gate green. Live on Railway. |
| **Ember campaign (levels.js)** | game | feel | games/ember/src/game/levels.js — the 5-level descent authored to Studio.Feel (introduce -> develop -> twist -> master). |
| **game-engine hub** | orchestrator | — | agadabanka/game-engine — the family hub: hub/games.json registers every shipped game (repo/url/meta/stages); notes→issues convention; the studio's games are registered there too. |

