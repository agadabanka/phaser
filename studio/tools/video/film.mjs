/*
 * film — record gameplay clips for ANY studio game and (optionally) upload them
 * to YouTube. Generic: drives the standard harness hooks every archetype now
 * exposes — window.__game.gotoLevel(i) · autopilot(on) · showcase() — and an
 * in-page MediaRecorder that captures the canvas AND the game's WebAudio, so each
 * .webm carries the level's MUSIC (no ffmpeg). One clip per level + a MONTAGE (a
 * long autopilot run, plus the archetype's showcase() state where it makes a
 * fuller scene — e.g. the builder packs a glade). On --upload it also builds a
 * YouTube PLAYLIST link for the game and records it in GAME_META.playlist.
 *
 *   node tools/video/film.mjs games/grovekeep            # record only → games/<g>/video/
 *   node tools/video/film.mjs games/grovekeep --upload    # record + upload to YouTube
 *   node tools/video/film.mjs games/grovekeep --secs 18 --montage 34
 *
 * Per-level autopilot needs gotoLevel; archetypes without it still get a montage
 * (full playthrough). Quality is the engine's job; this just captures it.
 */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { uploadDir } from './upload.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const arg = process.argv[2] || 'games/grovekeep';
const GAME = path.isAbsolute(arg) ? arg : path.join(STUDIO, arg.replace(/^studio\//, ''));
const SRC = path.join(GAME, 'src'), OUT = path.join(GAME, 'video');
const argN = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? +process.argv[i + 1] : d; };
const SECS = argN('--secs', 18), MONT = argN('--montage', 32), DO_UPLOAD = process.argv.includes('--upload');
const meta = JSON.parse(fs.readFileSync(path.join(GAME, 'GAME_META.json'), 'utf8'));
const N = meta.levelCount || 5, NAME = meta.name || path.basename(GAME);
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/\.webm$/.test(f)) fs.rmSync(path.join(OUT, f));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const server = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; const f = path.join(SRC, u); if (!f.startsWith(SRC) || !fs.existsSync(f)) { r.writeHead(404); return r.end('nf'); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((r) => server.listen(0, r)); const B = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const SIZE = { width: 960, height: 540 }, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// GENERIC AUDIO CAPTURE — Playwright's recordVideo is video-ONLY, so the clips
// came out silent. This init script (runs before any page script) captures the
// game's FULL mix with no SDK change and no ffmpeg:
//   1. AudioContext is forced to a single SHARED instance, and every node that
//      connects to `destination` is mirrored into a MediaStreamDestination (the
//      tap) — that captures all WebAudio (SFX, procedural).
//   2. MUSIC is the catch: the SDK plays mp3 music via `new Audio()`, an
//      HTMLMediaElement that BYPASSES WebAudio. So on play() we route each media
//      element through the shared context → destination (same-origin, no taint),
//      where the mirror above taps it. That's why the music is finally recorded.
function audioTapInit() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  window.__audioCtxs = []; window.__audioTaps = [];
  let shared = null;
  const wrap = new Proxy(AC, { construct(T, a) { if (!shared) { shared = new T(...a); window.__audioCtxs.push(shared); } return shared; } });
  window.AudioContext = wrap; if (window.webkitAudioContext) window.webkitAudioContext = wrap;
  const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest) {
    const r = oc.apply(this, arguments);
    try { if (dest === this.context.destination) { if (!this.context.__tap) { this.context.__tap = this.context.createMediaStreamDestination(); window.__audioTaps.push(this.context.__tap); } oc.call(this, this.context.__tap); } } catch (e) {}
    return r;
  };
  const ctx = () => { if (!shared) { shared = new wrap(); } return shared; };
  const routed = new WeakSet();
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    try { if (!routed.has(this)) { routed.add(this); const c = ctx(); c.createMediaElementSource(this).connect(c.destination); } } catch (e) {}
    return play.apply(this, arguments);
  };
  window.__resumeAudio = () => { for (const c of window.__audioCtxs) { try { c.resume(); } catch (e) {} } };
  window.__getAudioTracks = () => { const t = []; for (const d of window.__audioTaps) for (const tr of d.stream.getAudioTracks()) t.push(tr); return t; };
}

// Record one clip by driving the game, then capturing canvas + audio with an
// in-page MediaRecorder, so the uploaded video carries the level's MUSIC.
async function clip(file, secs, drive) {
  const ctx = await browser.newContext({ viewport: SIZE });
  await ctx.addInitScript(audioTapInit);
  const page = await ctx.newPage();
  await page.goto(`${B}/?r=webgl`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
  await page.mouse.click(SIZE.width / 2, SIZE.height / 2);     // a real gesture unlocks audio
  await page.evaluate(() => window.__resumeAudio && window.__resumeAudio());
  await page.evaluate(drive);
  await sleep(700);                                            // let the audio graph wire up
  await page.evaluate((bitrate) => {
    const canvas = document.querySelector('canvas');
    const vs = canvas.captureStream(30);
    const at = window.__getAudioTracks ? window.__getAudioTracks() : [];
    const stream = new MediaStream([...vs.getVideoTracks(), ...at]);
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 128000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    window.__recPromise = new Promise((res) => { rec.onstop = () => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(new Blob(chunks, { type: 'video/webm' })); }; });
    window.__stopRec = () => rec.stop();
    rec.start(250);
  }, 4_000_000);
  await sleep(secs * 1000);
  const b64 = await page.evaluate(() => { window.__stopRec(); return window.__recPromise; });
  await ctx.close();
  fs.writeFileSync(path.join(OUT, file + '.webm'), Buffer.from(b64, 'base64'));
  console.log('  ✔', file + '.webm', '(' + secs + 's, +music)');
}

// level names (for nice filenames) — load levels.js in a sandbox like the lint does
const names = (() => {
  try { const sb = { window: {} }; vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(SRC, 'game', 'levels.js'), 'utf8'), sb, { timeout: 2000 }); return (sb.window.LEVELS || []).map((l) => l.name || ''); } catch (e) { return []; }
})();
for (let i = 0; i < N; i++) {
  const nm = names[i] ? slug(names[i]) : '' + (i + 1);
  await clip(`${slug(NAME)}-level-${i + 1}-${nm}`, SECS, new Function(`
    window.__game.autopilot(true);
    if (window.__game.gotoLevel) window.__game.gotoLevel(${i}); else window.__game.reset();
  `));
}
// MONTAGE — a packed, lively run. showcase() (e.g. builder fill) + autopilot, with
// a couple of in-page hops for variety; pure autopilot for combat archetypes.
await clip(`${slug(NAME)}-montage`, MONT, new Function(`
  var hasShow = false; try { hasShow = !!(window.__grove); } catch(e){}
  if (window.__game.gotoLevel) window.__game.gotoLevel(${Math.max(0, N - 1)});
  window.__game.autopilot(true);
  window.__game.showcase();
  setTimeout(function(){ if(window.__game.gotoLevel) window.__game.gotoLevel(0); window.__game.showcase(); }, ${Math.round(MONT * 1000 / 3)});
  setTimeout(function(){ if(window.__game.gotoLevel) window.__game.gotoLevel(${Math.min(N - 1, 2)}); window.__game.showcase(); }, ${Math.round(MONT * 1000 * 2 / 3)});
`));

await browser.close(); server.close();
console.log(`🎬 recorded ${N + 1} clips → ${path.relative(STUDIO, OUT)}`);

if (DO_UPLOAD) {
  console.log('\n— uploading to YouTube —');
  const { ids, playlist } = await uploadDir(OUT, { game: NAME, live: meta.url, tagsExtra: [meta.archetype, 'pixel art'].filter(Boolean) });
  // report it: write the links into GAME_META.videos + the PLAYLIST link + mark
  // the `videos` stage done, so /api/meta carries it and the hub can light up the
  // stage, show the clips, and offer a "watch all" playlist (Play-Store-style).
  if (ids && Object.keys(ids).length) {
    const mp = path.join(GAME, 'GAME_META.json'), m = JSON.parse(fs.readFileSync(mp, 'utf8'));
    m.videos = Object.fromEntries(Object.entries(ids).map(([k, v]) => [k.replace(/\.webm$/, ''), 'https://youtu.be/' + v]));
    if (playlist) m.playlist = playlist;
    m.stages = Object.assign({}, m.stages, { videos: 'done' });
    fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
    console.log('  ✔ GAME_META.videos + playlist written + stage marked (the hub will surface these)');
    if (playlist) console.log('  ▶ playlist:', playlist);
  }
}
