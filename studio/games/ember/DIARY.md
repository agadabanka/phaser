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

### Level redesign — fun-guided rebuild to a 5-level campaign (Level-Design pass)
The original 2 levels were long flat stone runs with dead-air windows (measured FLOW ≈ 0,
campaign mean **FUN 43.2**). Rebuilt as a **5-level descent** authored straight to the
`Studio.Feel` model and the four-step grammar (introduce → develop → twist → master), with
a steady cadence of **varied beats every ~1–2 windows** (so no window falls below interest
3.4 → FLOW maxes out) rising to a **late interest peak ~84%** whose climax is the level's
heaviest signature beat.

| # | Level | one-line beat sheet |
|---|-------|---------------------|
| 1 | **Molten Shallows** | INTRODUCE — platform + wall ledge, mud trudge, ice glide, a stomp, then one lava hop as the ~84% climax (lands on mud). |
| 2 | **The Caldera** | DEVELOP — a 2-tile wall, two lava hops (both land on mud), an ice finale; the 2nd hop is the climax. |
| 3 | **Ember Vents** | TWIST 1 — the **SPRING** bounce pad on a long slab is the ~84% climax (bounce a coin column, land back on ground); + a lava hop, mud, ice glide. |
| 4 | **Magma Run** | TWIST 2 — an early spring, then a **MOVING PLATFORM** bridging a lava gap as the climax (ride-or-hop, lands on mud); + a wide-runway lava hop. |
| 5 | **The Core** | MASTER — a medley of every verb (walls, stomp, mud, ice, spring, 3 lava hops) with the **mover** as the grand ~84% climax. |

**Method.** I ported `Studio.Feel`'s exact window math into a local scorer and a motif
search (each ~6-tile window = one motif: ledge / enemy / mud / ice / lava-hop / spring /
mover / coin-combo), with the autopilot reachability contract encoded as hard constraints
(no gap landing on ice, no wall adjacent to a gap, springs on continuous slabs, movers
bridging ≤120px gaps, safe spawn + goal runway). The search picks per-level motif sequences
that maximize FUN with the climax pinned near 84%; the winners were then hand-authored into
clean, varied geometry and re-measured.

**BEFORE → AFTER (per-level FUN, via `node studio/tools/eval/feel.mjs studio/games/ember`):**

| | L1 | L2 | L3 | L4 | L5 | **campaign mean** |
|---|----|----|----|----|----|------|
| before | 36.8 | 33.9 | 59 (old "The Vents") | — | — | **43.2** |
| after  | 92.2 | 90.8 | 91.2 | 90.8 | 93.0 | **91.6** |

Every level's **flow = 1.0** (no zero-flow, no dead air); campaign components engagement
0.92 / dynamics 0.85 / arc 0.87 / flow 1.0; every level peaks at **0.86–0.89** (late arc).

**Reachability gotchas hit (and fixed):**
- A floating start-platform placed *over* a 2-tile wall in L5 formed an enclosed pocket —
  the autopilot wedged at x≈167 (jumping into the platform's underside, `blockedRight`
  never cleared, 0 deaths but timed out). Fix: move the early wall clear of the platform
  and drop it to 1 tile. After that the chain wins at frame 2747, 0 deaths.
- Gaps must **never land on ice** (slick footing out of a jump) and walls must **never sit
  adjacent to a gap** (a wall-hop sails ~200px straight into the pit). Both are encoded as
  search constraints; every lava hop now lands on stone or grippy mud, and ice is always
  *entered* off stone at run speed and *ends* on solid ground.

### Eval verdict (final, 5 levels)
`node eval.mjs` — **GREEN on both renderers**: `verdict { webgl: true, canvas: true }`,
deterministic true, the autopilot chains all 5 levels at **0 deaths** (gate won at frame
~2746, level 4), headless readback non-black (ratio 1.0), 0 console errors.

### Not done here (by design)
Deploy is the conductor's job — no Railway redeploy from this pass. Music is still procedural
SFX only. The earlier 2-level eval block above is kept for history.
