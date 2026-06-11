/*
 * issues-health — the FEEDBACK validator (studio issues). The engine's outer loop
 * is only closed when every raised playtest issue in every game it built has been
 * TAKEN CARE OF. This sweeps the whole engine family (the hub registry + the hub
 * repo itself), lists every OPEN `playtest-note` issue, and FAILS (exit 1) while
 * any remain — they are the engine's to-do list. Green ⇔ no player feedback is
 * sitting unaddressed anywhere.
 *
 *   node tools/eval/issues.mjs            # sweep + verdict (exit 1 if any open)
 *   node tools/eval/issues.mjs --json     # machine-readable
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOK = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const asJson = process.argv.includes('--json');
const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
if (!TOK) { console.error('set GH_TOKEN'); process.exit(2); }

const gh = async (p) => {
  const r = await fetch('https://api.github.com' + p, { headers: { Authorization: `token ${TOK}`, Accept: 'application/vnd.github+json', 'User-Agent': 'studio-issues' } });
  return { status: r.status, json: await r.json().catch(() => null) };
};

// the engine family = the hub registry (every game built on the engine) + the hub itself
async function familyRepos() {
  const repos = new Map();
  const hub = await gh('/repos/agadabanka/game-engine/contents/hub/games.json');
  if (hub.json && hub.json.content) {
    for (const g of JSON.parse(Buffer.from(hub.json.content, 'base64').toString())) if (g.repo) repos.set(g.id, g.repo);
  } else {
    // offline fallback: local games' GAME_META
    for (const d of fs.readdirSync(path.join(STUDIO, 'games'))) {
      try { const m = JSON.parse(fs.readFileSync(path.join(STUDIO, 'games', d, 'GAME_META.json'), 'utf8')); if (m.repo) repos.set(d, m.repo); } catch {}
    }
  }
  repos.set('game-engine (hub)', 'agadabanka/game-engine');
  return repos;
}

const repos = await familyRepos();
const out = { checkedAt: new Date().toISOString(), games: [], open: 0, pass: false };
for (const [id, repo] of repos) {
  const r = await gh(`/repos/${repo}/issues?state=open&labels=playtest-note&per_page=100`);
  if (!Array.isArray(r.json)) { out.games.push({ id, repo, error: `HTTP ${r.status}` }); continue; }
  const open = r.json.map((i) => ({ n: i.number, title: i.title, ageDays: +((Date.now() - new Date(i.created_at)) / 864e5).toFixed(1), url: i.html_url }));
  out.open += open.length;
  out.games.push({ id, repo, openCount: open.length, open });
}
out.pass = out.open === 0;

if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(out.pass ? 0 : 1); }
console.log(`\n🩺 ISSUES HEALTH — every playtest issue raised across the engine's ${out.games.length} repos must be addressed\n`);
for (const g of out.games) {
  if (g.error) { console.log(`  ⚠  ${g.id.padEnd(18)} ${g.repo}  (${g.error})`); continue; }
  if (!g.openCount) { console.log(`  ✅  ${g.id.padEnd(18)} ${g.repo}  0 open`); continue; }
  console.log(`  ❌  ${g.id.padEnd(18)} ${g.repo}  ${g.openCount} OPEN`);
  for (const i of g.open) console.log(`        #${i.n} (${i.ageDays}d) ${i.title.slice(0, 80)}`);
}
console.log(out.pass
  ? `\n  ✅ FEEDBACK LOOP CLOSED — no open playtest issues anywhere in the family.\n`
  : `\n  ❌ ${out.open} OPEN playtest issue(s) — the engine's to-do list. Fix in the engine/template where possible, percolate, then close with a comment.\n`);
process.exit(out.pass ? 0 : 1);
