// Ember hero ANIMATION frames — extends the gen-ember pipeline to produce the
// sprite-animation sources (idle / 6-frame RUN strip / jump), reference-conditioned
// on the EXISTING hero so the frames stay the same "Ember" magma-golem
// (same cracked dark-rock body, glowing orange lava veins, head flame tuft, bold
// cartoon outline, friendly glowing eyes). All on a flat magenta (#ff00ff) chroma
// field so key.mjs / key-anim.mjs can cut + slice cleanly.
//
// Auth: GEMINI_SA_JSON (env).  Outputs raw images to ../../games/ember/art-src/.
//   node gen-ember-anim.mjs            # all jobs
//   node gen-ember-anim.mjs run idle   # a subset
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { generateImage } from './gemini.js';

const OUT = new URL('../../games/ember/art-src/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const save = (name, b64) => { const p = new URL(name, OUT); writeFileSync(p, Buffer.from(b64, 'base64')); console.log('  saved', name); return p; };
// Reference = the locked hero (the model sheet). Prefer the clean PNG (already keyed)
// then fall back to the source jpg; both are the same character.
const refOf = (name) => existsSync(new URL(name, OUT)) ? [{ base64: readFileSync(new URL(name, OUT)).toString('base64'), mimeType: name.endsWith('png') ? 'image/png' : 'image/jpeg' }] : [];
const HEROREF = (existsSync(new URL('../../games/ember/src/assets/hero.png', import.meta.url))
  ? [{ base64: readFileSync(new URL('../../games/ember/src/assets/hero.png', import.meta.url)).toString('base64'), mimeType: 'image/png' }]
  : []).concat(refOf('hero.jpg'));

// The character lock — repeated in every prompt so nano-banana-pro stays on-model.
const CHAR = 'Use the attached image as the EXACT character reference: the SAME hero "Ember" — a small brave cute molten-ember golem with a chunky rounded dark volcanic-rock body cracked with glowing orange/amber lava veins, a little flame tuft on its head, bright friendly glowing orange eyes, stubby arms and legs, warm inner glow. Keep IDENTICAL palette, the bold clean cartoon outline, the same proportions and size. Side view facing RIGHT, full body, highly readable silhouette.';
const BG = 'FLAT SOLID MAGENTA (#ff00ff) background ONLY — fill every pixel that is not the character with pure magenta. No shadow, no ground line, no text, no border, no extra characters.';

const JOBS = {
  // A 6-frame RUN cycle as ONE even horizontal strip. We ask for even spacing +
  // identical size, but Gemini strips drift — the keyer (key-anim.mjs) re-packs
  // each detected frame box into a uniform grid so generateFrameNumbers works.
  async run() {
    console.log('hero RUN strip (6 frames, magenta key)...');
    const p = `${CHAR} Produce a horizontal SPRITE STRIP: a 6-FRAME RUN CYCLE in ONE single row, evenly spaced left-to-right, the SAME character at the SAME size in every frame. Each frame is a distinct running pose cycling the legs and arms (contact, down, passing, up — a believable run loop), leaning slightly forward as if dashing. Equal gaps between frames; do NOT overlap frames. ${BG} No separators or numbers between frames.`;
    const { mimeType, base64 } = await generateImage(p, { aspectRatio: '16:9', refs: HEROREF });
    save(`hero_run.${mimeType.includes('png') ? 'png' : 'jpg'}`, base64);
  },
  async idle() {
    console.log('hero IDLE frame (magenta key)...');
    const p = `${CHAR} Pose: standing IDLE at rest, confident and ready, weight settled, arms relaxed at its sides, calm. ONE single centered character. ${BG}`;
    const { mimeType, base64 } = await generateImage(p, { aspectRatio: '1:1', refs: HEROREF });
    save(`hero_idle.${mimeType.includes('png') ? 'png' : 'jpg'}`, base64);
  },
  async jump() {
    console.log('hero JUMP frame (magenta key)...');
    const p = `${CHAR} Pose: mid-air JUMP — pushing upward with legs tucked up and arms raised, a dynamic leaping airborne pose. ONE single centered character. ${BG}`;
    const { mimeType, base64 } = await generateImage(p, { aspectRatio: '1:1', refs: HEROREF });
    save(`hero_jump.${mimeType.includes('png') ? 'png' : 'jpg'}`, base64);
  },
};

const which = process.argv.slice(2);
const run = which.length ? which : Object.keys(JOBS);
for (const j of run) { if (!JOBS[j]) { console.log('skip unknown', j); continue; } await JOBS[j](); }
console.log('done:', run.join(', '));
