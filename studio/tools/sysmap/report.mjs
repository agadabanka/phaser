/*
 * report.mjs — render the Studio Sysmap as a NICE PDF (out/sysmap-report.pdf).
 *
 * Same data the interactive map consumes (../../diary/diary.json +
 * ../../lego/registry.json), rendered as a print document via headless
 * Chromium's print engine (page.pdf — no LaTeX/pandoc deps):
 *
 *   cover (hero shot + by-the-numbers) -> how to read the map -> the 7-tier
 *   stack -> EVERY system one by one (grouped by tier, each with its kind,
 *   validator gate, description, and its connections derived from the edges)
 *   -> the FLOWS (the order systems are called) -> the build timeline.
 *
 *   node report.mjs            # writes out/sysmap-report.pdf
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(STUDIO, 'package.json'));
const { chromium } = require('playwright');

const diary = JSON.parse(fs.readFileSync(path.join(STUDIO, 'diary', 'diary.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(STUDIO, 'lego', 'registry.json'), 'utf8'));
const nodes = diary.graph.nodes, edges = diary.graph.edges;
const tiers = (diary.tiers || []).slice().sort((a, b) => a.order - b.order);
const byId = new Map(nodes.map((n) => [n.id, n]));
const caps = new Map((registry.tools || []).map((t) => [t.capability, t]));

const KIND = {
  sdk: { label: 'SDK module', color: '#2e7fa3' }, tool: { label: 'tool / brick', color: '#8a4fb0' },
  game: { label: 'game', color: '#c95a28' }, validator: { label: 'validator / gate', color: '#b08a20' },
  orchestrator: { label: 'orchestrator', color: '#2e8f5a' }, concept: { label: 'concept / doc', color: '#5a6b80' },
  tier: { label: 'tier', color: '#5a6b7a' },
};
const REL_OUT = { 'depends-on': 'needs', 'validated-by': 'gated by', 'feeds': 'feeds', 'produces': 'ships to', 'dispatched-by': 'invoked via', 'builds-on': 'builds on' };
const REL_IN = { 'depends-on': 'used by', 'validated-by': 'gates', 'feeds': 'fed by', 'produces': 'shipped from', 'dispatched-by': 'dispatches' };

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const img64 = (p) => { try { const f = path.isAbsolute(p) ? p : path.join(STUDIO, p); const ext = path.extname(f).slice(1) === 'jpg' ? 'jpeg' : path.extname(f).slice(1); return `data:image/${ext};base64,` + fs.readFileSync(f).toString('base64'); } catch { return null; } };

// connection prose for one node, derived from the edge set (capped per group)
function connections(id) {
  const groups = new Map();
  const add = (verb, who) => { if (!groups.has(verb)) groups.set(verb, []); groups.get(verb).push(who); };
  for (const e of edges) {
    if (e.from === id && byId.has(e.to)) { const v = REL_OUT[e.rel]; if (v && byId.get(e.to).kind !== 'tier') add(v, byId.get(e.to).label); }
    if (e.to === id && byId.has(e.from)) { const v = REL_IN[e.rel]; if (v && byId.get(e.from).kind !== 'tier') add(v, byId.get(e.from).label); }
  }
  const parts = [];
  for (const [verb, who] of groups) {
    const list = who.slice(0, 7).join(', ') + (who.length > 7 ? ` +${who.length - 7} more` : '');
    parts.push(`<b>${verb}</b> ${esc(list)}`);
  }
  return parts.join(' &nbsp;·&nbsp; ');
}

function validatorChip(n) {
  if (!n.validator) return '';
  const t = caps.get(n.validator);
  const detail = t ? `gated by ${t.name}${t.deterministic ? ' · deterministic' : ''}` : 'capability not in registry';
  return `<span class="chip gate" title="${esc(detail)}">✓ ${esc(n.validator)}</span>`;
}

// ---------------------------------------------------------------- document
const hero = img64('tools/sysmap/out/sysmap.png');
const kit = img64('tools/texture-kit/out/contact.png');
const today = new Date().toISOString().slice(0, 10);
const games = nodes.filter((n) => n.kind === 'game');

const tierSections = tiers.map((t) => {
  const inTier = nodes.filter((n) => n.tier === t.id && n.kind !== 'tier');
  if (!inTier.length) return '';
  const cards = inTier.map((n) => `
    <div class="card">
      <div class="card-head">
        <span class="dot" style="background:${(KIND[n.kind] || {}).color || '#888'}"></span>
        <b>${esc(n.label)}</b>
        <span class="chip kind">${esc((KIND[n.kind] || { label: n.kind }).label)}</span>
        ${validatorChip(n)}
      </div>
      <div class="desc">${esc(n.desc || '')}</div>
      ${connections(n.id) ? `<div class="conn">${connections(n.id)}</div>` : ''}
    </div>`).join('');
  return `
  <section class="tier-sec">
    <h2><span class="tier-no">${t.order}</span> ${esc(t.label)} <span class="muted">tier</span></h2>
    ${t.desc ? `<p class="tier-desc">${esc(t.desc)}</p>` : ''}
    <div class="grid">${cards}</div>
  </section>`;
}).join('');

const flowSections = (diary.flows || []).map((f) => `
  <section class="flow">
    <h3>${esc(f.title)}</h3>
    <p class="muted">${esc(f.desc || '')}</p>
    <ol>
      ${f.steps.map((s) => `<li><b>${esc((byId.get(s.node) || { label: s.node }).label)}</b> <span class="chip step">${esc(s.label)}</span><br><span class="note">${esc(s.note || '')}</span></li>`).join('')}
    </ol>
  </section>`).join('');

// build timeline: one row per phase
const phases = [];
{
  const seen = new Map();
  for (const e of (diary.entries || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (!seen.has(e.phase)) { const o = { phase: e.phase, date: e.date, titles: [] }; seen.set(e.phase, o); phases.push(o); }
    seen.get(e.phase).titles.push(e.title);
  }
}
const timeline = phases.map((p) => `
  <tr><td class="ph-name">${esc(p.phase)}</td><td class="ph-date">${esc(p.date)}</td>
  <td>${p.titles.map((t) => esc(t)).join('<br>')}</td></tr>`).join('');

const relRows = Object.entries({
  'depends-on': 'A needs B to run (Ember depends-on the Platformer controller).',
  'validated-by': 'A is gated by B — it cannot ship unless B passes (Ember validated-by the 0-death gate).',
  'feeds': 'A supplies input to B (the texture kit feeds Ember its tiles; the diary feeds this map).',
  'dispatched-by': 'A is invoked through B (every validator runs via the Lego dispatcher).',
  'produces': 'A creates B as an artifact (a shipped game produces a live Railway URL).',
  'builds-on': 'tier stacking — A is a layer above B.',
}).map(([r, d]) => `<tr><td><code>${r}</code></td><td>${esc(d)}</td></tr>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 16mm 14mm 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1c2330; margin: 0; }
  h1, h2, h3 { font-family: Georgia, "Times New Roman", serif; color: #14181f; }
  .muted { color: #6b7686; font-weight: 400; }
  code { background: #f0f2f6; border-radius: 4px; padding: 1px 5px; font-size: 9pt; }

  /* cover */
  .cover { page-break-after: always; text-align: left; padding-top: 10mm; }
  .cover .kicker { color: #b3540f; text-transform: uppercase; letter-spacing: .25em; font-size: 9pt; font-weight: 700; }
  .cover h1 { font-size: 30pt; margin: 4mm 0 2mm; }
  .cover .sub { font-size: 12pt; color: #45505f; max-width: 150mm; }
  .cover img { width: 100%; border-radius: 8px; border: 1px solid #d8dde6; margin: 7mm 0; }
  .nums { display: flex; gap: 6mm; margin-top: 4mm; }
  .num { border: 1px solid #e2e6ee; border-left: 4px solid #b3540f; border-radius: 6px; padding: 3mm 5mm; }
  .num b { display: block; font-size: 16pt; font-family: Georgia, serif; }
  .num span { font-size: 8.5pt; color: #6b7686; text-transform: uppercase; letter-spacing: .08em; }
  .cover .links { margin-top: 6mm; font-size: 9.5pt; color: #45505f; }

  h2 { font-size: 15pt; border-bottom: 2px solid #e8d9c3; padding-bottom: 1.5mm; margin: 8mm 0 3mm; }
  .tier-no { display: inline-block; background: #14181f; color: #ffd9a0; border-radius: 5px; padding: 0 2.4mm; font-size: 11pt; }
  .tier-desc { margin: 1mm 0 3mm; color: #45505f; }
  .tier-sec { page-break-inside: auto; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
  .card { border: 1px solid #e2e6ee; border-radius: 7px; padding: 2.6mm 3.2mm; page-break-inside: avoid; background: #fcfcfe; }
  .card-head { display: flex; align-items: center; gap: 2mm; flex-wrap: wrap; margin-bottom: 1mm; }
  .card-head b { font-size: 10.5pt; }
  .dot { width: 3.2mm; height: 3.2mm; border-radius: 50%; flex: none; }
  .chip { font-size: 7.5pt; border-radius: 99px; padding: .4mm 2.2mm; white-space: nowrap; }
  .chip.kind { background: #eef1f6; color: #4a5568; }
  .chip.gate { background: #e9f6ee; color: #1f7a45; border: 1px solid #bfe5cd; }
  .chip.step { background: #fdf1e2; color: #b3540f; }
  .desc { font-size: 9pt; color: #39424f; }
  .conn { font-size: 8.4pt; color: #5a6474; border-top: 1px dashed #e2e6ee; margin-top: 1.6mm; padding-top: 1.4mm; }
  .conn b { color: #b3540f; font-weight: 600; }

  table { border-collapse: collapse; width: 100%; font-size: 9pt; }
  td, th { border: 1px solid #e2e6ee; padding: 1.6mm 2.4mm; vertical-align: top; text-align: left; }
  th { background: #f4f6fa; }
  .ph-name { font-weight: 700; white-space: nowrap; } .ph-date { white-space: nowrap; color: #6b7686; }

  .flow { page-break-inside: avoid; margin-bottom: 5mm; }
  .flow h3 { margin: 4mm 0 1mm; font-size: 12.5pt; }
  .flow ol { margin: 2mm 0 0; padding-left: 6mm; }
  .flow li { margin-bottom: 1.6mm; font-size: 9.5pt; }
  .flow .note { color: #5a6474; font-size: 8.8pt; }

  .twoimg { display: flex; gap: 4mm; } .twoimg img { width: 50%; border: 1px solid #d8dde6; border-radius: 6px; }
  section { page-break-inside: auto; }
  .pagebreak { page-break-before: always; }
</style></head><body>

<div class="cover">
  <div class="kicker">Studio · Phaser 4 · ${esc(today)}</div>
  <h1>The Studio Sysmap</h1>
  <div class="sub">${esc(diary.project || '')} — every system in the studio, what it does, how it is gated, and how they call each other. Rendered from the same machine-readable build diary the interactive map uses.</div>
  ${hero ? `<img src="${hero}">` : ''}
  <div class="nums">
    <div class="num"><b>${nodes.filter((n) => n.kind !== 'tier').length}</b><span>systems</span></div>
    <div class="num"><b>${edges.length}</b><span>typed edges</span></div>
    <div class="num"><b>${tiers.length}</b><span>stack tiers</span></div>
    <div class="num"><b>${(diary.flows || []).length}</b><span>ordered flows</span></div>
    <div class="num"><b>${(diary.entries || []).length}</b><span>diary entries</span></div>
    <div class="num"><b>${games.length}</b><span>games</span></div>
  </div>
  <div class="links">
    Interactive map: <b>studio-sysmap-production.up.railway.app</b> &nbsp;·&nbsp; Flagship game: <b>ember-depths-production.up.railway.app</b><br>
    Source of truth: <code>studio/diary/diary.json</code> (graph + flows) · <code>studio/lego/registry.json</code> (gated bricks)
  </div>
</div>

<h2>How to read the map</h2>
<p>Every node is a <b>system</b>, colored by kind: <span style="color:#2e7fa3">■</span> SDK module · <span style="color:#8a4fb0">■</span> tool/brick · <span style="color:#c95a28">■</span> game · <span style="color:#b08a20">■</span> validator/gate · <span style="color:#2e8f5a">■</span> orchestrator · <span style="color:#5a6b80">■</span> concept/doc. A <span class="chip gate">✓ capability</span> chip means the system is <b>gated</b>: a validator in the Lego registry must pass before its output ships — the studio's core rule (<i>quality is measured, not asserted</i>). Edges are typed relations:</p>
<table><tr><th>relation</th><th>reading</th></tr>${relRows}</table>
<p>The stack runs bottom-up through <b>${tiers.map((t) => esc(t.label)).join(' → ')}</b>. On the interactive map, the <b>lens</b> picker filters to one game's reachable subgraph, and <b>flows</b> overlay numbered call-order paths (reproduced at the end of this document).</p>

<div class="pagebreak"></div>
<h2 style="border:0">The systems, one by one</h2>
<p class="muted">Grouped by tier (base of the stack first). Connections are derived from the live edge set.</p>
${tierSections}

<div class="pagebreak"></div>
<h2>The flows — the order systems are called</h2>
<p>A dependency graph cannot express <i>sequence</i>, so the diary carries curated, truthful walkthroughs. These are the same three flows the interactive map steps through.</p>
${flowSections}

<h2>Build timeline</h2>
<table><tr><th>phase</th><th>date</th><th>what landed</th></tr>${timeline}</table>

${kit ? `<h2>Appendix — a gated brick's output</h2>
<p class="muted">texture-kit's style-matched, seamless material kit for Ember Depths (every asset passed its deterministic validator: seams &lt; 8/255, texture energy, palette affinity vs the backdrop).</p>
<img style="width:100%;border:1px solid #d8dde6;border-radius:6px" src="${kit}">` : ''}

</body></html>`;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
const pdfPath = path.join(OUT, 'sysmap-report.pdf');
await page.pdf({
  path: pdfPath, format: 'A4', printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-size:8px;color:#8a93a3;padding:0 14mm;display:flex;justify-content:space-between;">
    <span>Studio Sysmap — ${today}</span><span class="pageNumber"></span></div>`,
  margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
});
await browser.close();
const kb = (fs.statSync(pdfPath).size / 1024).toFixed(0);
console.log(`📄 ${path.relative(STUDIO, pdfPath)}  (${kb}kB)`);
