/*
 * upload — push a folder of .webm clips to YouTube (Data API v3, resumable).
 * Auth is REFRESH-TOKEN based so it's hands-free every run (no device flow):
 * reads YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN from the env, falling
 * back to studio/.studio-secrets/youtube.json (gitignored). Exchanges the refresh
 * token for an access token, then uploads each clip UNLISTED with a tidy title.
 *
 *   node tools/video/upload.mjs games/grovekeep/video      # standalone
 *   (or imported by film.mjs via uploadDir)
 *
 * To make uploads permanent across sessions, set YT_REFRESH_TOKEN (+ CLIENT_ID/
 * SECRET) as environment secrets — `studio auth youtube` mints a fresh one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function creds() {
  let c = { client_id: process.env.YT_CLIENT_ID, client_secret: process.env.YT_CLIENT_SECRET, refresh_token: process.env.YT_REFRESH_TOKEN };
  if (!c.refresh_token) { try { c = { ...c, ...JSON.parse(fs.readFileSync(path.join(STUDIO, '.studio-secrets', 'youtube.json'), 'utf8')) }; } catch {} }
  return c;
}
export async function accessToken() {
  const c = creds();
  if (!c.client_id || !c.client_secret || !c.refresh_token) throw new Error('missing YT creds (set YT_CLIENT_ID/SECRET/REFRESH_TOKEN env, or .studio-secrets/youtube.json — run studio auth youtube)');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: c.refresh_token, grant_type: 'refresh_token' }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('token refresh failed: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

function titleFor(file, game) {
  const m = /-level-(\d+)-(.+)\.webm$/.exec(file);
  if (file.includes('montage')) return `${game} — Montage (a thriving world)`;
  if (m) { const nm = m[2].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); return `${game} — Level ${m[1]}: ${nm}`; }
  return `${game} — ${file.replace(/\.webm$/, '')}`;
}

// Build a YouTube PLAYLIST for the game's clips and return its link. Tries a REAL
// channel playlist first (needs the broad `youtube` scope — `studio auth youtube`
// now requests it); if the token is upload-only it falls back to YouTube's
// anonymous "watch_videos" playlist, which needs no extra scope and still gives a
// single "play all" link. `order` is the video ids in viewing order.
export async function buildPlaylist(token, { title, desc, order }) {
  const watchAll = order.length ? 'https://www.youtube.com/watch_videos?video_ids=' + order.join(',') : null;
  try {
    const ins = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippet: { title, description: desc || '' }, status: { privacyStatus: 'unlisted' } }),
    });
    const pj = await ins.json().catch(() => ({}));
    if (!pj.id) return { url: watchAll, real: false };
    for (const vid of order) {
      await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippet: { playlistId: pj.id, resourceId: { kind: 'youtube#video', videoId: vid } } }),
      }).catch(() => {});
    }
    return { url: 'https://www.youtube.com/playlist?list=' + pj.id, real: true };
  } catch { return { url: watchAll, real: false }; }
}

export async function uploadDir(dir, opt = {}) {
  const token = await accessToken();
  const game = opt.game || 'Studio game';
  const files = fs.readdirSync(dir).filter((f) => /\.webm$/.test(f)).sort((a, b) => (a.includes('montage') ? 1 : 0) - (b.includes('montage') ? 1 : 0) || a.localeCompare(b));
  const tags = ['gamedev', 'phaser', 'indie game', ...(opt.tagsExtra || [])].filter(Boolean);
  const ids = {};
  const order = [];   // video ids in viewing order (montage last) — for the playlist
  for (const f of files) {
    const bytes = fs.readFileSync(path.join(dir, f));
    const title = titleFor(f, game);
    const desc = `${title}\nBuilt on the Studio / Phaser-4 game engine.` + (opt.live ? `\n\nPlay: ${opt.live}` : '');
    const meta = { snippet: { title, description: desc, tags, categoryId: '20' }, status: { privacyStatus: opt.privacy || 'unlisted', selfDeclaredMadeForKids: false } };
    const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/webm', 'X-Upload-Content-Length': String(bytes.length) }, body: JSON.stringify(meta) });
    if (!init.ok) { console.log('  ✗ init', f, init.status, (await init.text()).slice(0, 160)); continue; }
    const put = await fetch(init.headers.get('location'), { method: 'PUT', headers: { 'Content-Type': 'video/webm', 'Content-Length': String(bytes.length) }, body: bytes });
    const j = await put.json().catch(() => ({}));
    if (j.id) { ids[f] = j.id; order.push(j.id); console.log('  ✔ ' + title + '  →  https://youtu.be/' + j.id); }
    else console.log('  ✗ upload', f, put.status, JSON.stringify(j).slice(0, 160));
  }
  fs.writeFileSync(path.join(dir, 'youtube.json'), JSON.stringify(ids, null, 2));
  // a single "watch all" playlist link for the game (real channel playlist if the
  // token's scope allows, else the anonymous watch_videos playlist).
  let playlist = null;
  if (order.length) {
    const pl = await buildPlaylist(token, { title: `${game} — full playthrough`, desc: opt.live ? `Play: ${opt.live}` : '', order });
    playlist = pl.url;
    if (playlist) console.log('  ▶ playlist (' + (pl.real ? 'channel' : 'watch-all') + '):', playlist);
  }
  return { ids, playlist };
}

// standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = path.resolve(process.argv[2] || 'video');
  await uploadDir(dir, { game: process.env.FILM_GAME || 'Studio game' });
}
