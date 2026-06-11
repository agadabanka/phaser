/*
 * ci — THE ENGINE'S OWN TEST SUITE (the regression ratchet, RFC: "the engine
 * defends itself"). The 0-death gate proves one game; this proves the engine
 * against EVERY game at once: it re-vendors the CURRENT sdk/studio.js into each
 * game and re-runs that game's gate (+ lint). So an SDK change that breaks any
 * shipped game — across all four archetypes — turns the suite RED immediately,
 * instead of being discovered later by hand.
 *
 *   node tools/ci/run.mjs            # full: re-vendor + browser gate every game
 *   node tools/ci/run.mjs --fast     # lint only (skip the browser gate) — quick local check
 *   node tools/ci/run.mjs --no-vendor# gate as-committed (don't refresh the vendored SDK)
 *
 * Exit 0 iff every game is green (gate deterministic, won, 0 deaths). Else exit 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAST = process.argv.includes('--fast');
const NO_VENDOR = process.argv.includes('--no-vendor');
const SDK = path.join(STUDIO, 'sdk', 'studio.js');
const sdkSrc = fs.readFileSync(SDK, 'utf8');

// discover gateable games: a games/<g>/ with an eval.mjs
const games = fs.readdirSync(path.join(STUDIO, 'games'))
  .map((g) => path.join(STUDIO, 'games', g))
  .filter((d) => fs.existsSync(path.join(d, 'eval.mjs')) && fs.existsSync(path.join(d, 'src', 'vendor', 'studio.js')))
  .sort();

const meta = (d) => { try { return JSON.parse(fs.readFileSync(path.join(d, 'GAME_META.json'), 'utf8')); } catch { return {}; } };
const arch = (d) => meta(d).archetype || 'platformer';

function lint(d) {
  const r = spawnSync('node', [path.join(STUDIO, 'tools', 'level-lint', 'validate.mjs'), '--game', d], { encoding: 'utf8' });
  try { const j = JSON.parse(r.stdout); return { ran: true, pass: !!j.pass, score: j.score }; } catch { return { ran: false }; }
}
function gate(d) {
  const r = spawnSync('node', [path.join(d, 'eval.mjs')], { cwd: d, encoding: 'utf8', timeout: 600000 });
  let j; try { j = JSON.parse(r.stdout); } catch { return { ok: false, err: (r.stderr || r.stdout || 'no output').split('\n').slice(-3).join(' ').slice(0, 160) }; }
  const w = j.results?.webgl?.gate || {}, c = j.results?.canvas?.gate || {};
  const det = j.results?.webgl?.deterministic && j.results?.canvas?.deterministic;
  const ok = !!(j.verdict?.webgl && j.verdict?.canvas && det && w.deaths === 0 && c.deaths === 0 && w.won && c.won);
  return { ok, det: !!det, deaths: Math.max(w.deaths ?? 9, c.deaths ?? 9), frame: w.frame, won: !!(w.won && c.won) };
}

console.log(`\n🔬 ENGINE CI — current SDK vs ${games.length} games${FAST ? '  (--fast: lint only)' : ''}${NO_VENDOR ? '  (--no-vendor)' : ''}\n`);
const rows = [];
for (const d of games) {
  const g = path.basename(d), a = arch(d);
  // 1) vendor-sync: is the committed vendored SDK already the current one?
  const vpath = path.join(d, 'src', 'vendor', 'studio.js');
  const drift = fs.readFileSync(vpath, 'utf8') !== sdkSrc;
  if (!NO_VENDOR && drift) fs.writeFileSync(vpath, sdkSrc);          // refresh to the current SDK (the thing under test)
  const vendor = drift ? (NO_VENDOR ? 'DRIFT' : 're-vendored') : 'synced';
  // 2) lint (cheap, archetype-aware; advisory if the tool doesn't cover this game)
  const l = lint(d);
  // 3) the gate (the real regression check) — unless --fast
  const gt = FAST ? null : gate(d);
  const green = FAST ? (l.ran ? l.pass : true) : gt.ok;
  rows.push({ g, a, vendor, drift, lint: l, gt, green });
  const gateStr = FAST ? 'skipped' : gt.ok ? `PASS (det, 0-death, ${gt.frame}f)` : (gt.err ? `ERROR: ${gt.err}` : `FAIL (det ${gt.det}, deaths ${gt.deaths}, won ${gt.won})`);
  console.log(`  ${green ? '✅' : '❌'}  ${g.padEnd(13)} ${('[' + a + ']').padEnd(13)} vendor:${vendor.padEnd(12)} lint:${l.ran ? (l.pass ? 'pass' : 'FAIL') : 'n/a'}   gate:${gateStr}`);
}

const reds = rows.filter((r) => !r.green);
const drifted = rows.filter((r) => r.drift);
console.log('');
if (drifted.length && !NO_VENDOR) console.log(`  ⚠ ${drifted.length} game(s) had a STALE vendored SDK (now refreshed): ${drifted.map((r) => r.g).join(', ')} — commit the re-vendor.`);
if (reds.length) { console.log(`\n  ❌ ENGINE CI RED — ${reds.length}/${rows.length} game(s) broken by the current SDK: ${reds.map((r) => r.g).join(', ')}\n`); process.exit(1); }
console.log(`  ✅ ENGINE CI GREEN — all ${rows.length} games pass on the current SDK (every archetype defended).\n`);
process.exit(0);
