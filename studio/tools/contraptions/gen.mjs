/*
 * Contraption AI-assist generator.
 *
 *   node gen.mjs "<description>"
 *
 * Calls Gemini (via ../art/gemini.js generateText) with a prompt that pins the
 * model to the EXISTING Studio.Contraptions registry: it must return a JSON
 * contraption spec using ONLY the registry types (seesaw / launcher / crumble),
 * sensible params, and a one-line feeling — and, if the description implies a NEW
 * kind of machine, NAME the closest existing type instead of inventing one.
 *
 * The registry (types + their {feeling,lens,weight}) is read LIVE from the SDK
 * (studio.js exports module.exports = Studio under Node) so the prompt + the
 * post-parse validation never drift from the real SDK.
 *
 * Auth is GEMINI_SA_JSON (or GOOGLE_APPLICATION_CREDENTIALS / GEMINI_API_KEY),
 * exactly like the rest of the art pipeline. If NO creds are present we DO NOT
 * crash: we print a clear "needs GEMINI creds" message + a sensible hand-written
 * fallback spec (chosen by keyword) so the tool is still useful offline.
 */
import { createRequire } from 'node:module';
import { generateText, geminiConfigured } from '../art/gemini.js';

const require = createRequire(import.meta.url);
const Studio = require('./studio.js');                 // live registry (CJS export)
const C = Studio.Contraptions;
const TYPES = C.types;                                 // ['seesaw','launcher','crumble']

// --------------------------------------------------------------------- registry
// A compact, machine-readable description of every registry type for the prompt —
// each entry's feeling/lens/weight + the params its build() actually reads.
const PARAM_HINTS = {
  seesaw:   'x (px), tilt (radians, ~0.05-0.4), period (seconds per tilt cycle, ~1-4), nudge (px/s downhill carry, ~40-90)',
  launcher: "x (px), vel (launch velocity px/s, ~600-1200), mode ('contact' | 'cycle'), period (seconds, cycle mode only)",
  crumble:  'x (px), delay (frames after first touch before it falls, ~12-60), w (width px), h (height px)'
};
const REGISTRY_DOC = TYPES.map((t) => {
  const m = C.meta(t);
  return `  - ${t}: feeling="${m.feeling}", lens=${m.lens}, weight=${m.weight}\n      params: ${PARAM_HINTS[t] || 'x'}`;
}).join('\n');

// --------------------------------------------------------------------- fallback
// Keyword -> closest registry type, so the offline fallback is sensible (a
// "swinging blade" maps to seesaw's tilt feeling, a "cannon" to launcher, etc.).
const FALLBACK_RULES = [
  { type: 'launcher', re: /launch|spring|cannon|geyser|bounce|fling|jump\s*pad|catapult|blast|rocket|boost|propel/i },
  { type: 'crumble',  re: /crumbl|collaps|fall(ing)?|fragile|break|brittle|disintegrat|decay|timer|trap\s*door|sink/i },
  { type: 'seesaw',   re: /swing|blade|pendulum|tilt|balanc|see-?saw|teeter|plank|lever|rock(ing)?|wobble|sway|scale/i }
];
function closestType(desc) {
  for (const r of FALLBACK_RULES) if (r.re.test(desc)) return r.type;
  return 'seesaw';                                      // a safe, gate-friendly default
}
function fallbackSpec(desc) {
  const type = closestType(desc);
  const meta = C.meta(type);
  const base = { type, x: 480 };
  const params = {
    seesaw:   { tilt: 0.18, period: 2.0, nudge: 70 },
    launcher: { vel: 920, mode: 'contact' },
    crumble:  { delay: 26, w: 120 }
  }[type];
  return {
    spec: { ...base, ...params },
    feeling: meta.feeling,
    closestType: type,
    note: `hand-picked: "${desc}" best matches the "${type}" machine (${meta.lens} / ${meta.feeling}).`
  };
}

// --------------------------------------------------------------------- prompt
function buildPrompt(desc) {
  return [
    'You are a level-design assistant for a Phaser platformer studio.',
    'The engine has a FIXED registry of kinematic "contraptions". You may ONLY use these types:',
    '',
    REGISTRY_DOC,
    '',
    `The designer wants: "${desc}".`,
    '',
    'Return ONE contraption proposal as STRICT JSON (no markdown, no commentary) with EXACTLY this shape:',
    '{',
    '  "type": "<one of: ' + TYPES.join(' | ') + '>",',
    '  "params": { "x": <int px>, ... other params relevant to that type ... },',
    '  "feeling": "<one short line describing the emotional payload>",',
    '  "closestType": "<the registry type you chose>",',
    '  "rationale": "<one sentence: why this type best fits the description>"',
    '}',
    '',
    'Rules:',
    '- Use ONLY a registry type. If the description implies a NEW/unsupported machine,',
    '  pick the CLOSEST existing type and say so in "rationale".',
    '- Choose params from that type\'s allowed list above, with values in the sensible ranges.',
    '- x is a pixel position along the level (0-960 is typical); default 480 if unsure.',
    '- Keep "feeling" to a single short line.',
    '- Output ONLY the JSON object.'
  ].join('\n');
}

// pull the first {...} JSON object out of a model reply (handles ```json fences)
function extractJson(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s === -1 || e === -1 || e < s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch (_) { return null; }
}

// clamp the model's proposal onto the real registry (never trust it blindly)
function validate(proposal, desc) {
  if (!proposal || typeof proposal !== 'object') return null;
  let type = proposal.type || proposal.closestType;
  if (!C.has(type)) type = closestType(desc);          // snap to a real type
  const meta = C.meta(type);
  const params = (proposal.params && typeof proposal.params === 'object') ? proposal.params : {};
  if (params.x == null || isNaN(+params.x)) params.x = 480;
  return {
    spec: { type, ...params },
    feeling: proposal.feeling || meta.feeling,
    closestType: type,
    rationale: proposal.rationale || null,
    meta
  };
}

function printProposal(title, p) {
  const meta = p.meta || C.meta(p.spec.type);
  console.log('\n' + title);
  console.log('  type        : ' + p.spec.type);
  console.log('  feeling     : ' + p.feeling);
  console.log('  registry meta: lens=' + meta.lens + '  weight=' + meta.weight + '  (canonical: "' + meta.feeling + '")');
  if (p.rationale) console.log('  rationale   : ' + p.rationale);
  if (p.note) console.log('  note        : ' + p.note);
  // the FUN contribution this beat adds, via the same model the studio uses
  try {
    const W = 960, T = 40, GY = 380;
    const base = { name: 'gen', width: W, tile: T, groundY: GY, ground: [[0, W, 'stone']] };
    const withC = { ...base, contraptions: [{ ...p.spec, tile: T, groundY: GY }] };
    const d = +(Studio.Feel.score(withC).fun - Studio.Feel.score(base).fun).toFixed(1);
    console.log('  fun delta   : ' + (d >= 0 ? '+' : '') + d + ' (Studio.Feel.score with vs without)');
  } catch (_) {}
  console.log('  SPEC (drop into a level spec\'s "contraptions" array):');
  console.log('    ' + JSON.stringify(p.spec));
}

// --------------------------------------------------------------------- main
async function main() {
  const desc = process.argv.slice(2).join(' ').trim();
  if (!desc) {
    console.error('usage: node gen.mjs "<description of the contraption you want>"');
    process.exit(2);
  }

  console.log('Contraption AI-assist');
  console.log('  request : "' + desc + '"');
  console.log('  registry: ' + TYPES.join(', '));

  if (!geminiConfigured()) {
    console.log('\n[needs GEMINI creds] GEMINI_SA_JSON (or GOOGLE_APPLICATION_CREDENTIALS / GEMINI_API_KEY) is not set.');
    console.log('Falling back to a hand-written proposal (no network call):');
    printProposal('PROPOSAL (hand-written fallback)', fallbackSpec(desc));
    return;
  }

  let raw = '';
  try {
    raw = await generateText(buildPrompt(desc), {
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
    });
  } catch (e) {
    console.log('\n[Gemini call failed] ' + (e && e.message ? e.message : e));
    console.log('Falling back to a hand-written proposal:');
    printProposal('PROPOSAL (hand-written fallback)', fallbackSpec(desc));
    return;
  }

  const parsed = validate(extractJson(raw), desc);
  if (!parsed) {
    console.log('\n[Could not parse a valid spec from Gemini] raw reply:');
    console.log('  ' + String(raw).slice(0, 400));
    console.log('Falling back to a hand-written proposal:');
    printProposal('PROPOSAL (hand-written fallback)', fallbackSpec(desc));
    return;
  }
  printProposal('PROPOSAL (Gemini)', parsed);
}

main().catch((e) => { console.error('unexpected error:', e); process.exit(1); });
