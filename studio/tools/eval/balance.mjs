/*
 * balance — the SYSTEMATIC difficulty auto-tuner. Tension shouldn't be hand-poked
 * level by level; the designer declares INTENT (a tension curve that rises to the
 * finale, Schell #61) and the engine realises it. For each level this searches the
 * `difficulty` knob (which Studio.rtsPressure turns into flank pressure) so the
 * canonical strategy (brawler-ball + its eco) still WINS 0-death — the sanity floor —
 * but with garage loss ≈ the target tension. It writes `difficulty` back into the
 * level data, so the result is reproducible + checked by the strategy-sweep.
 *
 *   node tools/eval/balance.mjs games/roadwar-iso            # tune to the default curve
 *   node tools/eval/balance.mjs games/roadwar-iso --dry      # show the plan, don't write
 *   node tools/eval/balance.mjs games/roadwar-iso --curve 0.2,0.35,0.45,0.55,0.65
 */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STYLES, runStyle } from './rts-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const arg = process.argv[2] || 'games/roadwar-iso';
const dry = process.argv.includes('--dry');
const curveArg = (() => { const i = process.argv.indexOf('--curve'); return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null; })();
const GAME = path.isAbsolute(arg) ? arg : path.join(STUDIO, arg.replace(/^studio\//, ''));
const LEVELS_PATH = path.join(GAME, 'src/game/levels.js');
let text = fs.readFileSync(LEVELS_PATH, 'utf8');
const sb = { window: {} }; vm.createContext(sb); vm.runInContext(text, sb);
const LEVELS = sb.window.LEVELS || [];
const n = LEVELS.length;

// target tension per level — rises to the finale (the campaign's interest curve).
const target = (i) => curveArg ? curveArg[i] : +(0.22 + 0.40 * (i / Math.max(1, n - 1))).toFixed(2);
const tensionOfAutopilot = (spec, d) => { const r = runStyle({ ...spec, difficulty: d }, STYLES['brawler-ball']); return { won: r.won, ten: r.won ? +(1 - r.minG / (spec.garageHp || 1000)).toFixed(3) : 1, minG: r.minG }; };

console.log(`\n⚖️  Difficulty auto-balance — ${path.basename(GAME)}   ·   target tension rises ${target(0)} → ${target(n - 1)} to the finale\n`);
const chosen = [];
LEVELS.forEach((spec, i) => {
  const tgt = target(i);
  // scan difficulty upward; keep the largest d that still WINS and whose tension ≤ tgt+ε
  let best = { d: 0, ten: tensionOfAutopilot(spec, 0).ten, won: true };
  for (let d = 0.05; d <= 1.0001; d += 0.05) {
    const r = tensionOfAutopilot(spec, +d.toFixed(2));
    if (!r.won) break;                                   // past here the canonical strategy loses — stop (floor)
    best = { d: +d.toFixed(2), ten: r.ten, won: true };
    if (r.ten >= tgt) break;                             // reached the target tension
  }
  chosen.push(best.d);
  console.log(`  G${i + 1} ${(spec.name + '').padEnd(16)} target ${tgt}  →  difficulty ${best.d}  (autopilot tension ${best.ten}${best.ten < tgt - 0.05 ? ', capped by winnability floor' : ''})`);
});

if (dry) { console.log('\n  --dry: no changes written.\n'); process.exit(0); }

// write difficulty back into each level (inject/update after its `name:` field)
LEVELS.forEach((spec, i) => {
  const name = spec.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(name:\\s*['"]${name}['"],)(\\s*difficulty:\\s*[\\d.]+,)?`);
  text = text.replace(re, `$1 difficulty: ${chosen[i]},`);
});
fs.writeFileSync(LEVELS_PATH, text);
console.log(`\n  ✅ wrote difficulty into ${path.relative(STUDIO, LEVELS_PATH)} — now: studio strategies & studio gate to verify\n`);
