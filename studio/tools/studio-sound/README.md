# studio-sound

A Studio **brick** providing capability **`music`** — a structural check that a
game WIRES sound. A brick = a manifest + a run step + a REQUIRED validator (see
`studio/lego/contract.md`).

## What it does
Statically scans a game's source (`src/game/*.js` + any `sound.js`/audio module,
skipping `vendor/`) for the `Studio.Audio.sfx('<event>')` calls that cover the
key gameplay moments — **jump · coin · hit (stomp OR hurt) · win** — plus a
music/bed hook (`Studio.Audio.music(...)`). The key SFX events are the hard
requirement; the music bed is a soft bonus surfaced as a note.
**pass ⇔ all key SFX events are present.**

No audio rendering — it is a deterministic source check (no network, no clock, no
Gemini), so it gates identically offline and online. It is `perGame` (`--game`).

## Files
- `manifest.json` — the contract.
- `validate.mjs` — the **validator** (THE GATE): scans + scores, prints
  `{ pass, score, notes, covered, sfxWired, musicBed }`, exits 0/1.
- `tool.mjs` — the **run** step: delegates to `validate.mjs`.

## Use
```
node studio/lego/dispatch.mjs music --game studio/games/ember   # ACCEPT/REJECT
node validate.mjs --game ../../games/ember                      # run the validator directly
```
