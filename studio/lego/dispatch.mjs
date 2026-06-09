/*
 * The Dispatcher — the root accept/reject gate for capabilities.
 *
 *   node dispatch.mjs <capability> [--game <dir>] [--forge <name>]
 *
 *   MISS  -> print guidance to forge the capability (or auto-forge if --forge NAME).
 *   HIT   -> ensure-vendor (restore the brick's runtime deps), then exec the brick's
 *            validator IN ITS DIR (forwarding --game for per-game caps like gate/feel),
 *            parse the verdict + exit code, print ACCEPT / REJECT + score/notes.
 *
 * Exits 0 on ACCEPT, non-zero on REJECT or MISS — so it composes in a pipeline.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lookup } from './registry.mjs';
import { ensureVendor, STUDIO_ROOT } from './vendor.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const [, , capability, ...rest] = process.argv;
if (!capability) {
  console.error('usage: node dispatch.mjs <capability> [--game <dir>] [--forge <name>]');
  process.exit(2);
}
const gameDir = argVal('--game');
const forgeName = argVal('--forge');
function argVal(flag) { const i = rest.indexOf(flag); return i >= 0 ? rest[i + 1] : null; }

// ── 1. look up the capability ───────────────────────────────────────────────
let brick = lookup(capability);

// ── MISS: guide to the forge, or auto-forge if --forge NAME was given ─────────
if (!brick) {
  if (forgeName) {
    console.log(`MISS "${capability}" — auto-forging "${forgeName}"…\n`);
    const f = spawnSync('node', [path.join(HERE, 'forge.mjs'), capability, forgeName], { stdio: 'inherit' });
    if (f.status !== 0) process.exit(f.status || 1);
    brick = lookup(capability);
    if (!brick) { console.error(`dispatch: forge ran but "${capability}" still not registered.`); process.exit(1); }
    console.log('');
  } else {
    console.log(`MISS — no brick provides capability "${capability}".`);
    console.log(`\nForge one (it will be born gated — the template ships a validator):`);
    console.log(`   node ${path.relative(STUDIO_ROOT, path.join(HERE, 'forge.mjs'))} ${capability} <name>`);
    console.log(`Or auto-forge + dispatch in one step:`);
    console.log(`   node ${path.relative(STUDIO_ROOT, path.join(HERE, 'dispatch.mjs'))} ${capability} --forge <name>`);
    process.exit(3);
  }
}

// ── 2. resolve the brick dir + ensure its runtime deps exist (the gitignore fix) ─
const toolDir = path.resolve(STUDIO_ROOT, brick.dir);
if (!fs.existsSync(toolDir)) {
  console.error(`dispatch: brick dir missing: ${brick.dir} (registry points at a tool that isn't on disk).`);
  process.exit(1);
}
const copied = ensureVendor(toolDir);
console.log(`▶ dispatch "${capability}"  (brick: ${brick.name}, dir: ${brick.dir})`);
console.log(`   ensure-vendor: ${copied.length ? 'restored ' + copied.join(', ') : 'deps already present'}`);

// ── 3. run the validator IN THE BRICK DIR; forward --game for per-game caps ───
const [cmd, ...vargs] = brick.validator.split(/\s+/);
if (gameDir || brick.perGame) {
  const g = gameDir || path.join('..', '..', 'games', 'ember'); // default game for per-game caps
  vargs.push('--game', path.isAbsolute(g) ? g : path.resolve(process.cwd(), g));
}
console.log(`   validator: ${cmd} ${vargs.join(' ')}\n`);

// Capture the validator's output via a TEMP FILE, not a pipe. Why: validators that
// drive a headless browser (art-cohesion, distinctness) leave a dup of the capture
// pipe's write-end held open (via libuv/Playwright) after the child exits, so a
// pipe never reaches EOF and a synchronous capture (execFileSync / spawnSync+pipe)
// blocks forever. Redirecting the child's stdout+stderr to real FILE descriptors
// sidesteps pipes entirely — the parent just reads the file once the child exits.
// stdin is /dev/null so no browser descendant inherits (and pins) our stdin.
const logPath = path.join(os.tmpdir(), `lego-dispatch-${capability.replace(/[^\w.-]/g, '_')}-${process.pid}.log`);
const logFd = fs.openSync(logPath, 'w');
let exitCode = 1, stdout = '';
try {
  const res = spawnSync(cmd, vargs, { cwd: toolDir, stdio: ['ignore', logFd, logFd] });
  exitCode = typeof res.status === 'number' ? res.status : 1;
} finally {
  fs.closeSync(logFd);
  try { stdout = fs.readFileSync(logPath, 'utf8'); } catch { stdout = ''; }
  fs.rmSync(logPath, { force: true });
}

// ── 4. parse the verdict (normalise the known shapes) + decide ────────────────
const verdict = parseVerdict(stdout);
const pass = decide(verdict, exitCode);
const score = pickScore(verdict);
const notes = pickNotes(verdict);

if (pass) {
  console.log(`\n✅ ACCEPT  "${capability}"` + (score != null ? `  score=${score}` : '') + (notes ? `\n   ${notes}` : ''));
  process.exit(0);
} else {
  console.log(`\n❌ REJECT  "${capability}"` + (score != null ? `  score=${score}` : '') + (notes ? `\n   ${notes}` : ''));
  console.log(`   (validator exit ${exitCode})`);
  process.exit(1);
}

// ───────────────────────────────────────────────────────── helpers
// validators print a JSON verdict; grab the LAST top-level JSON object in stdout
// (some print progress lines first). Falls back to null if none parses.
function parseVerdict(out) {
  const trimmed = (out || '').trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { /* fall through to scan */ }
  // scan for the last balanced {...} block
  for (let i = trimmed.lastIndexOf('{'); i >= 0; i = trimmed.lastIndexOf('{', i - 1)) {
    const candidate = trimmed.slice(i);
    try { return JSON.parse(candidate); } catch { /* keep scanning */ }
  }
  return null;
}

// the accept/reject decision: exit code is authoritative; the verdict refines it.
//   { pass } -> pass; { verdict:{webgl,canvas} } -> any true; { ok } -> ok.
// If a verdict is present it must agree with success; otherwise exit code rules.
function decide(v, code) {
  if (v && typeof v.pass === 'boolean') return v.pass && code === 0;
  if (v && v.verdict && typeof v.verdict === 'object') {
    const any = !!(v.verdict.webgl || v.verdict.canvas);
    return any && code === 0;
  }
  if (v && typeof v.ok === 'boolean') return v.ok && code === 0;
  // no recognised verdict field -> trust the exit code alone.
  return code === 0;
}

function pickScore(v) {
  if (!v) return null;
  for (const k of ['score', 'fun', 'mean']) if (typeof v[k] === 'number') return v[k];
  return null;
}
function pickNotes(v) {
  if (!v) return '';
  if (Array.isArray(v.notes)) return v.notes.join('; ');
  if (typeof v.notes === 'string') return v.notes;
  if (Array.isArray(v.errors) && v.errors.length) return 'errors: ' + v.errors.slice(0, 3).join('; ');
  if (v.weakest) return `weakest: ${v.weakest}`;
  return '';
}
