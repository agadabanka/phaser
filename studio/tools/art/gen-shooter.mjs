// gen-shooter.mjs — full art batch for Starlance (vertical space shooter):
// 5 nebula-veil backdrops, the player interceptor, 3 enemy types, a boss
// mothership, a power-up — Gemini, chroma-keyed; plus a Lyria synthwave drive.
// Bullets/explosions are baked procedurally in the SDK (no Gemini needed).
//   node gen-shooter.mjs
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateImage } from './gemini.js';

const GAME = new URL('../../games/starlance/', import.meta.url);
const ART = new URL('art-src/', GAME), ASSETS = new URL('src/assets/', GAME);
mkdirSync(ART, { recursive: true }); mkdirSync(ASSETS, { recursive: true });
const save = (rel, b64) => { writeFileSync(new URL(rel, GAME), Buffer.from(b64, 'base64')); console.log('  ✔', rel); };
const run = (args, env) => execFileSync('node', args, { stdio: 'inherit', cwd: new URL('.', import.meta.url), env: { ...process.env, ...(env || {}) } });

const STYLE = 'Painterly synthwave sci-fi game art, luminous neon palette (cyan, magenta, gold, deep violet), soft glow, bold clean rim-light, top-down view.';
const MAGENTA = 'FLAT SOLID MAGENTA (#ff00ff) background ONLY — fill every non-subject pixel pure magenta. No shadow, no text, no border, no extra objects.';

// 1) five nebula-veil backdrops (vertical fields, no characters)
const VEILS = [
  ['veil-1', 'a rose-and-gold dawn nebula with drifting dust and a few far stars'],
  ['veil-2', 'a teal-and-cyan ion cloud with electric filaments and distant galaxies'],
  ['veil-3', 'a violet storm nebula with lightning veins and dark debris fields'],
  ['veil-4', 'a deep-indigo void rift with sparse cold stars and a faint accretion glow'],
  ['veil-5', 'an ominous crimson-and-black collapsing-star field, the Hollow Star glowing far above'],
];
console.log('— backdrops —');
for (const [name, desc] of VEILS) {
  if (existsSync(new URL(name + '.jpg', ASSETS))) { console.log('  (exists)', name); continue; }
  const bg = await generateImage(`Breathtaking ${STYLE} VERTICAL space BACKGROUND of ${desc}, seen looking up as a starfighter climbs through it. Tall composition, depth, NO ships, NO characters, NO text, NO UI.`, { aspectRatio: '9:16' });
  save('src/assets/' + name + '.jpg', bg.base64);
}

// 2) player ship + enemies + boss + powerup (keyed sprites)
const SPRITES = [
  ['ship', `The player STARFIGHTER for a top-down vertical shooter — a sleek crystalline cyan interceptor, arrowhead silhouette, glowing twin engines at the BACK (bottom), nose pointing UP. ${STYLE} Centered, fills ~70% of frame, nose up.`],
  ['enemy-drone', `A small alien DRONE enemy, top-down, a magenta-and-chrome wasp-like pod with a single glowing eye, nose pointing DOWN toward the viewer. ${STYLE}`],
  ['enemy-dart', `A fast alien DART fighter enemy, top-down, a slim violet blade-ship with swept fins, nose pointing DOWN. ${STYLE}`],
  ['enemy-turret', `A chunky alien GUN-POD enemy, top-down, a round armored gold-and-black turret-orb bristling with tiny barrels. ${STYLE}`],
  ['boss', `A massive alien MOTHERSHIP boss for a top-down shooter — a wide ominous dreadnought, dark chrome hull with glowing crimson core and cannon ports along its underside (bottom edge), facing DOWN toward the player. Symmetric, fills the full width. ${STYLE}`],
  ['powerup', `A glowing POWER-UP pickup capsule, a small radiant cyan diamond core in a golden ring, sparkling. ${STYLE}`],
];
console.log('— sprites —');
for (const [name, prompt] of SPRITES) {
  if (existsSync(new URL(name + '.jpg', ART))) { console.log('  (exists)', name); continue; }
  const img = await generateImage(`${prompt} ${MAGENTA}`, { aspectRatio: name === 'boss' ? '16:9' : '1:1' });
  save('art-src/' + name + '.jpg', img.base64);
}

// key them all out -> src/assets/*.png
console.log('— chroma-key —');
const keyJobs = SPRITES.map(([n]) => `art-src/${n}.jpg:src/assets/${n}.png`);
run(['key.mjs', ...keyJobs], { ART_GAME: 'starlance' });

console.log('— outline (silhouette pop) —');
run(['outline.mjs', ...SPRITES.map(([n]) => `games/starlance/src/assets/${n}.png`)]);

console.log('— Lyria synthwave drive —');
run(['lyria.mjs', '--game', 'games/starlance', '--out', 'assets/music/drive.mp3', '--samples', '2', '--prompt',
  'Looping instrumental synthwave drive for a vertical space shooter called "Starlance": pulsing arpeggiated bassline, bright neon analog synth lead, four-on-the-floor electronic drums, propulsive and heroic, climbing energy, no vocals, seamless loop, steady driving tempo.']);

console.log('STARLANCE ART BATCH DONE');
