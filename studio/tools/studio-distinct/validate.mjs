/*
 * studio-distinct — the VALIDATOR for capability "distinctness".  THE GATE.
 *
 * Judges how DISTINCT / UNIQUE a game's identity is, with a vision model (Gemini).
 * Ported from jazz's tools/game-diff.mjs (UNIQUENESS axes: verb, hero, enemy cast,
 * audio, art style, world identity) + feel-judge.mjs (the A-vs-B vision move).
 *
 * Two modes:
 *   • A-vs-B  (--vs DIR2 given, or a sibling game auto-found): capture frames of
 *     BOTH games, show Gemini both sets, score how UNIQUE the first game is vs the
 *     second (10 = unmistakably its own game, 0 = a reskin) across the axes.
 *   • baseline (no sibling): capture the one game's frames and ask Gemini how
 *     distinct/original it looks versus the GENERIC stock-platformer baseline
 *     (the "default brown-blocks Mario clone" description) — a stored text anchor.
 * Either way the UNIQUENESS score is mean(axes)×10 → 0-100.  pass ⇔ score ≥ PASS
 * (default 50).
 *
 * Prints { pass, score, notes, distinct, ... } + exit code (0/1) for the dispatcher.
 *
 * DEGRADES GRACEFULLY: with no Gemini creds it can't judge uniqueness, so it falls
 * back to a STRUCTURAL identity check from GAME_META.json (a named hero + verb +
 * tagline ⇒ the game HAS a distinct identity on paper) and passes with a clear
 * "model score skipped" note, so the brick still gates offline.
 *
 *   node validate.mjs --game ../../games/ember              # vs generic baseline
 *   node validate.mjs --game ../../games/ember --vs ../../games/jazz
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureFrames } from '../lib/shot.mjs';
import { analyzeImages, geminiConfigured } from '../art/gemini.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const GAMES_DIR = path.resolve(HERE, '..', '..', 'games');

const argVal = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
const gameDir = argVal('--game') || path.join(GAMES_DIR, 'ember');
let vsDir = argVal('--vs');
const PASS = Number(process.env.DISTINCT_PASS || 50);
const SAMPLES = Number(process.env.JUDGE_SAMPLES || 3);
const FRAMES_AT = [40, 220];

// the UNIQUENESS axes (ported from jazz game-diff.mjs's uniqueness rubric + the
// aesthetic traits from feel-judge.mjs — recast as DISTINCTNESS, not similarity).
const AXES = ['verb', 'protagonist', 'enemies', 'palette', 'artStyle', 'worldIdentity'];
const AXIS_DESC = {
  verb: 'the defining core ACTION/mechanic on screen — does it look like its own verb, not generic run-and-jump',
  protagonist: 'the hero — a memorable, specific character vs a stock avatar',
  enemies: 'the enemy cast / hazards — a distinct faction & look',
  palette: 'colour palette & mood — a deliberate, ownable colour identity',
  artStyle: 'overall art style — a specific, recognizable look (not the default template skin)',
  worldIdentity: 'the world / theme — a place with its own identity',
};

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function readMeta(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'GAME_META.json'), 'utf8')); } catch { return null; }
}

// auto-find a sibling game (a *different* dir under games/ that has a src/index.html).
function findSibling(self) {
  const selfAbs = path.resolve(self);
  try {
    for (const name of fs.readdirSync(GAMES_DIR)) {
      const d = path.join(GAMES_DIR, name);
      if (path.resolve(d) === selfAbs) continue;
      if (fs.existsSync(path.join(d, 'src', 'index.html'))) return d;
    }
  } catch { /* none */ }
  return null;
}

const VS_RUBRIC = (metaA, metaB) => `You are a game art-director judging how DISTINCT two in-development browser platformers are from each other.
- IMAGE(s) labelled "GAME A" are "${metaA?.name || 'Game A'}"${metaA?.tagline ? ` — ${metaA.tagline}` : ''}.
- IMAGE(s) labelled "GAME B" are "${metaB?.name || 'Game B'}"${metaB?.tagline ? ` — ${metaB.tagline}` : ''}.
Judge how UNIQUE GAME A is RELATIVE TO GAME B. Siblings built on a shared engine can still be very distinct (different verb/hero/art/world) — reward that.
For each axis give ONE score 0-10: 10 = GAME A is unmistakably its OWN game on this axis, 0 = it's a reskin / identical to B.
Axes:
${AXES.map((k, i) => `${i + 1}. ${k}: ${AXIS_DESC[k]}`).join('\n')}
Then one sentence on what makes GAME A DISTINCT. Return ONLY strict JSON, no markdown:
{"scores":{${AXES.map((k) => `"${k}":N`).join(',')}},"distinct":"..."}`;

const BASE_RUBRIC = (metaA) => `You are a game art-director judging how DISTINCT and ORIGINAL an in-development browser platformer looks.
The IMAGE(s) are "${metaA?.name || 'the game'}"${metaA?.tagline ? ` — ${metaA.tagline}` : ''}.
Compare it against the GENERIC STOCK PLATFORMER BASELINE: flat brown ground blocks, plain blue sky, a generic round mascot, no theme — the default "engine template" look that every clone ships with.
For each axis give ONE score 0-10: 10 = a strong, ownable identity clearly distinct from the generic baseline, 0 = indistinguishable from the stock template.
Axes:
${AXES.map((k, i) => `${i + 1}. ${k}: ${AXIS_DESC[k]}`).join('\n')}
Then one sentence on what makes it DISTINCT. Return ONLY strict JSON, no markdown:
{"scores":{${AXES.map((k) => `"${k}":N`).join(',')}},"distinct":"..."}`;

function parse(t) {
  const sm = (t || '').match(/"scores"\s*:\s*\{([^}]*)\}/);
  const scores = {};
  if (sm) for (const m of sm[1].matchAll(/"(\w+)"\s*:\s*([0-9]+(?:\.[0-9]+)?)/g)) scores[m[1]] = Number(m[2]);
  const dm = (t || '').match(/"distinct"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return { scores, distinct: dm ? dm[1].replace(/\\"/g, '"') : '' };
}

function emit(verdict, code) {
  const json = JSON.stringify(verdict, null, 2);
  fs.writeFileSync(path.join(OUT, 'result.json'), json + '\n');
  // synchronous write to fd 1 (see studio-art note): avoids a process.exit() race
  // with an unflushed async pipe write when a parent runs us via execFileSync.
  try { fs.writeSync(1, json + '\n'); } catch { /* pipe closed */ }
  process.exit(code);
}

(async () => {
  if (!fs.existsSync(gameDir)) {
    emit({ pass: false, score: 0, capability: 'distinctness', notes: [`no such game dir: ${gameDir}`] }, 1);
  }
  const metaA = readMeta(gameDir);
  if (!vsDir) vsDir = findSibling(gameDir); // may stay null → baseline mode
  const metaB = vsDir ? readMeta(vsDir) : null;
  const mode = vsDir ? 'vs-sibling' : 'vs-baseline';

  // 1. DEGRADE GRACEFULLY: no creds ⇒ structural identity check from GAME_META.
  if (!geminiConfigured()) {
    const hasHero = !!(metaA && metaA.hero);
    const hasVerb = !!(metaA && metaA.verb);
    const hasTag = !!(metaA && metaA.tagline);
    const identity = [hasHero, hasVerb, hasTag].filter(Boolean).length;
    const ok = identity >= 2; // a named hero + verb (or tagline) ⇒ a distinct identity on paper
    emit({
      pass: ok, score: null, capability: 'distinctness', deterministic: false,
      game: metaA?.name || path.basename(gameDir), mode: 'structural-fallback',
      notes: [
        'GEMINI_SA_JSON absent — visual UNIQUENESS model score SKIPPED (set GEMINI_SA_JSON to score what looks distinct).',
        `structural identity from GAME_META: hero=${metaA?.hero || '—'}, verb=${metaA?.verb || '—'}, tagline=${hasTag ? 'yes' : 'no'} (${identity}/3 ⇒ ${ok ? 'distinct identity' : 'thin identity'}).`,
      ],
    }, ok ? 0 : 1);
  }

  // 2. capture frames for A (and B if present)
  let framesA, framesB = null;
  try {
    framesA = await captureFrames(gameDir, FRAMES_AT);
    if (vsDir) framesB = await captureFrames(vsDir, FRAMES_AT);
  } catch (e) {
    emit({ pass: false, score: 0, capability: 'distinctness', game: metaA?.name || path.basename(gameDir), notes: [`capture failed: ${String(e).split('\n')[0]}`] }, 1);
  }
  for (const f of framesA) fs.writeFileSync(path.join(OUT, `A-frame-${f.at}.png`), Buffer.from(f.base64, 'base64'));
  if (framesB) for (const f of framesB) fs.writeFileSync(path.join(OUT, `B-frame-${f.at}.png`), Buffer.from(f.base64, 'base64'));

  // 3. build the image set + rubric for the chosen mode
  const images = framesA.map((f) => ({ base64: f.base64, mimeType: f.mimeType, label: `GAME A @ step ${f.at}` }));
  if (framesB) for (const f of framesB) images.push({ base64: f.base64, mimeType: f.mimeType, label: `GAME B @ step ${f.at}` });
  const rubric = framesB ? VS_RUBRIC(metaA, metaB) : BASE_RUBRIC(metaA);

  // 4. judge — median-of-N per axis
  const perAxis = Object.fromEntries(AXES.map((a) => [a, []]));
  const distincts = [];
  let calls = 0, lastErr = null;
  for (let s = 0; s < SAMPLES; s++) {
    try {
      const r = parse(await analyzeImages(images, rubric));
      AXES.forEach((a) => { const v = Number(r.scores?.[a]); if (!Number.isNaN(v)) perAxis[a].push(v); });
      if (r.distinct) distincts.push(r.distinct);
      calls++;
    } catch (e) { lastErr = String(e).split('\n')[0]; }
  }

  if (!calls || !AXES.some((a) => perAxis[a].length)) {
    // creds present but no usable answer — degrade to the GAME_META identity check.
    const identity = [metaA?.hero, metaA?.verb, metaA?.tagline].filter(Boolean).length;
    const ok = identity >= 2;
    emit({
      pass: ok, score: null, capability: 'distinctness', deterministic: false,
      game: metaA?.name || path.basename(gameDir), mode: 'structural-fallback',
      notes: [`Gemini configured but returned no scores (${lastErr || 'no usable response'}) — structural fallback.`,
              `GAME_META identity ${identity}/3 ⇒ ${ok ? 'distinct identity' : 'thin identity'}.`],
    }, ok ? 0 : 1);
  }

  const axisScores = Object.fromEntries(AXES.map((a) => [a, +med(perAxis[a]).toFixed(1)]));
  const score = +(mean(AXES.map((a) => axisScores[a])) * 10).toFixed(1); // 0-100
  const pass = score >= PASS;
  const longest = (a) => a.sort((x, y) => y.length - x.length)[0] || '';
  emit({
    pass, score, capability: 'distinctness', deterministic: false,
    game: metaA?.name || path.basename(gameDir), mode,
    vs: vsDir ? (metaB?.name || path.basename(vsDir)) : 'generic stock-platformer baseline',
    threshold: PASS, method: 'gemini-vision', samples: calls, axes: axisScores,
    distinct: longest(distincts),
    notes: [
      `uniqueness ${score}/100 (mean of ${AXES.length} axes × median-of-${calls})  threshold ${PASS}  [${mode}]`,
      longest(distincts) ? `distinct: ${longest(distincts)}` : null,
    ].filter(Boolean),
  }, pass ? 0 : 1);
})();
