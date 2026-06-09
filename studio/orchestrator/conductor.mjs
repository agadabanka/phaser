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
import { execFileSync, spawnSync } from 'node:child_process';
import { runFeel } from '../tools/eval/feel.mjs';
import { list as listBricks } from '../lego/registry.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(process.argv[2] || '.');
const asJson = process.argv.includes('--json');
const validateAll = process.argv.includes('--validate-all');

// ── --validate-all: run EVERY registered validator that applies to this game and
//    print a per-capability scorecard + overall verdict. This is the self-gating
//    end-to-end view: gate, feel, art-cohesion, distinctness, music — whichever
//    bricks are registered. It reuses the same registry.mjs + dispatch.mjs the rest
//    of the pipeline uses (discovers caps from the registry, shells out to the
//    dispatcher per cap; the gate's validator is the game's own eval.mjs so it runs
//    that directly). Keeps the normal conductor flow below untouched.
if (validateAll) { await runValidateAll(); }

async function runValidateAll() {
  const DISPATCH = path.resolve(HERE, '..', 'lego', 'dispatch.mjs');
  if (!fs.existsSync(gameDir)) { console.error(`conductor: no such game dir: ${gameDir}`); process.exit(2); }
  const gMeta = fs.existsSync(path.join(gameDir, 'GAME_META.json'))
    ? JSON.parse(fs.readFileSync(path.join(gameDir, 'GAME_META.json'), 'utf8')) : { name: path.basename(gameDir) };

  // A validator APPLIES to a game iff it is per-game (takes --game): gate, feel,
  // art-cohesion, distinctness, music. Non-perGame bricks (sprite-animation,
  // contraption) judge their own bundled artifact, not THIS game, so they are
  // listed as skipped rather than run here. Each applicable brick is dispatched
  // exactly as a real dispatch would (its own dir, --game forwarded).
  const bricks = listBricks();
  const applicableBricks = bricks.filter((b) => b.perGame);
  const skipped = bricks.filter((b) => !b.perGame).map((b) => b.capability);
  const rows = [];
  for (const b of applicableBricks) {
    let r;
    if (b.capability === 'gate' && fs.existsSync(path.join(gameDir, 'eval.mjs'))) {
      // The gate brick's validator IS the game's OWN eval.mjs (it lives in the game
      // dir, not the brick dir), so dispatch it against the game directly here.
      // stdio:['ignore','pipe','pipe'] — ignore stdin so no headless-browser
      // descendant pins our stdin open and blocks this spawnSync on pipe-EOF.
      r = spawnSync('node', [path.join(gameDir, 'eval.mjs')], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });
    } else {
      // every other applicable brick goes through the Lego dispatcher (which itself
      // captures its validator via a temp file, so this spawnSync only reads the
      // dispatcher's small ACCEPT/REJECT summary — no browser sits in our pipe).
      r = spawnSync('node', [DISPATCH, b.capability, '--game', gameDir], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });
    }
    const out = (r.stdout || '') + (r.stderr || '');
    const accept = r.status === 0;
    // scrape a score: the dispatcher prints "score=N"; the raw gate eval prints a
    // {verdict:{webgl,canvas}} JSON — surface webgl/canvas pass as the gate's signal.
    let score = null;
    const sm = out.match(/score=(-?[0-9.]+)/);
    if (sm) score = Number(sm[1]);
    rows.push({ capability: b.capability, name: b.name, accept, score, exit: r.status ?? 1, out });
  }

  const applicable = rows;
  const passed = applicable.filter((r) => r.accept).length;
  const overall = applicable.length > 0 && applicable.every((r) => r.accept);

  if (asJson) {
    console.log(JSON.stringify({
      game: gMeta.name, dir: gameDir,
      overall: overall ? 'ACCEPT' : 'REJECT', passed, total: applicable.length,
      scorecard: applicable.map(({ out, ...r }) => r),
      skipped,
    }, null, 2));
    process.exit(overall ? 0 : 1);
  }

  console.log(`\n🎬 Studio Conductor — ${gMeta.name}  ·  --validate-all`);
  console.log(`   ${gameDir}`);
  console.log(`   ran ${applicable.length} game-applicable validator(s) from the Lego registry via the dispatcher (studio/lego/dispatch.mjs)\n`);
  console.log('   SCORECARD (capability → ACCEPT/REJECT + score):');
  for (const r of applicable) {
    const mark = r.accept ? '✅ ACCEPT' : '❌ REJECT';
    const score = r.score != null ? `score ${r.score}` : 'score —';
    console.log(`     ${mark}  ${r.capability.padEnd(14)} ${String(score).padEnd(11)} ${lastReason(r.out)}`);
  }
  if (skipped.length) console.log(`\n   (not game-scoped, self-test bricks skipped: ${skipped.join(', ')})`);
  console.log(`\n   ${overall ? '✅ OVERALL: ACCEPT' : '❌ OVERALL: REJECT'}  —  ${passed}/${applicable.length} validators passed\n`);
  process.exit(overall ? 0 : 1);
}

// extract a one-line reason from a run's stdout: the note the dispatcher prints
// under its ACCEPT/REJECT line; else the gate eval's {verdict:{webgl,canvas}};
// else the first MISS/error line.
function lastReason(out) {
  const lines = (out || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const vi = lines.findIndex((l) => /ACCEPT|REJECT/.test(l));
  if (vi >= 0 && lines[vi + 1] && !/validator exit/.test(lines[vi + 1])) return lines[vi + 1].slice(0, 100);
  const vm = (out || '').match(/"verdict"\s*:\s*\{\s*"webgl"\s*:\s*(true|false)\s*,\s*"canvas"\s*:\s*(true|false)/);
  if (vm) return `0-death gate — webgl:${vm[1]} canvas:${vm[2]}`;
  const miss = lines.find((l) => /^MISS/.test(l));
  return miss ? miss.slice(0, 100) : '';
}
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
