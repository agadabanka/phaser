// gen-rts.mjs — full toon-shaded art batch for Roadwar (car RTS):
// 5 battleground backdrops, 3 player cars + 3 enemy cars, player GARAGE + enemy
// FORTRESS, a scrap depot — Gemini, cel-shaded, chroma-keyed. Plus a Lyria
// battle anthem. Projectiles/explosions are baked procedurally in the SDK.
//   node gen-rts.mjs
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateImage } from './gemini.js';

const GAME = new URL('../../games/roadwar/', import.meta.url);
const ART = new URL('art-src/', GAME), ASSETS = new URL('src/assets/', GAME);
mkdirSync(ART, { recursive: true }); mkdirSync(ASSETS, { recursive: true });
const save = (rel, b64) => { writeFileSync(new URL(rel, GAME), Buffer.from(b64, 'base64')); console.log('  ✔', rel); };
const run = (args, env) => execFileSync('node', args, { stdio: 'inherit', cwd: new URL('.', import.meta.url), env: { ...process.env, ...(env || {}) } });

const STYLE = 'TOON CEL-SHADED game art — bold black outlines, flat bright cartoon colours, simple cel shadows, playful Saturday-morning-cartoon style, top-down view.';
const MAGENTA = 'FLAT SOLID MAGENTA (#ff00ff) background ONLY — every non-subject pixel pure magenta. No shadow on the background, no text, no border, no extra objects.';

// 1) five battleground backdrops (top-down terrain, vertical-friendly, no vehicles)
const GROUNDS = [
  ['ground-1', 'a sunny toon DESERT HIGHWAY battlefield seen top-down: cracked asphalt road up the middle, sandy dunes, cacti and tire-stacks at the edges'],
  ['ground-2', 'a toon JUNKYARD battlefield top-down: dirt tracks, crushed-car heaps, oil puddles, scrap piles framing a central lane'],
  ['ground-3', 'a neon toon CITY STREET battlefield at dusk top-down: glowing road, neon signs, parked wrecks, manholes'],
  ['ground-4', 'a toon RED CANYON battlefield top-down: a dusty canyon road, rock arches, mesas, a river crossing'],
  ['ground-5', 'a menacing toon WARLORD FORTRESS approach top-down: scorched battle-road, spike barriers, lava cracks, dark storm sky'],
];
console.log('— backdrops —');
for (const [name, desc] of GROUNDS) {
  if (existsSync(new URL(name + '.jpg', ASSETS))) { console.log('  (exists)', name); continue; }
  const bg = await generateImage(`A ${STYLE} top-down BATTLEFIELD BACKGROUND of ${desc}. Empty battlefield, NO vehicles, NO characters, NO text, NO UI. Vertical composition.`, { aspectRatio: '9:16' });
  save('src/assets/' + name + '.jpg', bg.base64);
}

// 2) cars + buildings + depot (keyed sprites)
const SPRITES = [
  ['car-scout', `A friendly TOON SCOUT BUGGY battle-car, top-down, a small zippy blue dune-buggy with big knobby tyres and a little flag, nose pointing UP. ${STYLE}`],
  ['car-brawler', `A friendly TOON BRAWLER battle-car, top-down, a chunky green armored muscle-car with a ram-bar and roll cage, nose pointing UP. ${STYLE}`],
  ['car-gunner', `A friendly TOON GUNNER battle-car, top-down, a yellow technical pickup with a little roof turret, nose pointing UP. ${STYLE}`],
  ['enemy-scout', `An enemy TOON SCOUT car, top-down, a mean red spiked buggy with glowing headlights, nose pointing DOWN toward the viewer. ${STYLE}`],
  ['enemy-brawler', `An enemy TOON BRAWLER car, top-down, a rusty dark-purple armored bruiser with a spiked plow, nose pointing DOWN. ${STYLE}`],
  ['enemy-gunner', `An enemy TOON GUNNER car, top-down, a black technical with a menacing cannon, nose pointing DOWN. ${STYLE}`],
  ['garage', `A friendly TOON GARAGE HQ building, top-down, a cheerful blue tin garage with a roll-up door, a flag and a fuel pump, viewed from above. ${STYLE}`],
  ['fortress', `An enemy TOON WARLORD FORTRESS HQ, top-down, a big menacing dark fortress-bunker with spikes, a skull banner and gun ports, viewed from above. ${STYLE}`],
  ['depot', `A neutral TOON SCRAP DEPOT, top-down, a small pile of glowing scrap-metal and a fuel barrel with a capture flag. ${STYLE}`],
];
console.log('— sprites —');
for (const [name, prompt] of SPRITES) {
  if (existsSync(new URL(name + '.jpg', ART))) { console.log('  (exists)', name); continue; }
  const img = await generateImage(`${prompt} ${MAGENTA}`, { aspectRatio: (name === 'garage' || name === 'fortress') ? '16:9' : '1:1' });
  save('art-src/' + name + '.jpg', img.base64);
}
console.log('— chroma-key —');
run(['key.mjs', ...SPRITES.map(([n]) => `art-src/${n}.jpg:src/assets/${n}.png`)], { ART_GAME: 'roadwar' });
console.log('— outline pass —');
run(['outline.mjs', ...SPRITES.map(([n]) => `games/roadwar/src/assets/${n}.png`)]);

console.log('— Lyria battle anthem —');
run(['lyria.mjs', '--game', 'games/roadwar', '--out', 'assets/music/anthem.mp3', '--samples', '2', '--prompt',
  'Looping instrumental battle anthem for a toon car-combat RTS called "Roadwar": punchy surf-rock guitars, driving rock drums, brass stabs, heroic and rowdy, cartoon-action energy, no vocals, seamless loop, steady mid-tempo.']);

console.log('ROADWAR ART BATCH DONE');
