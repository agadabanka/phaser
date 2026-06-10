# RFC-001 — Simplify the engine: one bundle, one CLI, data-only games, notes that feed back

**Status:** proposed · **Date:** 2026-06-10 · **Scorecard safety net:** every step below
must keep `conductor --validate-all` at 6/6 ACCEPT on Ember + template. The deterministic
gates are what make an aggressive refactor safe — we can move anything, because "did we
break it?" is a command, not an opinion.

## The thesis

The studio's essential loop is exactly one sentence:

> **Clone a game, then apply rules over and over: ask what's next, call the right tool,
> forge it if it doesn't exist, gate the output, repeat — and let every playtest note
> improve the engine.**

Today that loop works, but it is spread across more surface than it needs:

| measured today | count |
|---|---|
| per-game OWNED code (ember) | **853 lines** (game.js 513, eval 68, diag 20, server 27, html 15, levels 210) |
| of which genuinely game-specific | ~250 (levels.js 210 + theme/FX hooks ~40) |
| studio entry points | **5 CLIs** (conductor, dispatch, forge, registry, vendor) + 2 overlapping JSONs (registry, verticals) |
| copies of studio.js in the tree | **5** — and the two tool copies are *stale right now* (md5 mismatch vs sdk/) |
| copies of phaser.min.js | per game + per browser-tool, wiped by env resets twice this week |

The duplication isn't hypothetical: this session alone hit (a) stale tool vendors,
(b) a deploy that shipped without phaser.min.js, (c) hand-syncing sdk → game on every
SDK edit, (d) `eval.mjs` drift risk between games.

## The four consolidations

### 1. `Studio.Game.boot(config)` — games become data + hooks (biggest win)

513 of ember's 513 game.js lines are glue; maybe 40 are *Ember*. Everything else —
build world from LEVELS, per-material tile overlays + rim lights, pickup/goal/spring
art, follower-art syncing, mover/crumble overlays, HUD + title toasts, touch + shell +
music wiring, autopilot sense/snapshot, harness install, win/death rules, victory stop —
is the same in every platformer we will ever scaffold, **parameterized only by theme
tokens and asset keys**.

Move it into the SDK as a declarative runtime:

```js
// games/<name>/src/game/game.js — the WHOLE file after RFC-001
Studio.Game.boot({
  meta: 'GAME_META.json',          // name, url, controls
  levels: window.LEVELS,           // unchanged Level DSL
  theme: {                          // tokens, not code
    palette: { accent: 0xffb24a, hud: '#ffd9a0', sky: 0x140a08 },
    kit: 'assets/kit',             // texture-kit output (per-material tiles, pickups)
    hero: { sheet: 'assets/hero_sheet.png', cells: [288, 338], anims: { run: [0,5,14], idle: 6, jump: 7 } },
    music: 'assets/music/cave.mp3',
    ambient: 'ember'               // named particle recipe
  },
  hooks: {                          // the ~10% that is genuinely this game
    onStomp(scene, player, enemy) { /* extra flavor */ },
    contraptionFX: { crumble: {...}, launcher: {...} }
  }
});
```

- "Clone a game" then clones **data** (levels.js, GAME_META, theme, assets), not logic.
- One implementation of sense/snapshot/gate wiring = the eval contract can never drift
  per game again.
- The existing games are the regression suite: port template, port Ember, scorecard must
  stay 6/6 with FUN unchanged (±0) — boot() is correct when the numbers don't move.

### 2. One engine artifact: build Studio INTO phaser-private (`phaser-studio.min.js`)

This is the "what changes would we need to Phaser" answer, and it is why the private
fork exists. Today every game vendors **two** files (phaser.min.js + studio.js) that
version independently and drift. Instead:

- `src/studio/` in the fork — the SDK as ES modules (Materials, Level, Platformer,
  Contraptions, Autopilot, Juice, Audio, Cam, Touch, Shell, Feel, harness, **Game**).
- A new webpack entry emits **`dist/phaser-studio.min.js`** — Phaser + Studio, one
  file, one version. `window.Studio` global kept for compat; optionally registered as a
  Phaser GlobalPlugin so scenes get `this.studio`.
- **Deterministic stepping becomes an engine mode, not a monkey-patch:** the fork adds a
  `stepMode` boot flag that sleeps the loop and exposes `game.stepOnce(dt)` —
  formalizing what `__rec` does today by reaching into `game.loop`. Contained, additive,
  and it makes the eval contract part of the engine's public surface.
- Everything else we learned (blocked.right semantics, one-body-per-slab, preserveDrawingBuffer)
  stays *conventions in Studio.Level* — no invasive engine edits, so upstream Phaser
  merges remain trivial (src/studio is purely additive).
- `lego/vendor.mjs` shrinks to: copy ONE file from `../dist/` (we live inside the fork;
  the build lands right next door). Stale-vendor class of bugs disappears.

### 3. One front door: the `studio` CLI (conductor + dispatch + forge + vendor)

Keep the modules, merge the entry points:

```
studio new <name>            # clone the (now tiny) template
studio next <game>           # what the conductor prints today (stage + brief + feel hint)
studio run <capability> ...  # dispatch: lookup -> vendor -> run -> VALIDATE (forge-on-miss)
studio gate <game>           # the 0-death deterministic gate
studio check <game>          # --validate-all scorecard
studio ship <game>           # railway up + live verify + GAME_META.url
studio notes pull|triage     # (see §4)
```

- **registry.json absorbs verticals.json**: a vertical is just a capability with a
  `stage` number and an agent brief; the pipeline order = sort by stage. One JSON is
  the studio's entire self-description (and the sysmap/PDF already read it).
- **rules.json becomes first-class**: the geometry contract (gap ≤ 120px, wall ≤ 2
  tiles, ice exits on solid, spring slabs…), judge thresholds (art ≥ 60, distinct ≥ 50),
  and tuning constants currently live in comments and scattered constants. Extract them
  to `studio/rules.json`; add a tiny **level-lint brick** (capability `rules`) that
  statically checks levels.js against the contract — a free, instant gate that catches
  bad geometry before the expensive browser gate runs. "Apply certain rules over and
  over" deserves the rules to be data, not folklore.

**What deliberately stays separate:** the validators. Each judge being its own brick with
its own gate is the Lego contract's whole point — merging them would couple failures.
Tools (build-time) vs SDK (runtime) also stays a hard line.

### 4. Close the loop: notes from every game improve the engine

The Shell already pins notes to exact game context (`D1 Molten Shallows @169`, coins,
deaths). Today they die in each deployment's ephemeral `data/notes.json`. The missing
piece is a **feedback brick** (capability `feedback`, tool `notes-loop`):

1. **pull** — `studio notes pull` walks every game's `GAME_META.url`, fetches
   `/api/notes`, and lands them in `studio/notes/inbox.json` (committed = durable;
   no Railway volume needed).
2. **triage** — Gemini text-classifies each note against the registry's capabilities
   using its context fields (a note at a lava gap about "jump feels late" → `feel` /
   platformer tune; "music too quiet on phone" → `music`; "floor tiles repeat" →
   `texturing`). Output: `notes/triage.json`, where each item carries
   `{ noteIds, capability, severity, suggestion }`. Deterministic validator: every
   triaged item references a real note id + a real capability; counts reconcile.
3. **surface** — `studio next` prints the open backlog for the stage it recommends
   ("Sound Stage: 3 notes — 'bed inaudible on phone speakers'"), so the loop's next
   iteration starts from real play, not guesses.
4. **credit** — when a dispatch resolves backlog items, the diary entry lists the note
   ids it closed. The diary already drives the sysmap and the PDF, so *which engine
   pieces playtesting improves most* becomes a queryable, renderable fact.

That is the full circle: **play → note → triage → backlog → dispatch → gate → diary →
map/PDF → play.**

## What a new game costs after RFC-001

| | today | after |
|---|---|---|
| owned files | game.js(513) eval diag server html | levels.js + GAME_META + theme.json + assets + ~40-line hooks |
| owned lines | ~853 | **~80 + levels data** |
| vendored artifacts | phaser.min.js + studio.js (drift-prone) | `phaser-studio.min.js` (one, built by the fork) |
| entry points to learn | 5 CLIs, 2 JSONs | 1 CLI, 1 registry, 1 rules.json |
| feedback path | none (notes rot per-deploy) | notes → triage → backlog → next dispatch |

## Migration plan (each step lands gated, in this order)

1. **rules.json + level-lint brick** — small, immediate, no behavior change. *(half a day)*
2. **`Studio.Game.boot`** in the SDK; port template, then Ember. Acceptance: scorecard
   6/6, FUN 90.5 unchanged, live deploys re-verified. *(the big one)*
3. **`studio` CLI** wrapping conductor/dispatch/forge/vendor; registry absorbs verticals. *(a day)*
4. **Fork build**: `src/studio/` + `dist/phaser-studio.min.js`; vendor.mjs → one file;
   `stepMode` flag. *(a day, mostly webpack)*
5. **notes-loop brick** + `studio notes pull/triage` + conductor surfacing. *(a day)*

Risks: step 2 is a rewrite of proven glue — mitigated by the gates (0-death byte-equal
determinism, FUN, art ≥ 60) and by porting the template first; step 4 touches the fork's
build — mitigated by keeping src/studio additive and the old two-file vendoring path
working until both games are on the bundle.
