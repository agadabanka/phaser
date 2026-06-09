# The Tool Contract ("Lego")

Every Studio tool is a **brick**: a `manifest` + a `run` step + a **REQUIRED** `validate()`.
The whole architecture exists to enforce one invariant:

> **A tool is only registerable if it has a validator. The dispatcher runs that
> validator as the accept/reject gate.**

A brick with no validator cannot enter the registry, cannot be dispatched, and
therefore cannot influence the assembly line. Every brick is born gated because
the forge stamps it from a template that already contains a validator.

## Manifest schema

A manifest is a JSON object (`studio/tools/<name>/manifest.json`) with these fields:

| field           | type      | req | meaning                                                                 |
|-----------------|-----------|-----|-------------------------------------------------------------------------|
| `capability`    | string    | yes | the single capability this brick provides (e.g. `sprite-animation`). Unique across the registry. |
| `name`          | string    | yes | the brick's name == its directory name under `studio/tools/`.           |
| `dir`           | string    | yes | path to the tool dir, relative to studio root (e.g. `tools/sprite-studio`). |
| `run`           | string    | yes | the command that PRODUCES the tool's output (e.g. `node gen.mjs`). Run from `dir`. |
| `validator`     | string    | **YES** | the command that JUDGES the output (e.g. `node check.mjs`). Run from `dir`. **Must be present and non-empty — this is the invariant.** |
| `inputs`        | string    | no  | human description of what the run step consumes (a prompt, a game dir, a sheet). |
| `outputs`       | string[]  | yes | the declared artifacts the run step writes, as globs relative to `dir` (e.g. `["out/*-sheet.png"]`). The validator asserts these exist. |
| `deps`          | string[]  | no  | other capabilities this brick depends on. `[]` if none.                 |
| `deterministic` | boolean   | yes | whether the validator's verdict is reproducible run-to-run (true) or advisory/model-judged (false). |

## The rules

1. **`validate()` is mandatory.** `registry.register(manifest)` THROWS if
   `manifest.validator` is missing or empty. There is no "register now, gate
   later". (Enforced in `registry.mjs`.)

2. **The validator is the gate.** A validator is a node script that:
   - prints a single JSON **verdict** to stdout, and
   - sets its **exit code**: `0` = pass, non-zero = fail.
   The dispatcher reads BOTH (verdict + exit code) and emits `ACCEPT` / `REJECT`.

   Recognised verdict shapes (the dispatcher normalises all of them):
   - `{ "pass": bool, ... }`            — structural checkers (sprite-studio, contraptions)
   - `{ "verdict": { "webgl": bool, "canvas": bool }, ... }` — per-game gate (eval.mjs)
   - `{ "ok": bool, ... }`              — soft scorers (feel.mjs; always exits 0)
   - any object with a numeric `score`/`fun`/`mean` is surfaced as the score.

3. **The validator is reproducible.** Given the same inputs + deps it returns the
   same verdict. Model-judged or soft steps set `deterministic:false` and must
   degrade gracefully (e.g. skip with a note) when creds/network are absent, so
   the structural half still gates offline.

4. **Runnable from a fresh clone.** A brick must validate on a clean checkout.
   Runtime deps (the vendored `phaser.min.js` + `studio.js`) are either committed
   in the tool dir OR restored by the dispatcher/forge **ensure-vendor** step,
   which copies them from `studio/games/ember/src/vendor/` when absent.
   (Gotcha: those vendor files are gitignored in some tool dirs, so a reset wipes
   them and the headless validator 404s with "Phaser is not defined" — ensure-vendor
   is the fix, and it must run BEFORE the validator.)

## Lifecycle

```
need a capability
      │
      ▼
dispatch <capability> ──hit──▶ ensure-vendor ──▶ run validator ──▶ ACCEPT / REJECT
      │
     miss
      │
      ▼
forge <capability> <name>  ── copies templates/tool/ (validator INCLUDED) ──▶
      register(manifest)  ── THROWS unless validator present ──▶  brick is gated
```

The forge cannot produce an ungated brick: the template ships `validate.mjs`, the
manifest's `validator` field is filled to `node validate.mjs`, and `register()`
rejects anything without it.
