/*
 * studio-sound — the VALIDATOR for capability "music".  THE GATE.
 *
 * Two halves, both deterministic (no network, no clock, no Gemini):
 *
 * 1. SFX wiring (the hard requirement). Scans the game's source for the
 *    Studio.Audio.sfx('<event>') calls covering the key moments —
 *      jump · coin · hit (stomp OR hurt) · win.
 *    pass ⇔ all four are wired.
 *
 * 2. MUSIC BED (now verified for real, not just "a hook exists"). It reads every
 *    Studio.Audio.music('<arg>') the game wires and classifies the bed:
 *      - 'proc:<mood>'        → procedural SDK synth (allowed; scores a touch lower)
 *      - a file path (.mp3/…) → COMPOSED bed: the file MUST exist under src/ AND be
 *        provably non-silent. We trust the generator's sidecar manifest
 *        (<file>.json with measured {rms,duration,model}) written by
 *        tools/art/lyria.mjs; for a raw .wav we parse the PCM directly. A
 *        referenced-but-missing or SILENT music file FAILS the gate — that is
 *        exactly the "the score said music but I hear nothing" bug, now caught.
 *
 *   node validate.mjs --game ../../games/ember
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });

const argVal = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
const gameDir = argVal('--game') || path.resolve(HERE, '..', '..', 'games', 'ember');

const REQUIRED = [
  { event: 'jump', names: ['jump'] },
  { event: 'coin', names: ['coin', 'pickup', 'collect', 'gem'] },
  { event: 'hit (stomp/hurt)', names: ['stomp', 'hurt', 'hit', 'damage', 'squash'] },
  { event: 'win', names: ['win', 'goal', 'victory', 'complete'] },
];
const MIN_RMS = 0.004;       // below this a "bed" is effectively silence
const MIN_DURATION = 8;      // a loop shorter than this isn't a bed

function emit(verdict, code) {
  const json = JSON.stringify(verdict, null, 2);
  fs.writeFileSync(path.join(OUT, 'result.json'), json + '\n');
  try { fs.writeSync(1, json + '\n'); } catch { /* pipe closed */ }
  process.exit(code);
}

function gatherSource(dir) {
  const src = fs.existsSync(path.join(dir, 'src')) ? path.join(dir, 'src') : dir;
  const files = [];
  (function walk(d) {
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full); }   // include vendor/ (boot() wires SFX in the SDK)
      else if (/\.(m?js)$/.test(e.name)) files.push(full);
    }
  })(src);
  let text = ''; const used = [];
  for (const f of files) { try { text += '\n' + fs.readFileSync(f, 'utf8'); used.push(path.relative(dir, f)); } catch { /* skip */ } }
  return { text, files: used, srcRoot: src };
}

// measure RMS of a 16-bit PCM WAV (defensive about a bogus data-size field).
function wavRms(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  const ch = buf.readUInt16LE(22), bits = buf.readUInt16LE(34), rate = buf.readUInt32LE(24);
  if (bits !== 16) return null;
  let off = 12, dOff = 0, dLen = 0;
  while (off + 8 <= buf.length) { const id = buf.toString('ascii', off, off + 4), sz = buf.readUInt32LE(off + 4); if (id === 'data') { dOff = off + 8; dLen = Math.min(sz, buf.length - dOff); break; } off += 8 + sz + (sz & 1); }
  if (!dOff) return null;
  const frames = Math.floor(dLen / 2 / ch); let ss = 0, n = 0;
  for (let i = 0; i < frames; i += 1) { const s = buf.readInt16LE(dOff + i * ch * 2) / 32768; ss += s * s; n++; }
  return { rms: Math.sqrt(ss / Math.max(1, n)), duration: frames / rate };
}

if (!fs.existsSync(gameDir)) emit({ pass: false, score: 0, capability: 'music', notes: [`no such game dir: ${gameDir}`] }, 1);
const { text, files, srcRoot } = gatherSource(gameDir);
if (!text.trim()) emit({ pass: false, score: 0, capability: 'music', game: path.basename(gameDir), notes: ['no JS source found to scan for sound wiring'] }, 1);

// ---- (1) SFX wiring ----
const sfxWired = new Set();
for (const m of text.matchAll(/Studio\.Audio\.sfx\(\s*['"]([^'"]+)['"]/g)) sfxWired.add(m[1]);
if (/Studio\.Audio/.test(text)) for (const m of text.matchAll(/(?:^|[^.\w])sfx\(\s*['"]([^'"]+)['"]/g)) sfxWired.add(m[1]);

const notes = [], covered = [];
let missing = 0;
for (const req of REQUIRED) {
  const hit = req.names.find((n) => sfxWired.has(n));
  if (hit) { covered.push(req.event); notes.push(`ok ${req.event}: Studio.Audio.sfx('${hit}')`); }
  else { missing++; notes.push(`MISSING ${req.event}: none of [${req.names.join(', ')}] wired`); }
}

// ---- (2) music bed: classify + VERIFY ----
// Two wiring styles: an explicit Studio.Audio.music('file') call, OR a
// Studio.Game.boot() theme declaring `music: { url: 'assets/...' }` (the SDK
// makes the call dynamically). Collect both.
const musicArgs = [...text.matchAll(/Studio\.Audio\.music\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
for (const m of text.matchAll(/music\s*:\s*\{\s*url\s*:\s*['"]([^'"]+)['"]/g)) musicArgs.push(m[1]);   // boot theme
for (const m of text.matchAll(/music\s*:\s*['"](proc:[^'"]+)['"]/g)) musicArgs.push(m[1]);
// PER-LEVEL music: a theme `musicByLevel: [ 'a.mp3', 'b.mp3', ... ]` or per-level `music:` strings
const byLevel = [];
const mbl = text.match(/musicByLevel\s*:\s*\[([\s\S]*?)\]/);
if (mbl) for (const s of mbl[1].matchAll(/['"]([^'"]+\.(?:mp3|ogg|wav|m4a))['"]/gi)) byLevel.push(s[1]);
for (const rel of byLevel) musicArgs.push(rel);   // each must exist + be non-silent (verified below)
const fileArgs = [...new Set(musicArgs.filter((a) => !a.startsWith('proc:') && /\.(mp3|ogg|wav|m4a)$/i.test(a)))];
const procArgs = musicArgs.filter((a) => a.startsWith('proc:'));

let bedKind = 'none', musicFail = false;
const music = {};
if (fileArgs.length) {
  bedKind = 'composed';
  for (const rel of fileArgs) {
    const assetPath = path.join(srcRoot, rel);
    if (!fs.existsSync(assetPath)) { musicFail = true; notes.push(`MUSIC FAIL: wired Studio.Audio.music('${rel}') but ${path.relative(gameDir, assetPath)} does NOT exist`); continue; }
    const bytes = fs.statSync(assetPath).size;
    const sidecar = assetPath.replace(/\.(mp3|ogg|wav|m4a)$/i, '.json');
    let verified = null;
    if (fs.existsSync(sidecar)) {
      try { const m = JSON.parse(fs.readFileSync(sidecar, 'utf8')); verified = { rms: m.rms, duration: m.duration, model: m.model || m.kind || 'unknown', source: 'sidecar' }; } catch { /* fall through */ }
    }
    if (!verified && /\.wav$/i.test(rel)) { const r = wavRms(fs.readFileSync(assetPath)); if (r) verified = { rms: +r.rms.toFixed(4), duration: +r.duration.toFixed(2), model: 'raw-wav', source: 'pcm' }; }
    if (!verified) { musicFail = true; notes.push(`MUSIC FAIL: ${rel} exists (${(bytes / 1024) | 0}kB) but is UNVERIFIABLE (no <file>.json manifest, not a parseable WAV) — can't prove it's real audio`); continue; }
    music[rel] = { ...verified, bytes };
    if (verified.rms < MIN_RMS) { musicFail = true; notes.push(`MUSIC FAIL: ${rel} is SILENT (rms ${verified.rms} < ${MIN_RMS})`); }
    else if (verified.duration < MIN_DURATION) { musicFail = true; notes.push(`MUSIC FAIL: ${rel} too short (${verified.duration}s < ${MIN_DURATION}s) to be a loop`); }
    else notes.push(`ok COMPOSED bed: ${rel} — ${verified.model}, ${verified.duration}s, rms ${verified.rms}, ${(bytes / 1024) | 0}kB (${verified.source})`);
  }
} else if (procArgs.length) {
  bedKind = 'procedural';
  notes.push(`ok procedural bed: Studio.Audio.music('${procArgs[0]}') — SDK synth (allowed; a composed loop scores higher)`);
} else {
  notes.push('note: no music bed wired (Studio.Audio.music) — SFX-only');
}

// ---- (3) PER-LEVEL MUSIC: distinct verified tracks vs the level count ----
let levelCount = 0;
try {
  const lp = path.join(srcRoot, 'game', 'levels.js');
  if (fs.existsSync(lp)) { const sb = { window: {} }; vm.createContext(sb); vm.runInContext(fs.readFileSync(lp, 'utf8'), sb, { timeout: 2000 }); levelCount = (sb.window.LEVELS || []).length; }
} catch { /* ignore */ }
const distinctTracks = Object.keys(music).length;                 // verified composed beds
const perLevelMusic = byLevel.length >= 2 && distinctTracks >= 2;  // a real score-per-level
if (perLevelMusic) notes.push(`ok PER-LEVEL MUSIC: ${distinctTracks} distinct verified track(s)${levelCount ? ` for ${levelCount} level(s)` : ''} — a score per level`);
else if (levelCount >= 2 && bedKind === 'composed') notes.push(`PER-LEVEL MUSIC gap: ${levelCount} levels but ${distinctTracks} track — declare theme.musicByLevel (or levels[i].music) for a distinct score per level`);

// score: SFX coverage × a bed factor (composed 1.0 / procedural 0.92 / none 0.85)
// × a variety factor that nudges a multi-level game toward per-level scores.
// a referenced-but-broken composed bed collapses to 0.5 and FAILS.
const sfxFrac = (REQUIRED.length - missing) / REQUIRED.length;
const bedFactor = musicFail ? 0.5 : bedKind === 'composed' ? 1.0 : bedKind === 'procedural' ? 0.92 : 0.85;
const varietyFactor = perLevelMusic ? 1.0 : (levelCount >= 2 && bedKind === 'composed' ? 0.95 : 1.0);
const score = +(sfxFrac * bedFactor * varietyFactor).toFixed(3);
notes.push(`scanned ${files.length} source file(s); SFX wired: ${[...sfxWired].sort().join(', ') || 'none'}`);

const pass = missing === 0 && !musicFail; // all key SFX present AND any referenced music is real
emit({
  pass, score, capability: 'music', deterministic: true, game: path.basename(gameDir),
  required: REQUIRED.map((r) => r.event), covered, sfxWired: [...sfxWired].sort(),
  bedKind, perLevelMusic, levelCount, distinctTracks, music, notes,
}, pass ? 0 : 1);
