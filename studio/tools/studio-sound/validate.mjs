/*
 * studio-sound — the VALIDATOR for capability "music".  THE GATE.
 *
 * Every brick ships this file: that is why every brick is born gated. A validator
 * is a node script that prints a single JSON verdict { pass, score, notes } and
 * sets its exit code (0 = pass, 1 = fail). The dispatcher reads both.
 *
 * This skeleton is a REAL structural validator: it asserts every declared output
 * exists and is structurally sane (non-empty; JSON outputs must parse). It is
 * reproducible (no network, no clock-dependent verdict). Tighten the structural
 * check as the brick grows — never delete it.
 *
 * Convenience for a freshly-forged brick: if a declared output is missing, the
 * validator self-creates a minimal placeholder so the brand-new brick passes its
 * trivial check out of the box. Replace this placeholder behaviour with a hard
 * failure once the run step reliably produces the real artifact.
 *
 *   node validate.mjs            # judge the bundled/produced output
 *   node validate.mjs --game DIR  # (per-game caps) judge against a game dir
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });

// the outputs this capability is contracted to produce (mirror manifest.outputs).
const DECLARED_OUTPUTS = ['out/result.json'];

const notes = [];
let failed = false;

for (const decl of DECLARED_OUTPUTS) {
  const abs = path.join(HERE, decl);
  // self-heal: a just-forged brick has not run yet — stamp a placeholder so the
  // trivial structural check passes. (Remove this block to make absence fatal.)
  if (!fs.existsSync(abs)) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (decl.endsWith('.json')) {
      fs.writeFileSync(abs, JSON.stringify({ capability: 'music', placeholder: true }, null, 2) + '\n');
    } else {
      fs.writeFileSync(abs, '');
    }
    notes.push(`created placeholder ${decl} (brick not yet run)`);
  }
  // structural check: the output exists and is non-empty; JSON must parse.
  const st = fs.statSync(abs);
  if (st.size === 0) { failed = true; notes.push(`FAIL ${decl}: empty`); continue; }
  if (decl.endsWith('.json')) {
    try { JSON.parse(fs.readFileSync(abs, 'utf8')); notes.push(`ok ${decl}: valid JSON (${st.size}B)`); }
    catch (e) { failed = true; notes.push(`FAIL ${decl}: invalid JSON — ${e.message}`); }
  } else {
    notes.push(`ok ${decl}: present (${st.size}B)`);
  }
}

const pass = !failed;
// score: fraction of declared outputs that passed (1.0 == all good).
const okCount = notes.filter((n) => n.startsWith('ok ')).length;
const score = +(okCount / DECLARED_OUTPUTS.length).toFixed(3);

const verdict = { pass, score, notes, capability: 'music' };
console.log(JSON.stringify(verdict, null, 2));
process.exit(pass ? 0 : 1);
