// Ask Gemini to score the rendered RUN frames for a smooth, on-model run cycle.
// Uses the in-game crops captured by validate-anim.mjs (out/anim-crop*.png) plus
// the original hero as the on-model reference. node judge-anim.mjs
import { readFileSync, existsSync } from 'node:fs';
import { analyzeImages } from './gemini.js';

const OUT = new URL('../../games/ember/out/', import.meta.url);
const HERO = new URL('../../games/ember/src/assets/hero.png', import.meta.url);
const b64 = (u) => readFileSync(u).toString('base64');

const images = [{ base64: b64(HERO), mimeType: 'image/png', label: 'REFERENCE Ember hero (on-model target)' }];
for (let i = 0; i < 7; i++) {
  const u = new URL(`anim-crop${i}.png`, OUT);
  if (existsSync(u)) images.push({ base64: b64(u), mimeType: 'image/png', label: `in-game RUN frame ${i}` });
}

const prompt = `IMAGE 1 is the reference design for a game hero "Ember" (a molten-rock golem).
The remaining images are consecutive in-game frames of that hero running, captured live in the molten-cave game.
Judge TWO things and answer concisely:
1) ON-MODEL: do the running frames depict the SAME character as the reference (same cracked dark-rock body, glowing orange lava veins, head flame, glowing eyes, bold cartoon outline, palette)?
2) SMOOTH RUN CYCLE: across the running frames, do the limbs (legs/arms) clearly cycle through a believable run, frame to frame?
Give a single overall score "smooth on-model run cycle: X/10" and one sentence of justification.`;

const out = await analyzeImages(images, prompt);
console.log(out);
