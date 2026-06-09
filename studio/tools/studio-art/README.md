# studio-art

A Studio **brick** providing capability **`art-cohesion`** — a vision-model judge
of a game's VISUAL COHESION. Scaffolded by the Lego forge, then implemented for
real. A brick = a manifest + a run step + a REQUIRED validator (see
`studio/lego/contract.md`).

## What it does
Serves a game's own `src/`, screenshots it headless at a few frames (the
shotlive / `eval.mjs` swiftshader pattern, factored into `../lib/shot.mjs`), and
shows the frames to Gemini, which scores 9 art dimensions 0-10 (ported from
the-platformer's `tools/eval/judge.mjs` rubric): **cohesion, color, character,
depth, environment, hud, lineage, juice, polish**. Visual score = mean(dims)×10
→ 0-100, median-of-N samples to tame VLM variance. **pass ⇔ score ≥ 60.**

It is `perGame` (takes `--game DIR`) and `deterministic:false` (model-judged).

## Degrades gracefully
With **no Gemini creds** (`GEMINI_SA_JSON` absent) it cannot judge cohesion, so
it falls back to a STRUCTURAL check — it still captures the frame and asserts the
game rendered something (non-black) — and passes with a clear "model score
skipped" note. The brick still gates offline.

## Files
- `manifest.json` — the contract: capability, run, **validator**, outputs, deps.
- `validate.mjs` — the **validator** (THE GATE): capture + score, prints
  `{ pass, score, notes, dimensions, ... }`, exits 0/1.
- `tool.mjs` — the **run** step: delegates to `validate.mjs` (a judge brick's
  output IS its verdict, like eval-feel / game-gate).

## Use
```
node studio/lego/dispatch.mjs art-cohesion --game studio/games/ember   # ACCEPT/REJECT + score
node validate.mjs --game ../../games/ember                              # run the validator directly
```
