/*
 * gen-diary.mjs — regenerate DIARY.md (a human-readable changelog) from diary.json.
 *
 * diary.json is the machine-readable source (entries + systems graph). This script
 * renders the ENTRIES as a clean changelog grouped by phase, plus a compact summary
 * of the systems graph, and performs the SCHEMA.md referential-integrity checks
 * (1-3): entries/nodes/edges present; every entries[].systems id is a real node;
 * every edge from/to is a real node. Violations are printed as warnings (and the
 * process exits non-zero so CI can catch a drifted diary), but DIARY.md is still
 * written so the render is always available.
 *
 *   node gen-diary.mjs            # write DIARY.md next to diary.json
 *   node gen-diary.mjs --check    # validate only, do not write
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'diary.json');
const OUT = path.join(HERE, 'DIARY.md');
const checkOnly = process.argv.includes('--check');

const diary = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const entries = Array.isArray(diary.entries) ? diary.entries : null;
const nodes = diary.graph && Array.isArray(diary.graph.nodes) ? diary.graph.nodes : null;
const edges = diary.graph && Array.isArray(diary.graph.edges) ? diary.graph.edges : null;

// ---- referential-integrity checks (SCHEMA.md, checks 1-3) ----
const warnings = [];
if (!entries) warnings.push('diary.entries is missing or not an array');
if (!nodes) warnings.push('diary.graph.nodes is missing or not an array');
if (!edges) warnings.push('diary.graph.edges is missing or not an array');

const nodeIds = new Set((nodes || []).map((n) => n.id));
const tierIds = new Set((diary.tiers || []).map((t) => t.id));
for (const e of entries || []) {
  for (const s of e.systems || []) {
    if (!nodeIds.has(s)) warnings.push(`entry ${e.id}: systems[] references unknown node "${s}"`);
  }
}
for (const ed of edges || []) {
  if (!nodeIds.has(ed.from)) warnings.push(`edge ${ed.from}->${ed.to}: unknown "from" node "${ed.from}"`);
  if (!nodeIds.has(ed.to)) warnings.push(`edge ${ed.from}->${ed.to}: unknown "to" node "${ed.to}"`);
}
for (const n of nodes || []) {
  if (n.tier && !tierIds.has(n.tier)) warnings.push(`node ${n.id}: unknown tier "${n.tier}"`);
}

if (warnings.length) {
  console.error('⚠ diary.json integrity warnings:');
  for (const w of warnings) console.error('   - ' + w);
} else {
  console.log('✓ diary.json passes referential integrity (entries/nodes/edges present + cross-refs resolve)');
}
if (checkOnly) process.exit(warnings.length ? 1 : 0);

// ---- render DIARY.md ----
const STATUS_BADGE = { shipped: '🚀 shipped', green: '✅ gate green', done: '✅ done', wip: '🚧 wip', spike: '🔬 spike' };
const byId = new Map((nodes || []).map((n) => [n.id, n]));
const sorted = (entries || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));

// group by phase (preserve first-seen order)
const phases = [];
const phaseMap = new Map();
for (const e of sorted) {
  if (!phaseMap.has(e.phase)) { phaseMap.set(e.phase, []); phases.push(e.phase); }
  phaseMap.get(e.phase).push(e);
}

function sysLabel(id) { const n = byId.get(id); return n ? n.label : id; }

const L = [];
L.push(`# ${diary.project || 'Studio'} — Build Diary`);
L.push('');
L.push(`> Generated from \`diary.json\` by \`gen-diary.mjs\`. Do not edit by hand — edit the JSON and re-run.`);
L.push('');

// summary line
const tierLine = (diary.tiers || []).slice().sort((a, b) => a.order - b.order).map((t) => t.label).join(' → ');
L.push(`**Stack:** ${tierLine}`);
L.push('');
L.push(`**${sorted.length} entries** across ${phases.length} phases · **${(nodes || []).length} systems** · **${(edges || []).length} edges** in the graph.`);
L.push('');
L.push('---');
L.push('');

// changelog grouped by phase
for (const ph of phases) {
  L.push(`## ${ph}`);
  L.push('');
  for (const e of phaseMap.get(ph)) {
    L.push(`### ${e.title}`);
    const meta = [`\`${e.date}\``, STATUS_BADGE[e.status] || e.status];
    if (e.commit) meta.push(`commit \`${e.commit}\``);
    L.push(meta.join(' · '));
    L.push('');
    L.push(`- **What:** ${e.what}`);
    L.push(`- **Why:** ${e.why}`);
    if (e.systems && e.systems.length) L.push(`- **Systems:** ${e.systems.map(sysLabel).join(', ')}`);
    L.push(`- **Validator:** ${e.validator || '—'}`);
    if (e.artifacts && e.artifacts.length) L.push(`- **Artifacts:** ${e.artifacts.map((a) => '`' + a + '`').join(', ')}`);
    L.push('');
  }
}

// systems graph appendix — nodes grouped by tier, then the edge legend
L.push('---');
L.push('');
L.push('## Systems graph');
L.push('');
L.push('The machine-readable graph in `diary.json` (`graph.nodes` + `graph.edges`) is what the');
L.push('interactive visualizer (`../tools/sysmap/`) renders. Summary:');
L.push('');
const tiersSorted = (diary.tiers || []).slice().sort((a, b) => a.order - b.order);
for (const t of tiersSorted) {
  const inTier = (nodes || []).filter((n) => n.tier === t.id);
  if (!inTier.length) continue;
  L.push(`### ${t.order}. ${t.label}`);
  L.push('');
  L.push('| node | kind | validator | description |');
  L.push('|------|------|-----------|-------------|');
  for (const n of inTier) {
    L.push(`| **${n.label}** | ${n.kind} | ${n.validator || '—'} | ${n.desc || ''} |`);
  }
  L.push('');
}

fs.writeFileSync(OUT, L.join('\n') + '\n');
console.log(`✓ wrote ${path.relative(process.cwd(), OUT)} (${sorted.length} entries, ${(nodes || []).length} nodes, ${(edges || []).length} edges)`);
process.exit(warnings.length ? 1 : 0);
