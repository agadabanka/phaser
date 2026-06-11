# Studio — a Phaser 4 game studio you can orchestrate

Turns the implicit "build a game" methodology (the-platformer → jazz → starsweeper)
into an **explicit, agent-orchestrated assembly line** on a **Phaser 4 engine**
(`agadabanka/phaser-private`). Two moves:

1. **Level up the engine** — a Studio SDK on Phaser 4 that makes the conventions native.
2. **Level up the process** — verticals become agents; the hub becomes a conductor.

## Why
The games drifted onto **vendored Phaser 3.80** and hand-roll most of what Phaser 4
gives for free (particles, GPU filters, tweens, cameras, matter, tilemaps, lighting,
spatial audio). The hub only *observes*. Studio fixes both.

## The engine — `sdk/studio.js`
One opinionated layer over Phaser 4 so every game inherits the eval backbone + feel surface:

| Module | What it gives |
|---|---|
| `Studio.harness` | deterministic 1/60 stepper (`window.__rec`) + semantic observability (`window.__game`) + `__run/__gate` |
| `Studio.Autopilot` | generic platformer driver (the 0-death gate) + ground probes |
| `Studio.Level` | data-driven level DSL → built world (one wide static body per slab; no seam-catching) |
| `Studio.Textures` | procedural texture bakery (no external art required) |
| `Studio.Juice` | tweens · particles · **Phaser 4 GPU filters** (glow/vignette/ColorMatrix) · shake · hit-stop |
| `Studio.Audio` | procedural WebAudio SFX + music hook |
| `Studio.Cam` | follow camera w/ deadzone + bounds |
| `Studio.Materials` | look + footing + grounding (AI-safe surfaces) |

## The process — the assembly line (`orchestrator/`)
`verticals.json` is the agent registry; `conductor.mjs` is the driver.

```
conductor: run game's eval (QA gate) → read GAME_META.stages → pick next ready vertical → emit its agent BRIEF
   → you dispatch the brief as a Claude Code subagent → agent edits files + re-evals → repeat until shipped
```

| Vertical (agent) | Phaser systems it wields | Machine gate |
|---|---|---|
| **Writers' Room** (story) | — | distinctness vs siblings |
| **Showrunner** (concept) | scene flow | signature mechanic named |
| **Art Director** (art-theme) | Textures, Filters:ColorMatrix/GradientMap | visual cohesion (judge) |
| **Character Lab** (characters) | Animations, Mesh2D, Rope, Lights | on-model + animated |
| **Level Design** | Tilemaps, physics | **wincheck 0-death** + design score |
| **Feel Lab** (gameplay) | arcade/**matter**, Input, Cameras | controls + feel-ab Δ |
| **FX / Animation** | Tweens, Particles, Filters, shake | feel/juice ↑, gate green |
| **Texture / Materials** | DynamicTexture, Noise/Gradient, NormalTools | visual score |
| **Sound Stage** | Sound (WebAudio, spatial) | SFX + bed present |
| **QA / Playtester** | harness, autopilot | determinism + 0-death + readback |
| **Publishing** | — | /health live + renders |

The loop is the methodology, elevated: **one change → re-measure → keep if the gate
stays green and the score rises → commit → next**. Fan out where independent
(art ∥ sound ∥ first level), converge for feel/animation.

## Status (this branch)
- ✅ **Phase 0** — Phaser 4 spike (`spike/`): deterministic stepper + 0-death gate +
  non-black headless readback on **both** WebGL and Canvas (WebGL readback works in PH4,
  unlike PH3). 
- ✅ **Phase 1** — Studio SDK (`sdk/`) + Phaser 4 **game-template** (`game-template/`),
  gate-green, **shipped to Railway**.
- ✅ **Phase 2** — Conductor + vertical registry (`orchestrator/`).
- ✅ **Phase 3/4** — vertical agents demonstrated by building a second game (`games/`).

## Run it — the `studio` front door
Every game travels the SAME pipeline; `studio` is the one door (see `studio.mjs`).
```bash
node studio.mjs new <name>            # scaffold games/<name> from the Phaser-4 base
node studio.mjs lint <name>           # cheap static geometry/economy gate (rules.json)
node studio.mjs gate <name>           # deterministic 0-death browser gate (webgl+canvas)
node studio.mjs feel <name>           # the FUN model per level
node studio.mjs check <name>          # every applicable validator -> scorecard
node studio.mjs ship <name>           # railway up (deploy) -> live URL
node studio.mjs publish <name>        # ENSURE the game's GitHub repo exists + push it
```

### Every game IS a repo (don't skip this)
A finished game is not just deployed — it is its **own standalone GitHub repo** (the
deepfin convention) so the hub links to it and playtest notes file as issues there.
`studio publish` is the single source of truth for that: it **creates the repo if it
doesn't exist** (private by default; `--public` or `GAME_META.private:false` to override)
and force-pushes the game's subtree to `main`. So the "does this new game have a repo?"
question is answered by one idempotent command — never a manual GitHub step. After
publishing, register the game in the hub (`game-engine/hub/games.json`) with its
`repo` + `url` so it shows up in the family with working REPO / NOTES→ISSUES links.

The per-game ship checklist (also mirrored in `GAME_META.stages`):
`scaffold → identity → levels → gate → feel → hero → art → music → deploy → repo (publish) → hub`.
