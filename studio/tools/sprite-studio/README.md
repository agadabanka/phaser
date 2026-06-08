# Sprite Studio

A standalone, self-contained tool to **develop**, **animate** and — the core ask
— **validate** character sprite animations. It's the animation analogue of the
Contraption Playground: a live Phaser bench plus a headless verifier and an
AI-assist generator, all in this one directory.

It has four parts:

1. **A live studio** (`index.html` + `app.js`) — boots a Phaser scene, loads a
   **spritesheet** as a texture, defines named animations (`idle` / `run` / `jump`)
   as frame ranges, and plays them on a real sprite. Buttons switch anim, a
   **frame scrubber** steps frame-by-frame, and a readout shows the current frame,
   fps, frame counts and cell size. Editing any control rebuilds + replays live.
2. **`validate(sheet)`** — surfaced in the UI (the "Validate sheet" button) and
   reused by the checker. Two halves: **structural** (deterministic, offline) and
   **motion/quality** (Gemini reads a contact sheet). See [Validation](#validation).
3. **`gen.mjs`** — turns a plain-English character description into a uniform
   spritesheet PNG (a ~6-frame run strip + idle + jump), generated with Gemini on a
   magenta key field, then chroma-keyed + sliced.
4. **`check.mjs`** — a headless verifier (Playwright Chromium via
   ANGLE/SwiftShader). Loads the studio, asserts **zero** page errors, plays every
   anim, runs `validate()`, and writes screenshots + per-anim contact sheets to
   `out/`.

Everything reuses **vendored copies** of `phaser.min.js` + `studio.js` (copied
from `studio/games/ember/src/vendor/`) and the shared `anim-core.js`, so the tool
is standalone — open `index.html` and it runs against the bundled sample sheet.

---

## The develop -> animate -> validate workflow

```
                ┌──────────────────────────────────────────────────────┐
   (optional)   │  node gen.mjs "a little robot"                        │
   GENERATE  ──▶│   Gemini -> idle/run/jump strips on magenta -> key +  │
                │   slice -> out/<slug>-sheet.png + <slug>-sheet.json    │
                └───────────────────────┬──────────────────────────────┘
                                        │  (or just use assets/sample-hero.png)
                                        ▼
   DEVELOP   ──▶  open index.html: set the sheet URL + frameWidth/frameHeight +
                  frame count, click "Load sheet". The sprite appears on a
                  checkerboard stage.
                                        │
                                        ▼
   ANIMATE   ──▶  pick idle / run / jump; tweak each anim's start/end/fps/loop and
                  watch it replay live; drag the SCRUBBER to inspect a single frame.
                  The readout reports current frame, fps, frame counts, cell size.
                                        │
                                        ▼
   VALIDATE  ──▶  click "Validate sheet" for the STRUCTURAL verdict (PASS/FAIL +
                  per-check detail). For the full verdict incl. the Gemini
                  MOTION/quality read, run:  node check.mjs   (or
                  node check.mjs --sheet=out/<slug>-sheet.json for a generated one).
```

The animator's day: **generate or drop in** a sheet → **dial the frame ranges**
until idle/run/jump read right in the live preview → **validate** to catch the
defects the eye misses (an un-keyed frame, leftover magenta, an off-model frame)
and get a numeric motion score before the sheet ships into a game.

---

## Run it

### The studio (browser)

Serve this directory over HTTP (the SDK + canvas pixel readback need a real
origin) and open `index.html`:

```sh
cd studio/tools/sprite-studio
python3 -m http.server 8080
# then open http://127.0.0.1:8080/
```

It opens on the **bundled sample sheet** (`assets/sample-hero.png` — a 64×64,
15-frame "Spark" elemental: idle 0–3, run 4–11, jump 12–14). To use your own:
type its URL/path + `frame W`/`frame H`/`frame count` and click **Load sheet**.

`?r=canvas` or `?r=webgl` forces a renderer (default is `Phaser.AUTO`).

The studio exposes for tooling/debugging:
`window.validate(sheet)`, `window.__ready`, and `window.__ss` (`.play(name)`,
`.setSheet(desc)`, `.state()`, `.contactSheet(name?)`, `.frameStats()`,
`.validate()`).

### Generate a sheet (CLI)

```sh
node gen.mjs "a little robot"                 # idle/run/jump -> out/a-little-robot-sheet.png
node gen.mjs "a knight" path/to/modelsheet.png   # ref-conditioned to stay on-model
```

Auth is `GEMINI_SA_JSON` (or `GOOGLE_APPLICATION_CREDENTIALS` / `GEMINI_API_KEY`),
the same as the rest of the art pipeline. It generates three strips on a flat
**magenta** field, chroma-keys the magenta out (the `tools/art/key.mjs` recipe),
**segments** each strip into frames (gap detection, falling back to even columns),
and packs them into ONE uniform `frameWidth × frameHeight` sheet. It prints the
cell dims + per-anim frame indices and a ready `this.load.spritesheet(...)` line,
and writes a `*-sheet.json` descriptor you can paste into the studio.

**No creds?** It prints a clear message pointing at the bundled sample and
`make-sample.mjs` — it never crashes.

> Note: each anim is a separate generation, so cross-strip consistency and
> per-strip framing vary. That's exactly what `validate()` is for — generate,
> then validate, and regenerate any anim the validator flags.

### Regenerate the bundled sample

```sh
node make-sample.mjs        # rewrites assets/sample-hero.png (deterministic, no creds needed)
```

### Verify (headless)

```sh
node check.mjs                                   # validates the bundled sample
node check.mjs --sheet=out/a-little-robot-sheet.json   # validates a generated sheet
```

Serves this directory, loads `index.html` headless, waits for the scene
(`window.__ready`), asserts **zero** page errors, **plays each anim and asserts it
actually animates** (frame advances + stays in range), runs `window.validate()`,
then runs the **Gemini motion read** on each anim's contact sheet (structural-only
with a clear note if creds are absent — never a crash). Writes `out/preview.png`,
`out/contact-all.png`, `out/contact-<anim>.png`, and `out/check-report.json`.
Exits non-zero on any page error, animation failure, or structural failure (and,
when creds are present, on a failed motion verdict).

---

## Validation

`validate(sheet)` is the heart of the tool. A "sheet" is a descriptor:

```json
{
  "url": "assets/sample-hero.png",
  "frameWidth": 64, "frameHeight": 64, "frameCount": 15,
  "anims": {
    "idle": { "start": 0,  "end": 3,  "frameRate": 6,  "repeat": -1 },
    "run":  { "start": 4,  "end": 11, "frameRate": 17, "repeat": -1 },
    "jump": { "start": 12, "end": 14, "frameRate": 12, "repeat": 0  }
  }
}
```

### Structural (deterministic, offline) — `SpriteCore.validateStructural`

The studio reads the loaded texture's pixels, buckets each frame's pixels
(transparent / opaque / magenta / content) via `SpriteCore.classifyPixel`, and
runs these checks (shared verbatim between the browser and `check.mjs`):

| check | what it catches |
|-------|-----------------|
| **equal frame cells** | the sheet divides evenly into `frameWidth × frameHeight` (so every cell is the same size) |
| **frame count matches expected** | the declared/sliced count equals the descriptor's `frameCount` |
| **anim ranges in-bounds** | no `idle/run/jump` range points past the last frame |
| **no fully-transparent frames** | a blank / missing frame (≈100% transparent) |
| **alpha channel present** | a fully-**opaque** frame ⇒ the magenta was never keyed (no transparent surround) |
| **no leftover magenta** | residual `#f0f` key pixels (key failed / wrong chroma), > 0.5% of a frame |

### Motion / quality (Gemini) — `gemini-validate.mjs`

`check.mjs` composes each anim's frames into a labeled **contact sheet** (built by
the studio's `buildContactSheet`) and asks `gemini.js analyzeImages`: *do these
frames read as a smooth `<run|idle|jump>` cycle of ONE on-model character
(consistent silhouette / palette)? score 1–10, list any broken / off-model
frames.* It returns `{ score, smooth, onModel, brokenFrames, notes }`; a verdict
**passes** at `score ≥ 6 && onModel`. With no creds it runs structural-only and
says so.

### Sample `validate()` output

Bundled sample, full run (`node check.mjs`) — **PASS**:

```
STRUCTURAL pass: True
   OK equal frame cells (sheet divides evenly into frameWidth x frameHeight)   960x64 / 64x64 = 15 x 1 cells
   OK frame count matches expected (15)                                        declared=15, grid holds=15, expected=15
   OK all anim frame ranges in-bounds (0..14)                                  idle, run, jump OK
   OK no fully-transparent frames                                              all 15 frames have content
   OK alpha channel present (no fully-opaque/un-keyed frame)                   every frame has transparent surround
   OK no leftover magenta key pixels                                           clean (no #f0f magenta)
MOTION:
   idle  score 9 pass True onModel True  "smooth ... subtle head movement and a clear blink ... consistent and on-model"
   run   score 9 pass True onModel True  "smooth vertical bobbing and squash-and-stretch ... consistent across all frames"
   jump  score 7 pass True onModel True  "squash and stretch convey the motion ... consistent character design"
```

A deliberately broken sheet (an un-keyed solid frame, a magenta-leftover frame, an
empty frame) correctly **FAILS**:

```
STRUCTURAL pass: False
   XX no fully-transparent frames                       empty frames: 2
   XX alpha channel present (no fully-opaque/un-keyed)  fully-opaque frames: 0 (was the magenta keyed out?)
   XX no leftover magenta key pixels                    magenta in frames: 1 (7.9%)
MOTION: idle score 1 (broken [0,1]) · run score 1 (broken [0,1,2,3])
```

---

## Files

| file | role |
|------|------|
| `index.html` + `app.js` | the live browser studio (load sheet, define/preview anims, scrubber, readout, `validate()` button) |
| `anim-core.js` | shared (browser + Node) anim model + `validateStructural` + `classifyPixel` — one source of truth for "valid" |
| `gemini-validate.mjs` | the Gemini motion/quality half of validate (contact-sheet read) |
| `gen.mjs` | AI-assist: description -> generated, keyed, sliced uniform spritesheet PNG + descriptor |
| `make-sample.mjs` | bakes the bundled `assets/sample-hero.png` (deterministic, offline) |
| `check.mjs` | headless verifier — 0-error gate + per-anim animation assert + `validate()` + screenshots |
| `assets/sample-hero.png` | the bundled default sheet (15 frames: idle/run/jump) |
| `phaser.min.js`, `studio.js` | vendored standalone copies of the Arcade Phaser build + Studio SDK |
| `out/` | checker artifacts: `preview.png`, `contact-*.png`, `check-report.json`, + `gen.mjs` sheets |
