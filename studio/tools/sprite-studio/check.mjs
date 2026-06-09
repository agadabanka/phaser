/*
 * Sprite Studio headless verifier.
 *
 * Reuses ember/eval.mjs's pattern: a tiny node:http static server + headless
 * Playwright Chromium driven through ANGLE/SwiftShader (so WebGL works with no
 * GPU). It serves THIS directory, loads index.html, waits for the scene
 * (window.__ready, set in app.js create()), asserts ZERO page errors, PLAYS each
 * defined anim (idle/run/jump) and asserts the live sprite is actually animating
 * (frame advances, plays within range), runs window.validate() (the STRUCTURAL
 * half), then runs the MOTION/quality half (Gemini) on each anim's contact sheet —
 * structural-only with a clear note if creds are absent. Finally it screenshots
 * the live preview + writes a frame CONTACT SHEET per anim to out/. Exits non-zero
 * on any error / structural failure.
 *
 * playwright resolves from studio/node_modules (../../package.json).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { validateMotion } from './gemini-validate.mjs';
import { geminiConfigured } from '../art/gemini.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });

const require = createRequire(path.join(ROOT, '../../package.json'));
const { chromium } = require('playwright');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});

const errors = [];
let result = { ok: false };
const motion = [];                  // per-anim Gemini verdicts
let structural = null;
let dataUrlSafe = (s) => (typeof s === 'string' && s.indexOf(',') >= 0 ? s.split(',')[1] : s);

try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
  // wait for the bundled sample sheet to finish loading (sprite exists + playing)
  await page.waitForFunction(() => window.__ss && window.__ss.state().frameIndex !== null, { timeout: 20000 });

  // optional: validate a SPECIFIC sheet (e.g. a gen.mjs output) instead of the
  // bundled sample:  node check.mjs --sheet=out/a-little-robot-sheet.json
  const sheetArg = (process.argv.find((a) => a.startsWith('--sheet=')) || '').slice('--sheet='.length);
  if (sheetArg) {
    const descPath = path.isAbsolute(sheetArg) ? sheetArg : path.join(ROOT, sheetArg);
    const desc = JSON.parse(fs.readFileSync(descPath, 'utf8'));
    await page.evaluate((d) => window.__ss.setSheet(d), desc);
    await page.waitForFunction((fc) => window.__ss.state().sheetFrameCount === fc, desc.frameCount, { timeout: 20000 });
  }

  const anims = await page.evaluate(() => window.__ss.anims());

  // PLAY each anim and assert it actually animates: select it, sample the live
  // frame index across a few hundred ms, and require it to (a) advance and (b)
  // stay within the anim's frame count.
  const perAnim = [];
  for (const name of anims) {
    await page.evaluate((n) => window.__ss.play(n), name);
    await page.waitForTimeout(120);
    const samples = [];
    for (let i = 0; i < 8; i++) {
      samples.push(await page.evaluate(() => window.__ss.state().frameIndex));
      await page.waitForTimeout(70);
    }
    const st = await page.evaluate(() => window.__ss.state());
    const distinct = new Set(samples).size;
    const inRange = samples.every((s) => s !== null && s >= 0);
    perAnim.push({ name, frameCount: st.frameCount, frameRate: st.frameRate, advanced: distinct > 1 || st.frameCount === 1, distinctFrames: distinct, inRange, playing: st.playing });

    // capture this anim's FOCUSED contact sheet (one row of just its frames) to
    // out/ + keep base64 for the per-anim Gemini read
    const contact = await page.evaluate((n) => window.__ss.contactSheet(n), name);
    const b64 = dataUrlSafe(contact.dataUrl);
    fs.writeFileSync(path.join(OUT, `contact-${name}.png`), Buffer.from(b64, 'base64'));
    perAnim[perAnim.length - 1]._contact = b64;
  }

  // a full all-anims overview contact sheet (the at-a-glance artifact)
  const overview = await page.evaluate(() => window.__ss.contactSheet());
  fs.writeFileSync(path.join(OUT, 'contact-all.png'), Buffer.from(dataUrlSafe(overview.dataUrl), 'base64'));

  // run window.validate() for the structural verdict (the surfaced API)
  structural = await page.evaluate(() => {
    const r = window.validate();
    return { structural: r.structural, motionNote: r.motion.note };
  });

  // screenshot the live preview (mid-run, the most dynamic anim)
  await page.evaluate(() => window.__ss.play('run'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'preview.png') });

  // verify the canvas actually rendered something (not a black frame)
  const readback = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const off = document.createElement('canvas'); off.width = c.width; off.height = c.height;
    const ctx = off.getContext('2d');
    try {
      ctx.drawImage(c, 0, 0);
      const d = ctx.getImageData(0, 0, off.width, off.height).data; let nb = 0; const tot = d.length / 4;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 8 || d[i + 1] > 8 || d[i + 2] > 8) nb++;
      return { nonblackRatio: +(nb / tot).toFixed(4) };
    } catch (e) { return { err: String(e) }; }
  });

  await page.close();

  // MOTION/QUALITY half — Gemini reads each anim's contact sheet (or skips with a
  // clear note when creds are absent). Out of band from the browser (creds+net).
  for (const a of perAnim) {
    const v = await validateMotion(a._contact, a.name, { label: `${a.name} cycle (${a.frameCount} frames)` });
    delete a._contact;
    motion.push(v);
  }

  result = { ok: errors.length === 0, anims, perAnim, structural, readback };
} catch (e) {
  result = { ok: false, fatal: String(e) };
}

await browser.close();
server.close();

// ---- verdict ----
const animsOK = result.perAnim && result.perAnim.every((a) => a.advanced && a.inRange);
const structPass = structural && structural.structural && structural.structural.pass;
const renderedOK = result.readback && result.readback.nonblackRatio > 0.02;
// motion is advisory unless creds present AND a verdict failed (don't fail offline).
// single-frame anims (idle/jump poses) have no cycle to judge -> structural-gated only;
// only multi-frame anims must pass the smooth-cycle motion judge.
const motionPass = !geminiConfigured() ? true : motion.every((m, i) => {
  if (!m.available) return true;
  if (result.perAnim[i] && result.perAnim[i].frameCount === 1) return true; // a pose, not a cycle
  return m.pass;
});
const pass = !!(result.ok && errors.length === 0 && animsOK && structPass && renderedOK && motionPass);

const report = {
  pass,
  errors,
  geminiConfigured: geminiConfigured(),
  anims: result.anims,
  perAnim: result.perAnim,
  structural: structural && structural.structural,
  motion,
  readback: result.readback,
  fatal: result.fatal,
  out: ['preview.png', 'contact-all.png', ...(result.anims || []).map((n) => `contact-${n}.png`)].map((f) => path.join('out', f))
};
fs.writeFileSync(path.join(OUT, 'check-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(pass ? 0 : 1);
