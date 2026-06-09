/*
 * studio-sound — the VALIDATOR for capability "music".  THE GATE.
 *
 * A REAL STRUCTURAL validator: it statically checks that a game WIRES sound. It
 * scans the game's source (src/game/*.js + any sound.js / audio file) for the
 * Studio.Audio.sfx('<event>') calls that cover the key gameplay moments —
 *   jump · coin · hit (stomp OR hurt) · win
 * — plus a music/bed hook (Studio.Audio.music(...)). The key SFX events are the
 * hard requirement; the music bed is a soft bonus surfaced as a note.
 *   pass ⇔ all key SFX events are present.
 *
 * No audio rendering: this is a deterministic source check (no network, no clock),
 * so it gates the same offline and online — and needs no Gemini creds.
 *
 * Prints a single JSON verdict { pass, score, notes, ... } + exit code (0 = pass,
 * 1 = fail) — the dispatcher reads both.
 *
 *   node validate.mjs --game ../../games/ember   # check a game wires sound
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });

const argVal = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
const gameDir = argVal('--game') || path.resolve(HERE, '..', '..', 'games', 'ember');

// the key gameplay events that MUST have an SFX. "hit" is satisfied by EITHER a
// stomp (you hit an enemy) or a hurt (you got hit) — a game needs at least one.
const REQUIRED = [
  { event: 'jump', names: ['jump'] },
  { event: 'coin', names: ['coin', 'pickup', 'collect', 'gem'] },
  { event: 'hit (stomp/hurt)', names: ['stomp', 'hurt', 'hit', 'damage', 'squash'] },
  { event: 'win', names: ['win', 'goal', 'victory', 'complete'] },
];

function emit(verdict, code) {
  const json = JSON.stringify(verdict, null, 2);
  fs.writeFileSync(path.join(OUT, 'result.json'), json + '\n');
  try { fs.writeSync(1, json + '\n'); } catch { /* pipe closed */ }
  process.exit(code);
}

// gather the game's source text: src/game/*.js plus a sound.js / audio.js anywhere
// under src/, so we catch sound wired in a dedicated module too.
function gatherSource(dir) {
  const src = fs.existsSync(path.join(dir, 'src')) ? path.join(dir, 'src') : dir;
  const files = [];
  (function walk(d) {
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'vendor' && e.name !== 'node_modules') walk(full); }
      else if (/\.(m?js)$/.test(e.name)) files.push(full);
    }
  })(src);
  let text = '';
  const used = [];
  for (const f of files) {
    try { text += '\n' + fs.readFileSync(f, 'utf8'); used.push(path.relative(dir, f)); } catch { /* skip */ }
  }
  return { text, files: used };
}

if (!fs.existsSync(gameDir)) {
  emit({ pass: false, score: 0, capability: 'music', notes: [`no such game dir: ${gameDir}`] }, 1);
}

const { text, files } = gatherSource(gameDir);
if (!text.trim()) {
  emit({ pass: false, score: 0, capability: 'music', game: path.basename(gameDir), notes: ['no JS source found to scan for sound wiring'] }, 1);
}

// find every Studio.Audio.sfx('X') / .sfx("X") event name actually wired.
const sfxWired = new Set();
for (const m of text.matchAll(/Studio\.Audio\.sfx\(\s*['"]([^'"]+)['"]/g)) sfxWired.add(m[1]);
// also accept a bare sfx('X') (some games alias Studio.Audio) — conservative: only
// count it if Studio.Audio is referenced somewhere in the source.
if (/Studio\.Audio/.test(text)) {
  for (const m of text.matchAll(/(?:^|[^.\w])sfx\(\s*['"]([^'"]+)['"]/g)) sfxWired.add(m[1]);
}

// a music / looping-bed hook: Studio.Audio.music(...) or a .play() on a looping Audio.
const hasMusicBed = /Studio\.Audio\.music\s*\(/.test(text) || /\.loop\s*=\s*true[\s\S]{0,80}\.play\s*\(/.test(text);

const notes = [];
const covered = [];
let missing = 0;
for (const req of REQUIRED) {
  const hitName = req.names.find((n) => sfxWired.has(n));
  if (hitName) { covered.push(req.event); notes.push(`ok ${req.event}: Studio.Audio.sfx('${hitName}')`); }
  else { missing++; notes.push(`MISSING ${req.event}: none of [${req.names.join(', ')}] wired via Studio.Audio.sfx`); }
}

// structural score: fraction of required events covered, +0.0..1 bonus weight for
// the music bed folded in so a fully-wired game with a bed reads as a perfect 1.0.
const sfxFrac = (REQUIRED.length - missing) / REQUIRED.length;
const score = +(sfxFrac * (hasMusicBed ? 1 : 0.9)).toFixed(3);
notes.push(hasMusicBed ? 'ok music bed: Studio.Audio.music(...) hook present'
                       : 'note: no music/loop bed hook (Studio.Audio.music) — SFX-only (soft; not required to pass)');
notes.push(`scanned ${files.length} source file(s); SFX wired: ${[...sfxWired].sort().join(', ') || 'none'}`);

const pass = missing === 0; // pass iff all KEY SFX events are present
emit({
  pass, score, capability: 'music', deterministic: true,
  game: path.basename(gameDir), required: REQUIRED.map((r) => r.event),
  covered, sfxWired: [...sfxWired].sort(), musicBed: hasMusicBed, notes,
}, pass ? 0 : 1);
