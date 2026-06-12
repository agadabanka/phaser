---
name: studio-build
description: Build a Phaser 4 game with the Studio assembly line — scaffold from the Phaser-4 base, then drive it vertical-by-vertical (story → concept → art → characters → levels → feel → animation/fx → texturing → sound → QA → ship), each gated by the AI eval. Use when asked to make a new game or advance an existing one.
---

# Studio — build a game

The engine SDK is `studio/sdk/studio.js` (Phaser 4). The agent registry is
`studio/orchestrator/verticals.json`. The driver is `studio/orchestrator/conductor.mjs`.

## Core rule
**Quality is measured, not asserted.** Every level must pass the 0-death autopilot
gate (`node <game>/eval.mjs` → verdict.webgl or .canvas true, gate.won, gate.deaths===0)
before you move on. Change ONE thing, re-eval, keep or revert.

## Loop
1. **Scaffold**: `cp -r studio/game-template studio/games/<name>`; set `package.json` name + `GAME_META.json`.
2. **Ask the conductor** what's next: `node studio/orchestrator/conductor.mjs studio/games/<name>`.
   It prints the gate result, the pipeline, and the next vertical's BRIEF.
3. **Dispatch** that brief as a subagent (the vertical agents in verticals.json). The agent:
   - reads `studio/sdk/studio.js` for the API and `studio/game-template` as reference,
   - edits only its vertical's files (e.g. Level Design → `src/game/levels.js`),
   - re-runs the eval and iterates with `diag.mjs` until its gate passes.
4. **Re-measure** with the conductor; mark the stage done in `GAME_META.stages`; commit.
5. Repeat until all verticals are ✅, then **ship** (`node studio.mjs publish <game>` → GitHub-connected Railway deploy).
6. **Film + publish to YouTube** (standard final step, every game): `node studio.mjs film games/<name> --upload`
   — records a `.webm` per level (real-time autopilot via the standard `window.__game.gotoLevel(i)` hook)
   plus a packed **montage** (`window.__game.showcase()`), then uploads them all (unlisted) via the
   refresh-token (no prompts). One-time: `node studio.mjs auth youtube` to mint `YT_REFRESH_TOKEN`
   (needs a TV/Limited-Input OAuth client in `YT_CLIENT_ID`/`YT_CLIENT_SECRET`). Writes `video/youtube.json`.

## Gotchas (learned porting PH3→PH4 + Arcade)
- Static groups: use `getChildren()` (not `children.iterate`).
- Build ground as ONE wide body per segment (Studio.Level does this) — per-tile bodies
  make the player catch on seams and spoof `blocked.right`.
- Detect walls with `body.blocked.right` only; **overlaps** (coins/enemies) spuriously set `touching.*`.
- Lava/death: model a pit as a GAP (no ground) with a deadly slab at the bottom, so the
  existing gap-jump autopilot clears it; walking-into-deadly-ground needs a smarter autopilot.
- Keep new world-mutating features inert until used, or the deterministic gate goes flaky.
- WebGL GPU filters are WebGL-only — Studio.Juice guards them (no-op on canvas).

## Tokens
- `GH_TOKEN` (push), `RAILWAY_TOKEN` (account-scoped → `railway up`).
- `GEMINI_API_KEY`/Vertex (optional) unlock AI art (model-sheet sprites) + Lyria music;
  without them, the Art/Character/Sound verticals use procedural fallbacks.
