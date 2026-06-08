// Validate the ANIMATED hero (visual-only; does NOT touch the gate). Proves:
//   (1) the follower is a SPRITE playing hero_run (frame index cycles), and
//   (2) the RENDERED hero pixels DIFFER frame-to-frame (not a frozen image).
// Captures live frames while the autopiloted hero runs, tracking a hero-centered
// crop per frame (so motion of the body doesn't mask the limb animation), then
// pixel-diffs consecutive crops. Also saves tight run crops for a Gemini on-model
// score. Run from repo root:  node studio/games/ember/validate-anim.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(SRC, u);
  if (!f.startsWith(SRC) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`${BASE}/?r=webgl`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });

// Get the hero running, then WAKE the loop so frames actually render. Drive the
// sim by manually advancing the hero anim AND re-rendering via game.step each shot,
// but keep the hero pinned in place so only its limbs change between captures.
const init = await page.evaluate(() => {
  window.__run(140);                          // reset + autopilot + step → running right
  const sc = window.game.scene.getScene('Play');
  const hero = sc.children.list.find((o) => o.anims && o.anims.currentAnim && /hero_/.test(o.anims.currentAnim.key));
  if (!hero) return { ok: false };
  window.__T = 1000 + 140 * (1000 / 60);      // continue the stepper clock
  return { ok: true, key: hero.anims.currentAnim.key, frame: hero.anims.currentFrame.index };
});
if (!init.ok) { console.log('NO HERO SPRITE FOUND (fallback image in use?)'); await browser.close(); server.close(); process.exit(2); }

// Each capture: advance the game by a few full steps via game.step (this updates
// the sim, ticks the hero anim by REAL delta, AND renders to the canvas), then
// screenshot. The hero keeps running right; we record its LIVE screen position so
// the diff can track a hero-centered crop (motion of the body won't mask the limb
// animation — the crop follows the hero).
const phases = [];
for (let i = 0; i < 7; i++) {
  const ph = await page.evaluate(() => {
    const sc = window.game.scene.getScene('Play');
    const dt = 1000 / 60;
    for (let k = 0; k < 6; k++) { window.__T += dt; window.game.step(window.__T, dt); }  // ~6 frames → run advances + renders
    const hero = sc.children.list.find((o) => o.anims && o.anims.currentAnim && /hero_/.test(o.anims.currentAnim.key));
    const cam = sc.cameras.main;
    return { frame: hero.anims.currentFrame.index, textureFrame: hero.frame.name, key: hero.anims.currentAnim.key,
      sx: (hero.x - cam.scrollX), sy: (hero.y - cam.scrollY), dw: hero.displayWidth, dh: hero.displayHeight };
  });
  const png = await page.screenshot();
  fs.writeFileSync(path.join(OUT, `anim-run${i}.png`), png);
  phases.push({ i, ...ph });
}
await browser.close();
server.close();

// Decode + diff a constant hero-centered crop between consecutive captures.
const b2 = await chromium.launch({ args: ['--no-sandbox'] });
const dp = await b2.newPage();
const pngB64 = (i) => fs.readFileSync(path.join(OUT, `anim-run${i}.png`)).toString('base64');
const crops = await dp.evaluate(async ({ imgs, phases }) => {
  async function dec(b64) {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); return ctx;
  }
  const ctxs = []; for (const b of imgs) ctxs.push(await dec(b));
  // FIXED crop size, positioned per-frame on each capture's live hero center → the
  // crop tracks the moving hero so only the run animation (limbs) drives the diff.
  const W = 200, H = 220, half = { w: W / 2, h: H / 2 };
  const cropAt = (ctx, p) => {
    const cx = Math.round(p.sx), cy = Math.round(p.sy - 6);
    const x0 = Math.max(0, Math.min(960 - W, cx - half.w));
    const y0 = Math.max(0, Math.min(540 - H, cy - half.h));
    return { data: ctx.getImageData(x0, y0, W, H).data, x0, y0 };
  };
  const diffs = [], cropUrls = [];
  for (let k = 0; k < ctxs.length; k++) {
    const c = cropAt(ctxs[k], phases[k]);
    const cc = document.createElement('canvas'); cc.width = W; cc.height = H;
    cc.getContext('2d').drawImage(ctxs[k].canvas, c.x0, c.y0, W, H, 0, 0, W, H);
    cropUrls.push(cc.toDataURL('image/png'));
  }
  for (let k = 1; k < ctxs.length; k++) {
    const a = cropAt(ctxs[k - 1], phases[k - 1]).data;
    const b = cropAt(ctxs[k], phases[k]).data;
    let diff = 0, tot = 0;
    for (let p = 0; p < a.length; p += 4) { tot++; if (Math.abs(a[p] - b[p]) + Math.abs(a[p + 1] - b[p + 1]) + Math.abs(a[p + 2] - b[p + 2]) > 30) diff++; }
    diffs.push({ pair: `run${k - 1}->run${k}`, changedPct: +(100 * diff / tot).toFixed(2) });
  }
  return { diffs, cropUrls, box: { W, H } };
}, { imgs: phases.map((p) => pngB64(p.i)), phases });
await b2.close();

crops.cropUrls.forEach((u, i) => fs.writeFileSync(path.join(OUT, `anim-crop${i}.png`), Buffer.from(u.split(',')[1], 'base64')));

console.log('hero anim — texture frame per capture:', phases.map((p) => p.textureFrame).join(', '), '(anim:', phases[0].key + ')');
console.log('hero-region pixel diff between consecutive run frames:');
crops.diffs.forEach((d) => console.log(`  ${d.pair}: ${d.changedPct}% pixels changed`));
const distinctTex = new Set(phases.map((p) => p.textureFrame)).size;
const moved = crops.diffs.filter((d) => d.changedPct > 0.5).length;
const animates = distinctTex > 1 && moved >= Math.ceil(crops.diffs.length * 0.6);
console.log('distinct texture frames shown:', distinctTex, '/', phases.length);
console.log('frame-pairs that visibly changed:', moved, '/', crops.diffs.length);
console.log('ANIMATES:', animates);
fs.writeFileSync(path.join(OUT, 'anim-validate.json'), JSON.stringify({ phases, diffs: crops.diffs, box: crops.box, animates }, null, 2));
process.exit(animates ? 0 : 2);
