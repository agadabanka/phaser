# Ember Depths — Diary

A lava-cave platformer built on the Studio SDK (Phaser **4.1.0**), made to show off the
Phaser-4 GPU FX + particle surfaces the studio's older Phaser-3 games never touched.

### Art Direction — the molten cave
- **Warm, darkened ColorMatrix grade** (`Studio.Juice.grade` → `cm.brightness(0.9)`,
  `cm.saturate(0.16)`, `cm.hue(-6)`) pushes the palette warm and dims the cavern.
- **Vignette** (`Studio.Juice.vignette(0.62)`) for depth — corners fall into shadow.
- **Materials**: `stone` for the cave floor/pillars, glowing `lava` for the pits.
- **Embers everywhere**: a baked orange `ember` particle drives both the drifting motes
  (`Studio.Juice.ambient`) and a rising **updraft** off the lava line, plus a warm
  **glow** on the hero. Reads clearly in a single still frame (`out/shot-webgl.png`).

### Level Design — lava as a deadly gap
Two levels in `src/game/levels.js` via the Level DSL:
- **Molten Shallows** and **The Caldera**. Lava is authored as a `ground` segment with the
  `lava` material; the SDK routes deadly materials into the **hazards** group, so the
  gap-jump autopilot sees no walkable ground over a pit and hops it, while falling in
  overlaps a hazard → death.
- Physics held at the contract (SPEED 220 / JUMP 600 / GRAV 1300). Geometry obeys the
  proven template spacing: gaps ≤ 140px, walls ≤ 2 tiles, and every wall sits ≥ ~300px
  before the next gap (a wall-hop sails ~200px, so it must land on stone with runway to
  re-clear the gap). Each level has coins and a stompable, side-safe patroller.
- The run **chains** level 1 → level 2; the gate is green only if BOTH clear 0-death.

### FX / Feel (inert-until-fired, so determinism holds)
- Ember **burst** on coin pickup and on stomp (`Studio.Juice.burst`).
- Camera **shake** on stomp and on landing; warm **flash** on win.
- Stomp squash + bounce; all routed through `Studio.Juice` and guarded for canvas.

### Eval verdict (final)
`node eval.mjs` from `studio/games/ember` — **GREEN on both renderers**:
```json
{
  "verdict": { "webgl": true, "canvas": true },
  "webgl":  { "deterministic": true, "gate": { "won": true, "deaths": 0, "frame": 1033, "coins": 14 }, "readback": { "nonblackRatio": 1 }, "errors": [] },
  "canvas": { "deterministic": true, "gate": { "won": true, "deaths": 0, "frame": 1033, "coins": 14 }, "readback": { "nonblackRatio": 1 }, "errors": [] }
}
```
Two identical 700-step runs match (deterministic), the autopilot clears both levels with
**0 deaths**, headless **WebGL** readback is non-black (ratio 1.0 ≫ 0.02), and screenshots
land in `out/shot-webgl.png` + `out/shot-canvas.png`.

### Gotcha caught during bring-up
First pass died in lava at x≈1065 on level 2: a wall sat only ~200px before the next gap,
so its full-height hop overshot the landing stone straight into the pit. Fixed by widening
wall→gap spacing to the template's ~340px (one geometry change), re-evaluated → green.

### Not done here (by design)
Deploy is the conductor's job — `deploy:false`, no Railway URL. Music is still procedural
SFX only.
