/* Minimal Express host implementing the hub convention contracts
 * (/health, /api/meta, /api/diary, /api/config, /api/notes) + static game.
 *
 * NOTES → ISSUES (the deepfin convention, made ROBUST): a playtest note posted to
 * /api/notes is auto-filed as a GitHub ISSUE (label playtest-note, body carries
 * note-id) in GITHUB_REPO using GITHUB_TOKEN. Filing now RETRIES, LOGS failures
 * (never silent), surfaces the error to the client, and — crucially — BACKFILLS:
 * any saved note still missing an issue is re-filed on startup, on an interval,
 * and via POST /api/notes/reconcile. So a note ALWAYS eventually registers in the
 * repo, even if GitHub hiccuped or the token was briefly wrong when it was left.
 * Notes persist on the Railway volume (RAILWAY_VOLUME_MOUNT_PATH) so the backfill
 * survives redeploys. */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DATA = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, 'data');
const REPO = process.env.GITHUB_REPO || '';
const GHTOK = process.env.GITHUB_TOKEN || '';
fs.mkdirSync(DATA, { recursive: true });
app.use(express.json());

const read = (f, d) => { try { return fs.readFileSync(path.join(__dirname, f), 'utf8'); } catch { return d; } };
const notesFile = path.join(DATA, 'notes.json');
const notes = () => { try { return JSON.parse(fs.readFileSync(notesFile, 'utf8')); } catch { return []; } };
const writeNotes = (n) => fs.writeFileSync(notesFile, JSON.stringify(n, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// File one note as a GitHub issue. Retries transient failures; LOGS every failure
// (so a bad token/repo is visible in the deploy logs, not swallowed). Returns
// { issue } on success or { error } on failure — never throws.
async function fileIssue(note) {
  if (!REPO || !GHTOK) return { error: 'no GITHUB_REPO/GITHUB_TOKEN configured' };
  const body = [
    (note.text || '').trim(), '',
    '— playtest context —',
    'where: ' + (note.where || '?'),
    'level: ' + (note.level ?? '?') + ' (' + (note.levelName || '') + ')  ·  coins ' + (note.coins ?? '?') + '  ·  deaths ' + (note.deaths ?? '?'),
    'at: ' + (note.ts || new Date().toISOString()), '',
    'note-id: ' + note.id,
  ].join('\n');
  const payload = JSON.stringify({ title: '🎮 ' + (note.text || 'playtest note').slice(0, 70), body, labels: ['playtest-note'] });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
        method: 'POST',
        headers: { Authorization: `token ${GHTOK}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'studio-notes' },
        body: payload,
      });
      const j = await res.json().catch(() => ({}));
      if (j && j.number) return { issue: REPO + '#' + j.number, url: j.html_url };
      console.error(`[notes] file-issue FAILED to ${REPO} (HTTP ${res.status}, attempt ${attempt}): ${j.message || JSON.stringify(j).slice(0, 200)}`);
      if ([401, 403, 404, 422].includes(res.status)) break; // auth/repo/label problem — retrying won't help
    } catch (e) { console.error(`[notes] file-issue ERROR (attempt ${attempt}):`, String(e)); }
    await sleep(400 * attempt);
  }
  return { error: `github filing failed for ${REPO} (see logs)` };
}

// BACKFILL — the guarantee: re-file any saved note that has no issue yet.
let backfilling = false;
async function backfill(reason) {
  if (backfilling || !REPO || !GHTOK) return 0;
  backfilling = true;
  let changed = 0;
  try {
    const all = notes();
    for (const n of all) {
      if (n.issue) continue;
      const r = await fileIssue(n);
      if (r.issue) { n.issue = r.issue; delete n.issueError; changed++; }
      else n.issueError = r.error;
    }
    if (changed) { writeNotes(all); console.log(`[notes] backfill (${reason || 'manual'}): ${changed} un-filed note(s) → issues`); }
  } finally { backfilling = false; }
  return changed;
}

app.get('/health', (_, res) => res.json({ ok: true, ts: Date.now() }));
app.get('/api/meta', (_, res) => res.type('application/json').send(read('GAME_META.json', '{}')));
app.get('/api/diary', (_, res) => res.type('text/markdown').send(read('DIARY.md', '# Diary')));
app.get('/api/config', (_, res) => res.json({ engine: 'studio-phaser4', phaser: '4.1.0', renderer: 'webgl-canvas', issues: !!(REPO && GHTOK), repo: REPO || null }));
app.get('/api/notes', (_, res) => res.json(notes()));
app.post('/api/notes', async (req, res) => {
  const n = { id: Date.now(), status: 'open', ts: new Date().toISOString(), ...req.body };
  const r = await fileIssue(n);
  if (r.issue) n.issue = r.issue; else n.issueError = r.error;
  const all = notes(); all.push(n); writeNotes(all);
  if (!r.issue) console.error('[notes] saved note WITHOUT issue (will backfill):', n.id, '-', r.error);
  res.json({ ok: !!r.issue, issue: r.issue || null, error: r.error || null });
});
// force a backfill (the hub/CLI can poke this to reconcile any un-filed notes)
app.post('/api/notes/reconcile', async (_, res) => { const n = await backfill('reconcile'); res.json({ ok: true, backfilled: n }); });
// the sync tool reflects issue lifecycle (closed = fixed) back onto notes
app.post('/api/notes/status', (req, res) => {
  const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
  const all = notes();
  let changed = 0;
  for (const u of updates) { const n = all.find((x) => String(x.id) === String(u.id)); if (n && u.status) { n.status = u.status; changed++; } }
  writeNotes(all);
  res.json({ ok: true, changed });
});

app.use(express.static(path.join(__dirname, 'src')));
app.listen(PORT, () => {
  console.log('studio game on :' + PORT + (REPO ? '  notes→issues: ' + REPO : '  notes→issues: DISABLED (set GITHUB_REPO + GITHUB_TOKEN)'));
  backfill('startup');                         // catch anything that failed to file earlier
  setInterval(() => backfill('interval'), 5 * 60 * 1000);
});
