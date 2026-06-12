/*
 * film — record gameplay clips for ANY studio game and (optionally) upload them
 * to YouTube. Generic: drives the standard harness hooks every archetype now
 * exposes — window.__game.gotoLevel(i) · autopilot(on) · showcase() — and uses
 * Playwright's native video recorder (.webm; no ffmpeg). One clip per level + a
 * MONTAGE (a long autopilot run, plus the archetype's showcase() state where it
 * makes a fuller scene — e.g. the builder packs a glade).
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
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const SIZE = { width: 960, height: 540 }, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function clip(file, secs, drive) {
  const ctx = await browser.newContext({ viewport: SIZE, recordVideo: { dir: OUT, size: SIZE } });
  const page = await ctx.newPage();
  await page.goto(`${B}/?r=webgl`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
  await page.evaluate(drive);
  await sleep(secs * 1000);
  const vp = await page.video().path(); await ctx.close();
  fs.renameSync(vp, path.join(OUT, file + '.webm'));
  console.log('  ✔', file + '.webm', '(' + secs + 's)');
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
  await uploadDir(OUT, { game: NAME, live: meta.url, tagsExtra: [meta.archetype, 'pixel art'].filter(Boolean) });
}
