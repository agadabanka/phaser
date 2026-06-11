// Nimbus Climb — per-level backdrops (issues #1/#2: "every level looks the same").
// Five distinct skies in the SAME painterly art direction: the original
// backdrop.jpg is passed as a style reference so the set stays coherent.
// Idempotent: skips any backdrop already on disk.
//   node gen-backdrops.mjs        (from games/nimbus/)
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { generateImage } from '../../tools/art/gemini.js';

const ASSETS = new URL('src/assets/', import.meta.url);
const STYLE = 'Painterly hand-painted 2D game art, soft dreamy pastel palette, gentle rim light, bold clean cloud shapes.';
const MATCH = 'Match the painting style, brushwork and overall art direction of the attached reference image EXACTLY — same game, different sky. Full-bleed BACKGROUND only: NO characters, NO text, NO UI, NO borders, NO split panels.';
const REF = [{ base64: readFileSync(new URL('backdrop.jpg', ASSETS)).toString('base64'), mimeType: 'image/jpeg' }];

const SCENES = [
  ['backdrop-1.jpg', 'Low-altitude cloudscape at golden SUNRISE seen from inside the sky: rolling foothills of plump white-and-peach cumulus puffs like soft pillows filling the lower half, a warm sun rising low through them, gentle pale-gold morning light, cheerful and innocent. Palette: peach, cream, pale gold, soft cerulean.'],
  ['backdrop-2.jpg', 'Windswept bright MID-MORNING sky: long horizontal wind-streaked cirrus ribbons and curling painted zephyr swirls racing across a fresh cerulean-teal sky, small cloud puffs bending in the breeze, visible flowing wind lines, airy and energetic. Palette: cerulean, teal, white, a hint of mint green.'],
  ['backdrop-3.jpg', 'Mysterious veiled MIST-SPIRE cloudscape at violet dusk: tall narrow spires of lavender-violet cloud rising through layered banks of glowing indigo mist, a soft pale moon glowing high above, hushed and dreamy. Palette: lavender, violet, deep indigo, silver moonlight.'],
  ['backdrop-4.jpg', 'Brooding STORM-FRONT cloudscape: massive dark slate-indigo thunderhead shelves stacked like cliff ledges, pale-gold lightning glow flickering deep inside the clouds, distant rain curtains far below, dramatic and tense yet still soft and painterly. Palette: slate blue, indigo, charcoal, pale-gold lightning glow.'],
  ['backdrop-5.jpg', 'Radiant heavenly SUMMIT above the cloud sea at golden hour: one brilliant glowing sun like a great bell high in the sky, sweeping god-rays, tops of golden-cream clouds rolling away below, sparkling warm air, triumphant and serene. Palette: radiant gold, cream, amber, soft sky blue.'],
];

for (const [name, scene] of SCENES) {
  const out = new URL(name, ASSETS);
  if (existsSync(out)) { console.log('  (exists)', name); continue; }
  console.log('— generating', name, '—');
  const img = await generateImage(`Breathtaking ${STYLE} BACKGROUND for a sky-climbing platformer: ${scene} Vertical sense of ascent. ${MATCH}`, { aspectRatio: '16:9', refs: REF });
  writeFileSync(out, Buffer.from(img.base64, 'base64'));
  console.log('  ✔', name);
}
console.log('BACKDROPS DONE');
