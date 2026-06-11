/* Minimal Express host implementing the hub convention contracts
 * (/health, /api/meta, /api/diary, /api/config, /api/notes) + static game.
 * Notes: persisted to DATA (volume if mounted) AND auto-filed as GitHub
 * ISSUES (label playtest-note, body carries note-id) when GITHUB_REPO +
 * GITHUB_TOKEN are set — the deepfin notes→issues convention. */
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

async function fileIssue(note) {
  if (!REPO || !GHTOK) return null;
  try {
    const body = [
      (note.text || '').trim(), '',
      '— playtest context —',
      'where: ' + (note.where || '?'),
      'level: ' + (note.level ?? '?') + ' (' + (note.levelName || '') + ')  ·  coins ' + (note.coins ?? '?') + '  ·  deaths ' + (note.deaths ?? '?'),
      'at: ' + (note.ts || new Date().toISOString()), '',
      'note-id: ' + note.id,
    ].join('\n');
    const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: { Authorization: `token ${GHTOK}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '🎮 ' + (note.text || 'playtest note').slice(0, 70), body, labels: ['playtest-note'] }),
    });
    const j = await res.json();
    return j.number ? REPO + '#' + j.number : null;
  } catch { return null; }
}

app.get('/health', (_, res) => res.json({ ok: true, ts: Date.now() }));
app.get('/api/meta', (_, res) => res.type('application/json').send(read('GAME_META.json', '{}')));
app.get('/api/diary', (_, res) => res.type('text/markdown').send(read('DIARY.md', '# Diary')));
app.get('/api/config', (_, res) => res.json({ engine: 'studio-phaser4', phaser: '4.1.0', renderer: 'webgl-canvas', issues: !!(REPO && GHTOK) }));
app.get('/api/notes', (_, res) => res.json(notes()));
app.post('/api/notes', async (req, res) => {
  const n = { id: Date.now(), status: 'open', ...req.body };
  n.issue = await fileIssue(n);
  const all = notes(); all.push(n); writeNotes(all);
  res.json({ ok: true, issue: n.issue });
});
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
app.listen(PORT, () => console.log('studio game on :' + PORT));
