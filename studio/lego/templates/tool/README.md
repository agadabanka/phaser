# __NAME__

A Studio **brick** providing capability **`__CAPABILITY__`**. Scaffolded by the Lego
forge (`studio/lego/forge.mjs`) from `studio/lego/templates/tool/`.

A brick = a manifest + a run step + a REQUIRED validator. See
`studio/lego/contract.md`.

## Files
- `manifest.json` — the contract: capability, run, **validator**, outputs, deps.
- `tool.mjs` — the **run** step: consumes input, writes the declared `outputs`.
- `validate.mjs` — the **validator** (THE GATE): asserts the outputs exist + are
  structurally sane, prints `{ pass, score, notes }`, exits 0/1. This file is why
  the brick is born gated.

## Use
```
node tool.mjs                                   # produce the output
node studio/lego/dispatch.mjs __CAPABILITY__    # ensure-vendor + run the validator → ACCEPT/REJECT
```

## TODO
1. Implement the real generator in `tool.mjs` (replace the stub).
2. Tighten the structural check in `validate.mjs` (and remove the missing-output
   self-heal once the run step reliably produces the real artifact).
3. Update `manifest.json` `inputs`/`outputs`/`deps`/`deterministic` to match.
