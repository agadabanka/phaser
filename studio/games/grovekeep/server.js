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
app.use(express.json({ limit: '10mb' }));   // notes may carry a screenshot (data URL)

const read = (f, d) => { try { return fs.readFileSync(path.join(__dirname, f), 'utf8'); } catch { return d; } };
const notesFile = path.join(DATA, 'notes.json');
const notes = () => { try { return JSON.parse(fs.readFileSync(notesFile, 'utf8')); } catch { return []; } };
const writeNotes = (n) => fs.writeFileSync(notesFile, JSON.stringify(n, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Upload a note's screenshot (base64 jpeg, dot pre-drawn at the tap) into the
// repo at notes/shots/<id>.jpg via the Contents API, so the issue can embed it.
// The github.com/<repo>/raw URL renders inline in issues for anyone with access.
async function uploadShot(note) {
  if (!REPO || !GHTOK || !note.shotData) return { error: 'no shot/config' };
  const p = `notes/shots/${note.id}.jpg`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${p}`, {
        method: 'PUT',
        headers: { Authorization: `token ${GHTOK}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'studio-notes' },
        body: JSON.stringify({ message: `playtest shot for note ${note.id}`, content: note.shotData }),
      });
      const j = await res.json().catch(() => ({}));
      if (j && j.content) return { url: `https://github.com/${REPO}/raw/main/${p}` };
      console.error(`[notes] shot upload FAILED (HTTP ${res.status}, attempt ${attempt}): ${j.message || ''}`);
      if ([401, 403, 404].includes(res.status)) break;
      if (res.status === 422 && /already exists|sha/i.test(j.message || '')) return { url: `https://github.com/${REPO}/raw/main/${p}` }; // idempotent re-run
    } catch (e) { console.error(`[notes] shot upload ERROR (attempt ${attempt}):`, String(e)); }
    await sleep(400 * attempt);
  }
  return { error: 'shot upload failed (see logs)' };
}

// File one note as a GitHub issue. Retries transient failures; LOGS every failure
// (so a bad token/repo is visible in the deploy logs, not swallowed). Returns
// { issue } on success or { error } on failure — never throws.
async function fileIssue(note) {
  if (!REPO || !GHTOK) return { error: 'no GITHUB_REPO/GITHUB_TOKEN configured' };
  const body = [
    (note.text || '').trim(), '',
    ...(note.shotUrl ? ['**screenshot** — 📍 the dot marks where the player tapped:', '', `![playtest screenshot](${note.shotUrl})`, ''] : []),
    '— playtest context —',
    'where: ' + (note.where || '?'),
    'level: ' + (note.level ?? '?') + ' (' + (note.levelName || '') + ')  ·  coins ' + (note.coins ?? '?') + '  ·  deaths ' + (note.deaths ?? '?'),
    ...(note.tap ? ['tap: ' + Math.round(note.tap.x * 100) + '% across, ' + Math.round(note.tap.y * 100) + '% down'] : []),
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
      if (n.shotData && !n.shotUrl) { const up = await uploadShot(n); if (up.url) { n.shotUrl = up.url; delete n.shotData; changed++; } }
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

// THE RICH DIARY — /diary.html renders DIARY.md (text + screenshots) as a styled
// page. Images use the repo convention `src/diary-shots/<name>` (so they render on
// GitHub too); the page strips the `src/` prefix to hit the static web root.
app.get('/diary.html', (_, res) => {
  res.type('text/html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>build diary</title><style>
 body{margin:0;background:#14110c;color:#ded7c6;font-family:Georgia,serif;line-height:1.6}
 .wrap{max-width:860px;margin:0 auto;padding:28px 20px 80px}
 h1{color:#ffd98a;font-size:30px;margin:.4em 0} h2{color:#ffcf72;border-bottom:1px solid #4a3c22;padding-bottom:4px;margin-top:1.6em}
 h3{color:#ffe7a8} a{color:#ffb24a} code{background:#241c10;border-radius:4px;padding:1px 5px;font-size:.92em}
 pre{background:#1c1810;border:1px solid #3a3220;border-radius:8px;padding:12px;overflow:auto}
 img{max-width:100%;border:1px solid #3a3220;border-radius:10px;margin:10px 0;display:block;box-shadow:0 4px 18px rgba(0,0,0,.4)}
 li{margin:4px 0} strong{color:#ffe7a8} .top{font-size:13px;opacity:.8;margin-bottom:14px}
 blockquote{border-left:3px solid #ffb24a;margin:0;padding:2px 14px;opacity:.9}
</style></head><body><div class="wrap"><div class="top"><a href="/">← back to the game</a></div><div id="md">loading…</div></div>
<script>
fetch('/api/diary').then(r=>r.text()).then(md=>{
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline=s=>esc(s)
    .replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g,(m,a,u)=>'<img alt="'+a+'" src="'+u.replace(/^src\\//,'')+'">')
    .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g,'<a href="$2">$1</a>')
    .replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>').replace(/\\*([^*]+)\\*/g,'<em>$1</em>')
    .replace(/\\\`([^\\\`]+)\\\`/g,'<code>$1</code>');
  let html='',list=false,code=false,buf=[];
  for(const line of md.split('\\n')){
    if(line.startsWith('\\\`\\\`\\\`')){ if(code){html+='<pre>'+esc(buf.join('\\n'))+'</pre>';buf=[];} code=!code; continue; }
    if(code){buf.push(line);continue;}
    const li=/^\\s*[-*] (.*)/.exec(line);
    if(li){ if(!list){html+='<ul>';list=true;} html+='<li>'+inline(li[1])+'</li>'; continue; }
    if(list){html+='</ul>';list=false;}
    const h=/^(#{1,3}) (.*)/.exec(line);
    if(h){ html+='<h'+h[1].length+'>'+inline(h[2])+'</h'+h[1].length+'>'; continue; }
    if(/^> /.test(line)){ html+='<blockquote>'+inline(line.slice(2))+'</blockquote>'; continue; }
    if(line.trim()==='') { html+=''; continue; }
    html+='<p>'+inline(line)+'</p>';
  }
  if(list)html+='</ul>';
  document.getElementById('md').innerHTML=html;
}).catch(()=>{document.getElementById('md').textContent='diary unavailable';});
</script></body></html>`);
});
app.get('/api/config', (_, res) => res.json({ engine: 'studio-phaser4', phaser: '4.1.0', renderer: 'webgl-canvas', issues: !!(REPO && GHTOK), repo: REPO || null }));
app.get('/api/notes', (_, res) => res.json(notes().map(({ shotData, ...n }) => n)));   // never ship raw image data back
app.post('/api/notes', async (req, res) => {
  const { shot, ...rest } = req.body || {};
  const n = { id: Date.now(), status: 'open', ts: new Date().toISOString(), ...rest };
  if (shot) n.shotData = String(shot).replace(/^data:image\/\w+;base64,/, '');
  if (n.shotData) { const up = await uploadShot(n); if (up.url) { n.shotUrl = up.url; delete n.shotData; } else n.shotError = up.error; }  // keep shotData → backfill retries
  const r = await fileIssue(n);
  if (r.issue) n.issue = r.issue; else n.issueError = r.error;
  const all = notes(); all.push(n); writeNotes(all);
  if (!r.issue) console.error('[notes] saved note WITHOUT issue (will backfill):', n.id, '-', r.error);
  res.json({ ok: !!r.issue, issue: r.issue || null, shot: n.shotUrl || null, error: r.error || null });
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
