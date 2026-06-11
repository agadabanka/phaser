// Full ISOMETRIC art batch for the Roadwar iso redesign — 2.5D toon cel-shaded:
// 5 iso battlefield backdrops, iso garage/fortress/refinery, iso cars (3 player +
// 3 enemy + warlord boss) — Gemini, chroma-keyed + outlined.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateImage } from './gemini.js';
const GAME = new URL('../../games/roadwar-iso/', import.meta.url);
const ART = new URL('art-src/', GAME), ASSETS = new URL('src/assets/', GAME);
mkdirSync(ART, { recursive: true }); mkdirSync(ASSETS, { recursive: true });
const save = (rel, b64) => { writeFileSync(new URL(rel, GAME), Buffer.from(b64, 'base64')); console.log('  ✔', rel); };
const run = (args, env) => execFileSync('node', args, { stdio: 'inherit', cwd: new URL('.', import.meta.url), env: { ...process.env, ...(env || {}) } });

const ISO = 'TRUE ISOMETRIC projection (2:1 dimetric, classic RTS / Age-of-Empires camera at ~30° from above), TOON CEL-SHADED, bold black outlines, flat bright cartoon colours, simple cel shadows, consistent light from the upper-left.';
const MAG = 'FLAT SOLID MAGENTA (#ff00ff) background ONLY — every non-subject pixel pure magenta. No shadow on the background, no text, no border, no extra objects.';

// 1) five iso battlefield backdrops — a receding iso battle-road, garage end (near
// bottom) to a warlord fortress end (far top), empty (units drawn on top).
const GROUNDS = [
  ['ground-1', 'a sunny DESERT-HIGHWAY iso battlefield: a wide cracked-asphalt road running from the lower-near corner to the upper-far corner, sandy dunes, cacti and tyre-stacks framing the edges'],
  ['ground-2', 'a JUNKYARD iso battlefield: a dirt battle-road between crushed-car heaps, oil puddles and scrap piles'],
  ['ground-3', 'a NEON NIGHT CITY-STREET iso battlefield: a glowing road between neon signs and parked wrecks, dusk sky'],
  ['ground-4', 'a RED-CANYON iso battlefield: a dusty canyon battle-road with rock arches, mesas and a river crossing'],
  ['ground-5', 'a menacing WARLORD-FORTRESS-approach iso battlefield: a scorched battle-road with spike barriers and lava cracks under a dark storm sky'],
];
console.log('— iso backdrops —');
for (const [name, desc] of GROUNDS) {
  if (existsSync(new URL(name + '.jpg', ASSETS))) { console.log('  (exists)', name); continue; }
  const bg = await generateImage(`A ${ISO} EMPTY iso BATTLEFIELD BACKGROUND of ${desc}. NO vehicles, NO characters, NO text, NO UI. The empty battle-road runs from the lower-near corner toward the upper-far corner. Fill the whole frame.`, { aspectRatio: '16:9' });
  save('src/assets/' + name + '.jpg', bg.base64);
}

// 2) iso sprites (keyed) — buildings + cars
const SPRITES = [
  ['car-scout', `A friendly ISOMETRIC toon SCOUT BUGGY battle-car — a small zippy blue dune-buggy with big knobby tyres and a flag, three-quarter iso view. ${ISO}`],
  ['car-brawler', `A friendly ISOMETRIC toon BRAWLER battle-car — a chunky green armored muscle-car with a ram-bar and roll cage, three-quarter iso view. ${ISO}`],
  ['car-gunner', `A friendly ISOMETRIC toon GUNNER battle-car — a yellow technical pickup with a little roof turret, three-quarter iso view. ${ISO}`],
  ['enemy-scout', `An enemy ISOMETRIC toon SCOUT car — a mean red spiked buggy with glowing headlights, three-quarter iso view. ${ISO}`],
  ['enemy-brawler', `An enemy ISOMETRIC toon BRAWLER car — a rusty dark-purple armored bruiser with a spiked plow, three-quarter iso view. ${ISO}`],
  ['enemy-gunner', `An enemy ISOMETRIC toon GUNNER car — a black technical with a menacing cannon, three-quarter iso view. ${ISO}`],
  ['enemy-warlord', `An enemy ISOMETRIC toon WARLORD BOSS WAR-RIG — a huge menacing dark-iron monster-truck battle-rig with spikes, a skull hood ornament, twin smokestacks and a big cannon, three-quarter iso view, fills the frame. ${ISO}`],
  ['garage', `A friendly ISOMETRIC toon GARAGE HQ — a cheerful blue tin garage with a roll-up door, a flag and a fuel pump, three-quarter iso view. ${ISO}`],
  ['fortress', `An enemy ISOMETRIC toon WARLORD FORTRESS HQ — a big menacing dark fortress-bunker with spikes, a skull banner and gun ports, three-quarter iso view. ${ISO}`],
  ['depot', `An ISOMETRIC toon SCRAP REFINERY building — a small industrial shed with a glowing scrap pile, a coin/gear icon and a fuel barrel, three-quarter iso view. ${ISO}`],
];
console.log('— iso sprites —');
for (const [name, prompt] of SPRITES) {
  if (existsSync(new URL(name + '.jpg', ART))) { console.log('  (exists)', name); continue; }
  const img = await generateImage(`${prompt} ${MAG}`, { aspectRatio: '1:1' });
  save('art-src/' + name + '.jpg', img.base64);
}
console.log('— chroma-key —');
run(['key.mjs', ...SPRITES.map(([n]) => `art-src/${n}.jpg:src/assets/${n}.png`)], { ART_GAME: 'roadwar-iso' });
console.log('— outline —');
run(['outline.mjs', ...SPRITES.map(([n]) => `games/roadwar-iso/src/assets/${n}.png`)]);
console.log('ISO ART BATCH DONE');
