/*
 * notes-loop — the RUN step for capability "feedback" (RFC-001 §4).
 * "Notes from every game should improve the engine" — this brick closes it:
 *
 *   pull    walk every games/<g>/GAME_META.json with a url, fetch its live
 *           /api/notes, merge + dedupe into studio/notes/inbox.json (committed
 *           = durable; deployments' disks are ephemeral).
 *   triage  classify every un-triaged note against the registry's CAPABILITIES
 *           using its context (level/x/y/coins/deaths + text) — Gemini text when
 *           creds exist, a keyword heuristic otherwise — into studio/notes/
 *           triage.json {noteKey, game, capability, severity, suggestion}.
 *
 *   node tool.mjs pull
 *   node tool.mjs triage [--offline]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const NOTES = path.join(STUDIO, 'notes');
fs.mkdirSync(NOTES, { recursive: true });
const INBOX = path.join(NOTES, 'inbox.json'), TRIAGE = path.join(NOTES, 'triage.json');
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const mode = process.argv[2], offline = process.argv.includes('--offline');
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };

if (mode === 'pull') {
  const inbox = readJson(INBOX, { notes: [] });
  const seen = new Set(inbox.notes.map((n) => n.key));
  const games = fs.readdirSync(path.join(STUDIO, 'games'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  let added = 0;
  for (const g of games) {
    const meta = readJson(path.join(STUDIO, 'games', g, 'GAME_META.json'), {});
    if (!meta.url) { console.log(`   ${g}: no url — skipped`); continue; }
    try {
      const res = await fetch(meta.url.replace(/\/$/, '') + '/api/notes', { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const ns = await res.json();
      let g_added = 0;
      for (const n of ns || []) {
        const key = g + ':' + (n.id ?? (n.ts || '') + ':' + (n.text || '').slice(0, 24));
        if (seen.has(key)) continue;
        seen.add(key); added++; g_added++;
        inbox.notes.push({ key, gameDir: g, pulledAt: new Date().toISOString(), ...n });
      }
      console.log(`   ${g}: ${ns.length} live note(s), ${g_added} new`);
    } catch (e) { console.log(`   ${g}: pull failed — ${e.message}`); }
  }
  inbox.pulledAt = new Date().toISOString();
  fs.writeFileSync(INBOX, JSON.stringify(inbox, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ capability: 'feedback', mode: 'pull', total: inbox.notes.length, added }, null, 2) + '\n');
  console.log(`📥 notes/inbox.json — ${inbox.notes.length} note(s) total, ${added} new`);
  process.exit(0);
}

if (mode === 'triage') {
  const inbox = readJson(INBOX, { notes: [] }), triage = readJson(TRIAGE, { items: [] });
  const doneKeys = new Set(triage.items.map((t) => t.noteKey));
  const caps = readJson(path.join(STUDIO, 'lego', 'registry.json'), { tools: [] }).tools.map((t) => t.capability);
  const todo = inbox.notes.filter((n) => !doneKeys.has(n.key));
  if (!todo.length) { console.log('nothing to triage — inbox clean'); writeResult(triage); process.exit(0); }
  const HEUR = [
    [/music|sound|sfx|audio|quiet|loud|hear/i, 'music'],
    [/jump|coyote|float|control|slip|slide|feel|stiff|input|late/i, 'feel'],
    [/tile|texture|floor|repeat|placeholder|art|look|colou?r|palette|sprite/i, 'art-cohesion'],
    [/level|gap|wall|platform|hard|easy|stuck|unfair|spike|fall/i, 'rules'],
    [/lag|crash|bug|freeze|broken|softlock/i, 'gate'],
  ];
  const heur = (n) => { for (const [re, cap] of HEUR) if (re.test(n.text || '')) return cap; return 'feel'; };
  let viaGemini = false; const classified = [];
  if (!offline && (process.env.GEMINI_SA_JSON || process.env.GEMINI_API_KEY)) {
    try {
      const { generateText } = await import('../art/gemini.js');
      const prompt = `You triage playtest notes for a game studio. Capabilities: ${caps.join(', ')}, or "engine" for SDK/runtime issues.
For EACH note output ONE JSON object per line, nothing else: {"i":<index>,"capability":"<one capability>","severity":"low|med|high","suggestion":"<one actionable sentence for the next dispatch of that capability>"}
Notes:
${todo.map((n, i) => `${i}: [game=${n.gameDir} where=${n.where || ''} deaths=${n.deaths ?? ''} coins=${n.coins ?? ''}] ${n.text}`).join('\n')}`;
      const txt = await generateText(prompt, { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } });
      for (const line of txt.split('\n')) { const m = line.match(/\{.*\}/); if (!m) continue; try { const o = JSON.parse(m[0]); if (o.i != null && todo[o.i]) classified[o.i] = o; } catch { /* skip */ } }
      viaGemini = classified.filter(Boolean).length > 0;
    } catch (e) { console.log('   gemini triage failed (' + String(e.message).slice(0, 80) + ') — heuristics'); }
  }
  todo.forEach((n, i) => {
    const c = classified[i] || {};
    const capability = (c.capability && (caps.includes(c.capability) || c.capability === 'engine')) ? c.capability : heur(n);
    triage.items.push({ noteKey: n.key, game: n.gameDir, capability, severity: c.severity || 'med', suggestion: c.suggestion || ('investigate: "' + (n.text || '').slice(0, 80) + '"'), where: n.where || null, status: 'open', triagedAt: new Date().toISOString(), via: classified[i] ? 'gemini' : 'heuristic' });
  });
  triage.triagedAt = new Date().toISOString();
  fs.writeFileSync(TRIAGE, JSON.stringify(triage, null, 2) + '\n');
  writeResult(triage);
  console.log(`🧭 triaged ${todo.length} note(s) (${viaGemini ? 'gemini' : 'heuristic'}) → notes/triage.json`);
  for (const t of triage.items.filter((x) => x.status === 'open').slice(-6)) console.log(`   [${t.severity}] ${t.capability} ← ${t.game}: ${t.suggestion.slice(0, 90)}`);
  process.exit(0);
}

function writeResult(triage) {
  const open = (triage.items || []).filter((t) => t.status === 'open');
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ capability: 'feedback', mode: 'triage', items: (triage.items || []).length, open: open.length, byCapability: open.reduce((m, t) => { m[t.capability] = (m[t.capability] || 0) + 1; return m; }, {}) }, null, 2) + '\n');
}
console.error('usage: node tool.mjs pull | triage [--offline]');
process.exit(2);
