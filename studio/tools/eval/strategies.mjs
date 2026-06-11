/*
 * strategies — a DIFFERENT kind of level eval. The 0-death gate asks one yes/no
 * question of ONE optimal strategy. This asks the richer ones: is the level a
 * STOMP or a nail-biter? Does it reward MORE THAN ONE strategy (meaningful
 * choices, Schell #32) or only the deathball? How much skill HEADROOM is there?
 *
 * It runs a faithful Studio.(Iso)RTS sim under several AI PLAYSTYLES (brawler-ball,
 * scout-swarm, gunner-line, eco-boom, no-eco, mixed-arms, spread-front) and reports
 * per level: which playstyles win, time-to-win, the closest the garage came (tension),
 * peak army — then a per-level CHALLENGE profile + strategic DIVERSITY, and a
 * campaign summary. Deterministic, pure-Node, milliseconds. Advisory (exits 0).
 *
 *   node tools/eval/strategies.mjs games/roadwar-iso
 */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STYLES, runStyle, tensionOf } from './rts-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const arg = process.argv[2] || 'games/roadwar-iso';
const GAME = path.isAbsolute(arg) ? arg : path.join(STUDIO, arg.replace(/^studio\//, ''));
const sb = { window: {} }; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(GAME, 'src/game/levels.js'), 'utf8'), sb);
const LEVELS = sb.window.LEVELS || [];

const styleNames = Object.keys(STYLES);
console.log(`\n🎲 Strategy-sweep eval — ${path.basename(GAME)}   ·   ${styleNames.length} playstyles × ${LEVELS.length} grounds (deterministic)`);
let campDiv = 0, campTen = [];
LEVELS.forEach((spec, i) => {
  const { rows, winners, garage, diversity, tension, worst, autoWon } = tensionOf(spec);
  const label = !autoWon ? 'UNFAIR (canonical strategy loses)' : tension < 0.06 ? 'STOMP (too easy)' : tension < 0.35 ? 'comfortable' : tension < 0.7 ? 'TENSE (good)' : 'BRUTAL';
  campDiv += diversity; campTen.push(tension);
  console.log(`\n  G${i + 1} ${spec.name}  —  canonical tension ${tension} → ${label}  ·  ${winners.length}/${rows.length} styles win (diversity ${(diversity * 100) | 0}%)  ·  worst-case near-loss ${worst}`);
  rows.sort((a, b) => (a.r.won === b.r.won ? a.r.t - b.r.t : a.r.won ? -1 : 1)).forEach(({ n, r }) => {
    const tag = r.won ? '✅ win ' : r.lost ? '💥 LOSE' : '⏳ time';
    console.log(`     ${tag}  ${n.padEnd(13)} t=${String(r.t).padStart(5)}s  garage-left ${String(r.won ? r.garageHp : r.minG).padStart(5)}/${garage}  peak ${r.peakP}`);
  });
});
const meanDiv = +(campDiv / LEVELS.length * 100).toFixed(0), meanTen = +(campTen.reduce((a, b) => a + b, 0) / LEVELS.length).toFixed(2);
const rising = campTen[campTen.length - 1] >= Math.max(...campTen) - 0.05;
console.log(`\n  campaign — canonical tension curve [${campTen.join(' → ')}]  ${rising ? '↗ climaxes at the finale ✓' : '⚠ does not peak at the finale'}  (mean ${meanTen})`);
console.log(`           — strategic diversity ${meanDiv}% (how many of ${styleNames.length} playstyles are viable; <100% = some strategies genuinely fail = real choices)\n`);
process.exit(0);
