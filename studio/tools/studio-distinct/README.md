# studio-distinct

A Studio **brick** providing capability **`distinctness`** — a vision-model judge
of how UNIQUE a game's identity is. Scaffolded by the Lego forge, then
implemented for real. A brick = a manifest + a run step + a REQUIRED validator
(see `studio/lego/contract.md`).

## What it does
Ported from jazz's `tools/game-diff.mjs` (UNIQUENESS axes) + `feel-judge.mjs`
(the A-vs-B vision move). Two modes:
- **vs-sibling** (`--vs DIR2`, or a sibling game auto-found under `games/`):
  captures frames of BOTH games and scores how UNIQUE the first is vs the second.
- **vs-baseline** (no sibling): captures the one game's frames and scores how
  distinct it looks versus the GENERIC stock-platformer baseline (a stored text
  anchor — "default brown-blocks clone").

Axes (0-10 each): **verb, protagonist, enemies, palette, artStyle,
worldIdentity**. Uniqueness = mean(axes)×10 → 0-100, median-of-N. **pass ⇔
score ≥ 50.** It is `perGame` and `deterministic:false` (model-judged).

## Degrades gracefully
With **no Gemini creds** it falls back to a STRUCTURAL identity check from
`GAME_META.json` (a named hero + verb + tagline ⇒ a distinct identity on paper)
and passes with a "model score skipped" note. Still gates offline.

## Files
- `manifest.json` — the contract.
- `validate.mjs` — the **validator** (THE GATE): capture + score, prints
  `{ pass, score, notes, axes, distinct, ... }`, exits 0/1.
- `tool.mjs` — the **run** step: delegates to `validate.mjs`.

## Use
```
node studio/lego/dispatch.mjs distinctness --game studio/games/ember     # vs baseline
node validate.mjs --game ../../games/ember --vs ../../games/jazz          # vs a sibling
```
