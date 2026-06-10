// Nimbus Climb — the FULL art batch (backdrop, animated hero, enemy, texture
// kit, Lyria music) through the existing pipelines, cloud-themed.  Idempotent:
// skips any artifact already present.  node nimbus-art.mjs
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateImage } from './gemini.js';

const GAME = new URL('../../games/nimbus/', import.meta.url);
const ART = new URL('art-src/', GAME);
const ASSETS = new URL('src/assets/', GAME);
mkdirSync(ART, { recursive: true });
mkdirSync(ASSETS, { recursive: true });
const save = (rel, b64) => { writeFileSync(new URL(rel, GAME), Buffer.from(b64, 'base64')); console.log('  ✔', rel); };
const run = (args, env) => execFileSync('node', args, { stdio: 'inherit', cwd: new URL('.', import.meta.url), env: { ...process.env, ...(env || {}) } });

const STYLE = 'Painterly hand-painted 2D game art, soft dreamy dawn-pastel sky palette (peach, lavender, pale gold, cerulean), gentle rim light, bold clean cartoon shapes.';
const CHAR = 'The hero "Nimbi" — a small brave wind-spirit kid made of cloud: a plump rounded white-cumulus puff body with soft blue-grey under-shading, one little swirl curl on top of the head, big friendly dark eyes, rosy cheeks, stubby puffy arms, a tiny trailing pale-gold zephyr scarf, feet hidden in a wisp of cloud. Bold clean cartoon outline, highly readable silhouette, side view facing RIGHT, full body.';
const MAGENTA = 'FLAT SOLID MAGENTA (#ff00ff) background ONLY — fill every pixel that is not the subject with pure magenta. No shadow, no ground, no text, no border, no extra characters.';

console.log('— 1/6 backdrop —');
if (!existsSync(new URL('backdrop.jpg', ASSETS))) {
  const bg = await generateImage(`Breathtaking ${STYLE} BACKGROUND of a towering cloudscape at golden dawn seen from inside the sky: colossal soft cumulus towers rising past the frame, layered mist banks, a few tiny distant floating islets, warm god-rays from the upper right, the faint glow of a sun high above. Vertical sense of ascent. NO characters, NO text, NO UI.`, { aspectRatio: '16:9' });
  save('src/assets/backdrop.jpg', bg.base64);
} else console.log('  (exists)');

console.log('— 2/6 hero design + keyed ref —');
if (!existsSync(new URL('hero.jpg', ART))) {
  const hero = await generateImage(`${CHAR} ${STYLE} Standing relaxed idle pose. ${MAGENTA}`, { aspectRatio: '1:1' });
  save('art-src/hero.jpg', hero.base64);
}
run(['key.mjs', 'art-src/hero.jpg:src/assets/hero.png'], { ART_GAME: 'nimbus' });

console.log('— 3/6 hero animation frames —');
const HEROREF = [{ base64: readFileSync(new URL('hero.png', ASSETS)).toString('base64'), mimeType: 'image/png' }];
const LOCK = `Use the attached image as the EXACT character reference: the SAME cloud-spirit "Nimbi" — identical palette, identical bold cartoon outline, identical proportions and size. ${STYLE}`;
const JOBS = {
  'hero_run.jpg': `${LOCK} A 6-frame RUN CYCLE of Nimbi sprinting to the RIGHT, as ONE single horizontal strip of 6 evenly spaced full-body poses (contact, down, push-off, airborne, contact opposite, up) — scarf and cloud-wisps trailing with the motion. All 6 the SAME size. ${MAGENTA}`,
  'hero_idle.jpg': `${LOCK} A single relaxed IDLE pose, gently floating, scarf drifting. ${MAGENTA}`,
  'hero_jump.jpg': `${LOCK} A single JUMP pose rising upward, arms up, scarf streaming below, cloud-wisp feet stretched. ${MAGENTA}`,
};
for (const [name, prompt] of Object.entries(JOBS)) {
  if (existsSync(new URL(name, ART))) { console.log('  (exists)', name); continue; }
  const img = await generateImage(prompt, { refs: HEROREF, aspectRatio: name.includes('run') ? '16:9' : '1:1' });
  save('art-src/' + name, img.base64);
}
run(['key-anim.mjs'], { ART_GAME: 'nimbus' });

console.log('— 4/6 enemy —');
if (!existsSync(new URL('enemy.jpg', ART))) {
  const en = await generateImage(`A small grumpy STORM-IMP enemy for a 2D platformer: a round dark indigo-slate thundercloud puff with an angry unibrow, tiny crackling pale-gold lightning sparks in its body, small glowing pale eyes, no limbs. ${STYLE} Bold cartoon outline, side view. ${MAGENTA}`, { aspectRatio: '1:1' });
  save('art-src/enemy.jpg', en.base64);
}
run(['key.mjs', 'art-src/enemy.jpg:src/assets/enemy.png'], { ART_GAME: 'nimbus' });

console.log('— outline pass (silhouette) —');
run(['outline.mjs', 'games/nimbus/src/assets/hero_sheet.png', 'games/nimbus/src/assets/enemy.png', 'games/nimbus/src/assets/hero.png']);

console.log('— 5/6 texture kit —');
run(['../texture-kit/tool.mjs', '--game', 'games/nimbus']);

console.log('— 6/6 Lyria sky loop —');
run(['lyria.mjs', '--game', 'games/nimbus', '--out', 'assets/music/sky.mp3', '--samples', '2', '--prompt',
  'Looping instrumental background music for a dreamy sky-climbing platformer called "Nimbus Climb": weightless airy ambient, warm harp arpeggios, soft wordless choir pads, gentle glockenspiel sparkles, slow hopeful build, floating and serene with a sense of ascent, no vocals, seamless loop, steady gentle tempo.']);

console.log('NIMBUS ART BATCH DONE');
