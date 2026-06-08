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
import { runFeel } from '../tools/eval/feel.mjs';

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

// 1b. ALSO run the deterministic feel scorer (a SOFT metric — never fails the gate).
//     Reuses studio/tools/eval/feel.mjs's logic: scores every level via the in-page
//     Studio.Feel and reports per-level { fun, weakest } + the campaign weakest dim.
let feel = null, feelErr = null;
const feelSrc = path.join(gameDir, 'src');
if (fs.existsSync(feelSrc)) {
  try { feel = await runFeel(feelSrc); if (feel && !feel.ok) { feelErr = feel.error; feel = null; } }
  catch (e) { feelErr = String(e).split('\n')[0]; }
}

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
// feel-guided next step: when the gate is GREEN, surface the campaign's weakest
// dimension on its worst level as a concrete improvement (in ADDITION to the
// stage-based next vertical above — it does not replace dependency sequencing).
const feelStep = (gateGreen && feel && feel.weakest && feel.worstLevel)
  ? `improve ${feel.weakest} on level ${feel.worstLevel.level} (${feel.worstLevel.name}, FUN ${feel.worstLevel.fun})`
  : null;
const out = {
  game: meta.name, dir: gameDir, gate: gateGreen ? 'GREEN' : (gateErr ? 'ERROR' : 'RED'), verdict, gateErr,
  feel: feel ? { mean: feel.mean, weakest: feel.weakest, levels: feel.levels, dimMean: feel.dimMean } : null, feelErr, feelStep,
  status, next, nextTitle: next && reg.verticals[next].title,
  nextPhaser: next && reg.verticals[next].phaser, nextGate: next && reg.verticals[next].gate, brief
};

if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`\n🎬 Studio Conductor — ${out.game}`);
console.log(`   gate: ${out.gate}` + (verdict ? `  (webgl:${verdict.webgl} canvas:${verdict.canvas})` : '') + (gateErr ? `  ${gateErr}` : ''));
// feel scores (soft metric) printed alongside the gate
if (feel && feel.levels && feel.levels.length) {
  const board = feel.levels.slice().sort((a, b) => b.fun - a.fun);
  console.log(`   feel: mean FUN ${feel.mean}  ·  weakest dim: ${feel.weakest}`);
  for (const l of board) console.log(`     ⤷ L${l.level} FUN ${String(l.fun).padStart(5)}  ${l.name}  (weakest: ${l.weakest})`);
} else if (feelErr) {
  console.log(`   feel: ⚠ ${feelErr}`);
}
console.log('   pipeline:');
for (const s of status) console.log(`     ${s.done ? '✅' : (s.ready ? '🟡' : '⬜')} ${s.v.padEnd(13)} ${s.title}`);
if (feelStep) console.log(`\n🎛  feel-guided next step: ${feelStep}`);
if (next) {
  console.log(`\n▶ next vertical: ${next}  (${out.nextTitle})`);
  console.log(`   phaser: ${(out.nextPhaser || []).join(', ') || '—'}`);
  console.log(`   gate:   ${out.nextGate}`);
  console.log(`\n   DISPATCH THIS AS A SUBAGENT:\n   ${brief}\n`);
} else {
  console.log('\n🎉 all verticals complete — game is shipped.\n');
}
