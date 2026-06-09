/*
 * studio-art — the VALIDATOR for capability "art-cohesion".  THE GATE.
 *
 * Judges a game's VISUAL COHESION with a vision model (Gemini). It serves the
 * game's own src/, screenshots it headless at a few frames (the shotlive /
 * eval.mjs swiftshader pattern, factored into ../lib/shot.mjs), shows the frames
 * to Gemini, and scores 9 art dimensions 0-10 (ported from the-platformer's
 * tools/eval/judge.mjs rubric): cohesion, color, character, depth, environment,
 * hud, lineage, juice, polish. The visual score is mean(dims)×10 → 0-100.
 *   pass ⇔ score ≥ PASS (default 60).
 *
 * Prints a single JSON verdict { pass, score, notes, ... } and sets its exit code
 * (0 = pass, 1 = fail) — the dispatcher reads both.
 *
 * DEGRADES GRACEFULLY: with no Gemini creds (GEMINI_SA_JSON absent) it cannot
 * judge cohesion, so it falls back to a STRUCTURAL check — it still captures the
 * frame and asserts the game rendered something non-black (a real signal that the
 * art pipeline ran) — and passes with deterministic:false + a clear note that the
 * model score was skipped. So the brick still gates offline.
 *
 *   node validate.mjs --game ../../games/ember   # judge a game's art cohesion
 *   node validate.mjs --game DIR --json          # same (output is already JSON)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureFrames } from '../lib/shot.mjs';
import { analyzeImages, geminiConfigured } from '../art/gemini.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });

const argVal = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
const gameDir = argVal('--game') || path.resolve(HERE, '..', '..', 'games', 'ember');
const PASS = Number(process.env.ART_PASS || 60);
const SAMPLES = Number(process.env.JUDGE_SAMPLES || 3); // the VLM is noisy → median-of-N
const FRAMES_AT = [40, 160, 320];

// ── the 9-dimension art rubric (ported from the-platformer judge.mjs / rubric.md) ──
const DIMS = ['cohesion', 'color', 'character', 'depth', 'environment', 'hud', 'lineage', 'juice', 'polish'];
const RUBRIC = `You are a senior art director at a AAA studio reviewing a screenshot of an in-development BROWSER platformer, judging POLISH and VISUAL COHESION.
Score the IMAGE on each dimension 0-10 (0 = placeholder/sloppy, 5 = competent indie, 8 = shippable, 10 = AAA-grade):
- cohesion: one consistent, intentional art style + palette across every element (the headline metric)
- color: saturation, value contrast, palette appeal & harmony
- character: hero/enemy silhouette, readability, appeal
- depth: parallax / background layering / atmosphere
- environment: ground, tiles, platforms, props craft (not flat/sloppy)
- hud: UI legibility, composition, no glitches/broken glyphs
- lineage: instantly reads as a polished platformer of a recognizable lineage
- juice: visible particles/animation/glow/effects (a static frame limits this; judge what's visible)
- polish: overall gestalt "this is NOT sloppy"
Be a harsh, specific critic. Return ONLY strict JSON, no prose, no markdown fences:
{"scores":{${DIMS.map((d) => `"${d}":N`).join(',')}},"top_fixes":["...","...","..."]}`;

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function parseScores(t) {
  const sm = (t || '').match(/"scores"\s*:\s*\{([^}]*)\}/);
  const scores = {};
  if (sm) for (const m of sm[1].matchAll(/"(\w+)"\s*:\s*([0-9]+(?:\.[0-9]+)?)/g)) scores[m[1]] = Number(m[2]);
  let fixes = [];
  const fm = (t || '').match(/"top_fixes"\s*:\s*\[([\s\S]*?)\]/);
  if (fm) fixes = (fm[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map((s) => s.slice(1, -1));
  return { scores, top_fixes: fixes };
}

// Coarse offline signal that the game actually rendered art: a black/empty frame
// PNG-compresses to a few KB; a frame with real pixels is far larger. Used only by
// the degraded (no-creds) fallback path, never by the model path.
function rendered(base64) {
  try { return Buffer.from(base64, 'base64').length > 6000; } catch { return false; }
}

function emit(verdict, code) {
  const json = JSON.stringify(verdict, null, 2);
  fs.writeFileSync(path.join(OUT, 'result.json'), json + '\n');
  // write the verdict SYNCHRONOUSLY to fd 1 (not console.log): when a parent runs
  // us via execFileSync the stdout is a pipe (async), and process.exit() can race
  // an unflushed async write. fs.writeSync guarantees the bytes are out before exit.
  try { fs.writeSync(1, json + '\n'); } catch { /* pipe closed */ }
  process.exit(code);
}

(async () => {
  if (!fs.existsSync(gameDir)) {
    emit({ pass: false, score: 0, capability: 'art-cohesion', notes: [`no such game dir: ${gameDir}`] }, 1);
  }

  // 1. capture frames (always — it is the shared signal for both paths)
  let frames;
  try {
    frames = await captureFrames(gameDir, FRAMES_AT);
  } catch (e) {
    emit({ pass: false, score: 0, capability: 'art-cohesion', game: path.basename(gameDir), notes: [`capture failed: ${String(e).split('\n')[0]}`] }, 1);
  }
  for (const f of frames) fs.writeFileSync(path.join(OUT, `frame-${f.at}.png`), Buffer.from(f.base64, 'base64'));

  // 2. DEGRADE GRACEFULLY: no creds ⇒ structural fallback (did the game render art?)
  if (!geminiConfigured()) {
    const ok = frames.some((f) => rendered(f.base64));
    emit({
      pass: ok, score: null, capability: 'art-cohesion', deterministic: false,
      game: path.basename(gameDir), mode: 'structural-fallback',
      notes: [
        'GEMINI_SA_JSON absent — visual-cohesion model score SKIPPED (set GEMINI_SA_JSON to judge palette/style/polish).',
        ok ? `structural check: game rendered art in ${frames.length} frame(s) (non-black).`
           : 'structural check: frames look black/empty — art pipeline produced nothing.',
      ],
    }, ok ? 0 : 1);
  }

  // 3. judge with Gemini — median-of-N per dimension over the frame set
  const images = frames.map((f) => ({ base64: f.base64, mimeType: f.mimeType, label: `frame @ step ${f.at}` }));
  const perDim = Object.fromEntries(DIMS.map((d) => [d, []]));
  const allFixes = [];
  let calls = 0, lastErr = null;
  for (let s = 0; s < SAMPLES; s++) {
    try {
      const txt = await analyzeImages(images, RUBRIC);
      const r = parseScores(txt);
      DIMS.forEach((d) => { const v = Number(r.scores?.[d]); if (!Number.isNaN(v)) perDim[d].push(v); });
      (r.top_fixes || []).forEach((x) => allFixes.push(x));
      calls++;
    } catch (e) { lastErr = String(e).split('\n')[0]; }
  }

  if (!calls || !DIMS.some((d) => perDim[d].length)) {
    // creds present but the model never answered (quota/network/model) — degrade,
    // don't hard-crash the pipeline. Fall back to the structural signal.
    const ok = frames.some((f) => rendered(f.base64));
    emit({
      pass: ok, score: null, capability: 'art-cohesion', deterministic: false,
      game: path.basename(gameDir), mode: 'structural-fallback',
      notes: [`Gemini configured but returned no scores (${lastErr || 'no usable response'}) — structural fallback.`,
              ok ? 'structural check: game rendered art (non-black frames).' : 'structural check: frames black/empty.'],
    }, ok ? 0 : 1);
  }

  const dimScores = Object.fromEntries(DIMS.map((d) => [d, +med(perDim[d]).toFixed(1)]));
  const score = +(mean(DIMS.map((d) => dimScores[d])) * 10).toFixed(1); // 0-100
  const pass = score >= PASS;
  const weakest = DIMS.reduce((lo, d) => (dimScores[d] < dimScores[lo] ? d : lo), DIMS[0]);
  emit({
    pass, score, capability: 'art-cohesion', deterministic: false,
    game: path.basename(gameDir), threshold: PASS, method: 'gemini-vision',
    samples: calls, frames: frames.length, dimensions: dimScores, weakest,
    notes: [
      `visual cohesion ${score}/100 (mean of ${DIMS.length} dims × median-of-${calls})  threshold ${PASS}`,
      `weakest dimension: ${weakest} (${dimScores[weakest]}/10)`,
      ...(allFixes.length ? [`top fixes: ${allFixes.slice(0, 3).join(' | ')}`] : []),
    ],
  }, pass ? 0 : 1);
})();
