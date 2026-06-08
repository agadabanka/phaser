/*
 * Sprite Studio — the MOTION / QUALITY half of validate(), via Gemini.
 *
 * Given a CONTACT SHEET of one animation's frames (built in the browser by
 * app.js buildContactSheet, or by gen.mjs), ask gemini.js analyzeImages whether
 * the frames read as a SMOOTH cycle of ONE on-model character (consistent
 * silhouette + palette), score it 1-10, and list any broken / off-model frames.
 *
 * Returns a structured verdict: { available, pass, score, smooth, onModel,
 * brokenFrames, notes, raw }. If creds are absent we return { available:false }
 * so the caller can run STRUCTURAL-ONLY and say so — never a crash.
 *
 * Reused by check.mjs (per-anim, on the live studio's contact sheets) and gen.mjs
 * (on the freshly generated strip).
 */
import { analyzeImages, geminiConfigured } from '../art/gemini.js';

var PASS_SCORE = 6;          // >=6/10 reads as a usable cycle

function buildPrompt(kind) {
  return [
    'You are a sprite-animation QA reviewer for a 2D game studio.',
    'IMAGE 1 is a CONTACT SHEET: the ordered frames of a single "' + kind + '" animation cycle for ONE game character, laid left-to-right (frame indices labeled).',
    '',
    'Judge it as an animator would:',
    '1. Do these frames read as a SMOOTH, readable "' + kind + '" cycle when played in order (good inbetweening, no jarring pops, the motion arc makes sense for a ' + kind + ')?',
    '2. Is it ONE consistent, ON-MODEL character across every frame — same silhouette, proportions, palette and details (not drifting into a different character/colour)?',
    '3. Are any individual frames BROKEN or off-model (garbled, wrong pose, missing limbs, different character, stray background)?',
    '',
    'Reply with STRICT JSON only (no markdown):',
    '{',
    '  "score": <integer 1-10, overall animation quality>,',
    '  "smooth": <true|false>,',
    '  "onModel": <true|false>,',
    '  "brokenFrames": [<frame indices that are broken/off-model, may be empty>],',
    '  "notes": "<one or two short sentences of specific feedback>"',
    '}'
  ].join('\n');
}

function extractJson(text) {
  if (!text) return null;
  var t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  var s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s === -1 || e === -1 || e < s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch (_) { return null; }
}

// contactPngBase64 = raw PNG bytes base64-encoded (no data: prefix); kind = idle|run|jump
export async function validateMotion(contactPngBase64, kind, { label } = {}) {
  if (!geminiConfigured()) {
    return { available: false, kind: kind, note: 'Gemini not configured (set GEMINI_SA_JSON / GOOGLE_APPLICATION_CREDENTIALS / GEMINI_API_KEY) — ran structural-only.' };
  }
  let raw = '';
  try {
    raw = await analyzeImages(
      [{ base64: contactPngBase64, mimeType: 'image/png', label: label || (kind + ' cycle contact sheet') }],
      buildPrompt(kind)
    );
  } catch (e) {
    return { available: true, error: String(e && e.message ? e.message : e), kind: kind, pass: false, note: 'Gemini call failed.' };
  }
  var j = extractJson(raw);
  if (!j) return { available: true, kind: kind, pass: false, raw: String(raw).slice(0, 300), note: 'could not parse Gemini JSON' };
  var score = Math.max(1, Math.min(10, parseInt(j.score, 10) || 0));
  return {
    available: true,
    kind: kind,
    score: score,
    smooth: !!j.smooth,
    onModel: !!j.onModel,
    brokenFrames: Array.isArray(j.brokenFrames) ? j.brokenFrames : [],
    notes: j.notes || '',
    pass: score >= PASS_SCORE && !!j.onModel,
    raw: raw
  };
}

export { PASS_SCORE };
