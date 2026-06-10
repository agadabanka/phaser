/*
 * notes-loop — the VALIDATOR for capability "feedback".  THE GATE.
 *
 * Deterministic reconciliation of the notes loop (no network):
 *   - notes/inbox.json parses; every note has a unique key + a gameDir
 *   - notes/triage.json parses; every item references a REAL inbox noteKey, a
 *     capability that exists in the registry (or "engine"), a severity in
 *     {low,med,high}, and a non-empty suggestion; no note triaged twice
 *   - an EMPTY loop passes with a note — the gate judges integrity, not volume.
 *
 *   node validate.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
function emit(v, code) { const j = JSON.stringify(v, null, 2); fs.writeFileSync(path.join(OUT, 'verdict.json'), j + '\n'); console.log(j); process.exit(code); }
// missing file => the default (loop simply hasn't run yet); only EXISTING but
// malformed JSON is a failure.
const readJson = (p, d) => { if (!fs.existsSync(p)) return d; try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return e; } };

const notes = []; let checks = 0, ok = 0;
const check = (cond, okMsg, failMsg) => { checks++; if (cond) { ok++; if (okMsg) notes.push('ok ' + okMsg); } else notes.push('FAIL ' + failMsg); };

const inbox = readJson(path.join(STUDIO, 'notes', 'inbox.json'), { notes: [] });
const triage = readJson(path.join(STUDIO, 'notes', 'triage.json'), { items: [] });
if (inbox instanceof Error) emit({ pass: false, score: 0, capability: 'feedback', notes: ['inbox.json unparseable: ' + inbox.message] }, 1);
if (triage instanceof Error) emit({ pass: false, score: 0, capability: 'feedback', notes: ['triage.json unparseable: ' + triage.message] }, 1);

const keys = (inbox.notes || []).map((n) => n.key);
check(new Set(keys).size === keys.length, `inbox: ${keys.length} note(s), keys unique`, 'inbox has duplicate keys');
for (const n of inbox.notes || []) if (!n.key || !n.gameDir) { check(false, null, `inbox note missing key/gameDir`); break; }

const caps = new Set([...(readJson(path.join(STUDIO, 'lego', 'registry.json'), { tools: [] }).tools || []).map((t) => t.capability), 'engine']);
const keySet = new Set(keys);
const tks = (triage.items || []).map((t) => t.noteKey);
check(new Set(tks).size === tks.length, `triage: ${tks.length} item(s), no double-triage`, 'a note was triaged twice');
for (const t of triage.items || []) {
  check(keySet.has(t.noteKey), null, `triage references unknown note "${t.noteKey}"`);
  check(caps.has(t.capability), null, `triage has unknown capability "${t.capability}"`);
  check(['low', 'med', 'high'].includes(t.severity), null, `bad severity "${t.severity}"`);
  check(!!(t.suggestion && t.suggestion.trim()), null, `empty suggestion on ${t.noteKey}`);
}
if (!keys.length) notes.push('note: inbox empty — loop wired, waiting for playtests');

const pass = ok === checks, score = +(checks ? ok / checks : 1).toFixed(3);
notes.unshift(`feedback loop: ${ok}/${checks} integrity checks · ${keys.length} note(s) · ${tks.length} triaged`);
emit({ pass, score, capability: 'feedback', deterministic: true, notes: notes.slice(0, 30) }, pass ? 0 : 1);
