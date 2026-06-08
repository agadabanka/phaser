/*
 * The Conductor — turns the hub from an observer into a driver.
 *
 * Given a game directory, it:
 *   1. runs the game's eval (the QA gate: determinism + 0-death + readback),
 *   2. reads GAME_META.stages to see which verticals are done,
 *   3. picks the next vertical in dependency order, and
 *   4. emits a ready-to-dispatch agent BRIEF for it.
 *
 * The vertical agents themselves are Claude Code subagents (see ../.claude/skills
 * and verticals.json). The conductor scores + sequences; the agents build. Run the
 * loop: conductor -> dispatch brief as a subagent -> agent edits + re-evals -> repeat.
 *
 *   node conductor.mjs <gameDir>           # status + next brief
 *   node conductor.mjs <gameDir> --json    # machine-readable
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(process.argv[2] || '.');
const asJson = process.argv.includes('--json');
const reg = JSON.parse(fs.readFileSync(path.join(HERE, 'verticals.json'), 'utf8'));
const metaPath = path.join(gameDir, 'GAME_META.json');
const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : { name: path.basename(gameDir), stages: {} };
const stages = meta.stages || {};

// 1. run the QA gate (if the game has an eval)
let verdict = null, gateErr = null;
const evalPath = path.join(gameDir, 'eval.mjs');
if (fs.existsSync(evalPath)) {
  try { verdict = JSON.parse(execFileSync('node', [evalPath], { encoding: 'utf8', maxBuffer: 1 << 24 })).verdict; }
  catch (e) { gateErr = String(e).split('\n')[0]; }
}
const gateGreen = !!(verdict && (verdict.webgl || verdict.canvas));

// 2+3. status per vertical and next-to-run
function done(v) {
  const d = reg.verticals[v];
  if (v === 'qa-gate') return gateGreen;
  return !!stages[d.stage];
}
function ready(v) { return reg.verticals[v].dependsOn.every(done); }
const status = reg.order.map(v => ({ v, title: reg.verticals[v].title, done: done(v), ready: ready(v) }));
const next = reg.order.find(v => !done(v) && ready(v));

// 4. emit
const brief = next ? reg.verticals[next].brief.replace(/{{name}}/g, meta.name || 'this game') : null;
const out = {
  game: meta.name, dir: gameDir, gate: gateGreen ? 'GREEN' : (gateErr ? 'ERROR' : 'RED'), verdict, gateErr,
  status, next, nextTitle: next && reg.verticals[next].title,
  nextPhaser: next && reg.verticals[next].phaser, nextGate: next && reg.verticals[next].gate, brief
};

if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`\n🎬 Studio Conductor — ${out.game}`);
console.log(`   gate: ${out.gate}` + (verdict ? `  (webgl:${verdict.webgl} canvas:${verdict.canvas})` : '') + (gateErr ? `  ${gateErr}` : ''));
console.log('   pipeline:');
for (const s of status) console.log(`     ${s.done ? '✅' : (s.ready ? '🟡' : '⬜')} ${s.v.padEnd(13)} ${s.title}`);
if (next) {
  console.log(`\n▶ next vertical: ${next}  (${out.nextTitle})`);
  console.log(`   phaser: ${(out.nextPhaser || []).join(', ') || '—'}`);
  console.log(`   gate:   ${out.nextGate}`);
  console.log(`\n   DISPATCH THIS AS A SUBAGENT:\n   ${brief}\n`);
} else {
  console.log('\n🎉 all verticals complete — game is shipped.\n');
}
