// Ember Depths art generation — uses the studio/jazz Gemini pipeline (nano-banana-pro)
// to produce a painted backdrop + character sprites on a flat magenta key field.
// Auth: GEMINI_SA_JSON (env). Outputs raw assets to ../../games/ember/art-src/.
// Keys are NEVER written to disk in-repo; this only writes generated images.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { generateImage } from './gemini.js';

const OUT = new URL('../../games/ember/art-src/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const save = (name, b64) => { const p = new URL(name, OUT); writeFileSync(p, Buffer.from(b64, 'base64')); console.log('  saved', name); return p; };
const refOf = (name) => existsSync(new URL(name, OUT)) ? [{ base64: readFileSync(new URL(name, OUT)).toString('base64'), mimeType: name.endsWith('png') ? 'image/png' : 'image/jpeg' }] : [];

const STYLE = 'Cohesive painterly molten-cave platformer art style: warm palette of deep maroon/charcoal volcanic rock, glowing amber/orange lava light, drifting embers, bold clean readable shapes.';

const JOBS = {
  async backdrop() {
    console.log('backdrop (16:9 painted cavern)...');
    const p = `${STYLE} A side-scrolling platformer BACKGROUND of a vast molten cavern: layered rock walls receding into atmospheric depth, rivers and pools of glowing orange lava far below casting warm light up the walls, stalactites, floating embers and soft volumetric god-rays. Cinematic wide composition for a parallax backdrop. NO characters, NO text, NO UI, NO foreground platforms.`;
    const { mimeType, base64 } = await generateImage(p, { aspectRatio: '16:9' });
    save(`backdrop.${mimeType.includes('png') ? 'png' : 'jpg'}`, base64);
  },
  async hero() {
    console.log('hero "Ember" (magenta key field)...');
    const p = `${STYLE} A heroic GAME CHARACTER named "Ember": a small, brave, cute molten-ember elemental — a rounded magma-rock body cracked with glowing orange lava veins, bright friendly glowing eyes, little arms and legs, a warm inner glow. Full body, 3/4 side view facing RIGHT, confident ready/idle pose, bold clean cartoon outline, highly readable silhouette. Centered, single character. FLAT SOLID MAGENTA (#ff00ff) background ONLY. No shadow, no ground, no text, no border.`;
    const { mimeType, base64 } = await generateImage(p, { aspectRatio: '1:1' });
    save(`hero.${mimeType.includes('png') ? 'png' : 'jpg'}`, base64);
  },
  async enemy() {
    console.log('enemy (ref-conditioned on hero for cohesion)...');
    const p = `${STYLE} An ENEMY creature for the same game as the attached character (match its art style, outline weight and palette, but make it clearly a VILLAIN): a menacing obsidian-and-lava rock beast — jagged black volcanic armor plates with molten orange cracks, angry glowing eyes, a low hostile stance. Full body, side view facing LEFT, bold clean cartoon outline, readable silhouette. Centered, single creature. FLAT SOLID MAGENTA (#ff00ff) background ONLY. No shadow, no ground, no text.`;
    const { mimeType, base64 } = await generateImage(p, { aspectRatio: '1:1', refs: refOf('hero.png').concat(refOf('hero.jpg')) });
    save(`enemy.${mimeType.includes('png') ? 'png' : 'jpg'}`, base64);
  }
};

const which = process.argv.slice(2);
const run = which.length ? which : Object.keys(JOBS);
for (const j of run) { if (!JOBS[j]) { console.log('skip unknown', j); continue; } await JOBS[j](); }
console.log('done:', run.join(', '));
