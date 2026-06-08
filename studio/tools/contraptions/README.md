# Contraption Playground

A standalone, self-contained tool for designing and feeling out **Studio
Contraptions** — the registry of kinematic "machines" (seesaw / launcher /
crumble) that layer emotional *feeling* over a platformer level without ever
becoming a forced precision wall.

It has two parts:

1. **A live playground** (`index.html` + `app.js`) — boots a tiny Phaser scene on
   the Studio SDK, builds a flat themed slab + ONE chosen contraption via
   `Studio.Level`, and runs it live so the contraption visibly **moves**. A small
   scripted tester body walks across the slab so each machine gets a rider and
   shows its interaction (the seesaw's downhill carry, the launcher's boost, the
   crumble's collapse).
2. **An AI-assist generator** (`gen.mjs`) — turns a plain-English description into
   a valid contraption spec using Gemini, pinned to the existing registry.

Everything lives in this directory and reuses **vendored copies** of
`phaser.min.js` + `studio.js` (copied from `studio/games/ember/src/vendor/`), so
the tool is standalone — open `index.html` and it runs.

---

## Run it

### The playground (browser)

Serve this directory over HTTP (the SDK + canvas readback need a real origin) and
open `index.html`:

```sh
cd studio/tools/contraptions
python3 -m http.server 8080
# then open http://127.0.0.1:8080/
```

In the panel beside the canvas you get:

- a **dropdown** of `Studio.Contraptions.types`;
- a **material picker** (`Studio.Materials` keys: table / stone / ice / lava /
  mud) that themes the slab (and the contraption art baked off it);
- two **param inputs** relevant to the chosen type
  (seesaw: tilt + period · launcher: launch velocity + cycle period ·
  crumble: collapse delay + width);
- a **readout** showing the selected contraption's *feeling / lens / weight*
  (from `Studio.Contraptions.meta`) plus the **live FUN contribution** — the
  delta between `Studio.Feel.score` of the test level *without* vs *with* the
  contraption.

Changing any control rebuilds the live scene.

`?r=canvas` or `?r=webgl` forces a renderer (default is `Phaser.AUTO`).

### The AI generator (CLI)

```sh
node gen.mjs "a swinging blade hazard"
```

Auth is `GEMINI_SA_JSON` (or `GOOGLE_APPLICATION_CREDENTIALS` / `GEMINI_API_KEY`),
the same as the rest of the art pipeline. **No creds?** It prints a clear
"needs GEMINI creds" message and a sensible hand-written fallback spec (chosen by
keyword) — it never crashes. Sample output:

```
PROPOSAL (Gemini)
  type        : seesaw
  feeling     : Tension and precise timing to avoid a rhythmic danger.
  registry meta: lens=Challenge  weight=7  (canonical: "balance / tension / control")
  rationale   : The seesaw's oscillating tilt best simulates a swinging blade.
  fun delta   : +16.7 (Studio.Feel.score with vs without)
  SPEC (drop into a level spec's "contraptions" array):
    {"type":"seesaw","x":480,"tilt":0.2,"period":2,"nudge":60}
```

The `SPEC` line drops straight into a Studio level spec's `contraptions: [ ... ]`
array.

### Verify

```sh
node check.mjs
```

Serves this directory, loads `index.html` headless (Playwright Chromium via
ANGLE/SwiftShader — resolves from `studio/node_modules`), waits for the scene to
init (`window.__ready`), asserts **zero** page errors, cycles through **all**
contraption types (running the live scene so each one actually moves + interacts),
verifies the canvas rendered (non-black), and writes `out/playground.png`. Exits
non-zero on any error.

---

## How the contraption -> feeling dictionary works

A contraption is more than motion — it's an **emotional payload** the studio's
fun model can reason about. Two SDK pieces make that machine-readable:

### `Studio.Contraptions.meta(type)` — the feeling dictionary

Each registry entry declares:

| field     | meaning                                                                 |
|-----------|-------------------------------------------------------------------------|
| `feeling` | the human-readable emotional payload (e.g. `balance / tension / control`) |
| `lens`    | the design lens it serves (`Challenge` / `Sensation` / `Tension` / …)   |
| `weight`  | the **interest weight** a beat of this type contributes to the fun model |

The current registry:

| type       | feeling                       | lens       | weight |
|------------|-------------------------------|------------|--------|
| `seesaw`   | balance / tension / control   | Challenge  | 7      |
| `launcher` | exhilaration / release        | Sensation  | 9      |
| `crumble`  | urgency / dread               | Tension    | 7      |

The playground surfaces this directly: pick a type and the readout shows its
feeling tags, lens, and weight straight from `meta()`.

### `Studio.Feel` — turning feeling into fun

`Studio.Feel.score(spec)` is a pure, deterministic fun predictor. It walks a
level spec's element placement into an **interest curve**, then scores four
components (engagement / dynamics / arc / flow) into a single `fun` number.

Contraptions plug into this via `Studio.Feel.collectBeats`: each contraption in a
spec registers an **interest beat** at its `x`, tagged by its **type** and
weighted by its registry `weight` (pulled from `meta(type)`). So a higher-weight
machine (the launcher, 9) lifts its window's interest more than a seesaw (7), and
a contraption placed near the curve's natural peak (~84% of the level) raises the
*arc* score. That's the whole loop:

```
contraption type ──meta()──> weight ──collectBeats()──> interest beat
                                              │
                                              ▼
                                   Studio.Feel.score() ──> fun
```

The playground makes this loop visible as a **live delta**: it scores the test
level twice — once with just the slab, once with the slab + the chosen
contraption — and shows `with − without`. That delta *is* the contraption's fun
contribution, the same value the studio's level tuning sees.

`Studio.Feel.contraptionBeats(spec)` is the companion query: it returns each
contraption's `{ type, x, arcPos, feeling, lens, weight, nearPeak }`, so a tool
(or these docs) can report *what feeling sits where* and whether it lands on the
arc peak. The playground uses it for the "beat at x=… (arc …)" hint under the
delta.
