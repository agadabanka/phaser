/*
 * Grovekeep art batch — PIXEL ART via the new pipeline: Gemini render (magenta
 * key plate) → key.mjs (chroma → alpha) → pixelize.mjs (coarse grid + palette).
 * 20 characters + 10 structures + 5 glade backdrops + the wordmark.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateImage } from './gemini.js';

const GAME = new URL('../../games/grovekeep/', import.meta.url);
const ART = new URL('art-src/', GAME), ASSETS = new URL('src/assets/', GAME);
mkdirSync(ART, { recursive: true }); mkdirSync(new URL('menu/', ASSETS), { recursive: true });
const save = (rel, b64) => { writeFileSync(new URL(rel, GAME), Buffer.from(b64, 'base64')); console.log('  ✔', rel); };
const run = (args, env) => execFileSync('node', args, { stdio: 'inherit', cwd: new URL('.', import.meta.url), env: { ...process.env, ...(env || {}) } });

const PIX = 'retro 16-bit PIXEL ART, chunky visible pixels, limited warm forest palette (mossy greens, bark browns, honey golds), crisp clean silhouette, charming cozy fantasy style';
const MAG = 'FLAT SOLID MAGENTA (#ff00ff) background ONLY — every non-subject pixel pure magenta. No shadow on the background, no text, no border.';

// ---- 20 CHARACTERS (the rootlings + grove creatures) ----
const CHARS = [
  ['fern',    'FERN the gatherer — a small leaf-cloaked forest villager girl with a woven basket of berries'],
  ['bram',    'BRAM the builder — a stocky forest villager with a wooden mallet and an acorn-shell hard hat'],
  ['moss',    'ELDER MOSS — a wise old villager with a long mossy beard and a gnarled staff'],
  ['pip',     'PIP — a tiny villager child chasing a glowing firefly'],
  ['wren',    'WREN — a villager child with a feather cap and a slingshot'],
  ['sorrel',  'SORREL the forager — a villager with a mushroom-laden backpack'],
  ['alder',   'ALDER the woodcutter — a tall villager carrying a small axe over the shoulder'],
  ['hazel',   'HAZEL the healer — a villager in a petal robe holding a glowing herb'],
  ['rowan',   'ROWAN the scout — a hooded villager with a spyglass'],
  ['ivy',     'IVY the planter — a villager holding a sapling in a clay pot'],
  ['reed',    'REED the fisher — a villager with a fishing rod and a pail'],
  ['cob',     'COB the mason — a round villager carrying a flat stone'],
  ['tansy',   'TANSY the cook — a villager with a steaming acorn-soup bowl'],
  ['bryn',    'BRYN the carter — a villager pulling a tiny wooden handcart'],
  ['nutkin',  'NUTKIN — a cheeky red squirrel standing upright holding an acorn'],
  ['bramble', 'BRAMBLE — a friendly hedgehog with berries stuck on its spines'],
  ['flick',   'FLICK — a small orange fox with a bushy tail, sitting alert'],
  ['sage',    'SAGE — a round tawny owl with big amber eyes, perched'],
  ['puddle',  'PUDDLE — a plump green frog wearing a lily-pad hat'],
  ['glim',    'GLIM — a tiny glowing forest sprite with moth wings'],
];
// ---- 10 STRUCTURES ----
const STRUCTS = [
  ['hut',        'a cozy forest HUT — a tiny round cottage with a thatched mushroom-cap roof and a glowing window'],
  ['hall',       'the GREAT OAK HALL — a grand treehouse hall built into a mighty oak with lantern-lit balconies'],
  ['lumbercamp', 'a LUMBER CAMP — a lean-to with stacked logs, a sawhorse and an axe in a stump'],
  ['garden',     'a BERRY GARDEN — neat bramble rows heavy with red berries on a small fenced plot'],
  ['storehouse', 'a STOREHOUSE — a stilted granary hut with sacks and barrels under it'],
  ['well',       'a mossy stone WELL with a wooden bucket and rope'],
  ['campfire',   'a small CAMPFIRE circle with log seats and a cooking pot'],
  ['shrine',     'the SUN SHRINE — a stone ring monument with a golden sun disc catching light'],
  ['pine',       'a tall PINE TREE, slightly stylized, dense dark-green'],
  ['oak',        'a broad OAK TREE with a thick trunk and a round leafy crown'],
];
// ---- 5 GLADE BACKDROPS (the buildable ground, slight top-down iso feel) ----
const GLADES = [
  ['glade-1', 'a sunny DAWN MEADOW forest clearing: soft grass, scattered daisies, a dirt path, tree line at the top edge'],
  ['glade-2', 'a FERN HOLLOW clearing: deeper green ferns and clover, mossy stones, dappled light'],
  ['glade-3', 'a RIVERBEND clearing: a gentle stream crossing one side, pebbly banks, reeds'],
  ['glade-4', 'a MUSHROOM DELL at dusk: glowing toadstools, violet shade, fireflies'],
  ['glade-5', 'the ANCIENT HEARTWOOD: golden god-rays over old roots and amber leaves, grand and warm'],
];

console.log('— characters —');
for (const [name, desc] of CHARS) {
  if (existsSync(new URL(`art-src/char-${name}.jpg`, GAME))) { console.log('  (exists)', name); continue; }
  const img = await generateImage(`${desc}, full body, facing slightly left, single game sprite. ${PIX} ${MAG}`, { aspectRatio: '1:1' });
  save(`art-src/char-${name}.jpg`, img.base64);
}
console.log('— structures —');
for (const [name, desc] of STRUCTS) {
  if (existsSync(new URL(`art-src/bld-${name}.jpg`, GAME))) { console.log('  (exists)', name); continue; }
  const img = await generateImage(`${desc}, single isolated game building sprite, three-quarter top-down view. ${PIX} ${MAG}`, { aspectRatio: '1:1' });
  save(`art-src/bld-${name}.jpg`, img.base64);
}
console.log('— glade backdrops —');
for (const [name, desc] of GLADES) {
  if (existsSync(new URL(`src/assets/${name}.jpg`, GAME))) { console.log('  (exists)', name); continue; }
  const img = await generateImage(`top-down slightly angled view of ${desc}. ${PIX}. An open buildable clearing fills the centre. NO buildings, NO characters, NO text, NO UI.`, { aspectRatio: '16:9' });
  save(`src/assets/${name}.jpg`, img.base64);
}
if (!existsSync(new URL('src/assets/menu/logo.png', GAME))) {
  const lg = await generateImage(`the word "GROVEKEEP" as a chunky 16-bit PIXEL ART logo wordmark, mossy green letters with golden trim, tiny leaves sprouting from the letters. ${MAG}`, { aspectRatio: '16:9' });
  save('art-src/logo.jpg', lg.base64);
}

console.log('— chroma-key —');
const pairs = [
  ...CHARS.map(([n]) => `art-src/char-${n}.jpg:src/assets/char-${n}.png`),
  ...STRUCTS.map(([n]) => `art-src/bld-${n}.jpg:src/assets/bld-${n}.png`),
  'art-src/logo.jpg:src/assets/menu/logo.png',
];
run(['key.mjs', ...pairs], { ART_GAME: 'grovekeep' });

console.log('— pixelize (the new engine tool) —');
const gameRoot = 'games/grovekeep/src/assets/';
run(['pixelize.mjs', ...CHARS.map(([n]) => `../../${gameRoot}char-${n}.png`)], { PIX_H: '72', PIX_LEVELS: '6', PIX_SCALE: '4' });
run(['pixelize.mjs', ...STRUCTS.map(([n]) => `../../${gameRoot}bld-${n}.png`)], { PIX_H: '120', PIX_LEVELS: '6', PIX_SCALE: '4' });
run(['pixelize.mjs', ...GLADES.map(([n]) => `../../${gameRoot}${n}.jpg`)], { PIX_H: '270', PIX_LEVELS: '7', PIX_SCALE: '2' });
run(['pixelize.mjs', `../../${gameRoot}menu/logo.png`], { PIX_H: '160', PIX_LEVELS: '6', PIX_SCALE: '3' });
console.log('GROVEKEEP ART DONE');
