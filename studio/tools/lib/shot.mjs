/*
 * shot.mjs — shared headless capture for the VLM validator bricks.
 *
 * Both studio-art (art-cohesion) and studio-distinct (distinctness) need the same
 * thing: serve a game's src/ statically, load its index.html headless under
 * swiftshader (the SAME chromium flags as the game's own eval.mjs / shotlive.mjs),
 * drive its in-page harness a few frames, and grab PNG frames as base64. This is
 * that one capture path, factored out so the two validators don't duplicate it.
 *
 * No vendor copy is needed: we drive the GAME's own served dir (its vendored
 * phaser.min.js + studio.js already sit in src/vendor/), so the dispatcher's
 * ensure-vendor (which targets the TOOL dir) is irrelevant here.
 *
 *   import { captureFrames } from '../lib/shot.mjs';
 *   const frames = await captureFrames(gameSrcDir, [40, 160, 320]);
 *   // -> [{ at, base64, mimeType:'image/png' }, ...]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

// SIGKILL every descendant of `rootPid` (default: us). Hygiene backstop: after
// browser.close() a chrome GPU/zygote helper can briefly survive; reaping our whole
// subtree before we exit guarantees no headless-browser process is left behind
// (the dispatcher additionally captures our output to a file, not a pipe, so it
// never blocks on these helpers — but leaving zombies around is still bad form).
function killDescendants(rootPid = process.pid) {
  let kids = [];
  try { kids = execFileSync('pgrep', ['-P', String(rootPid)], { encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean); }
  catch { return; } // no children (pgrep exits 1) or pgrep absent
  for (const k of kids) {
    killDescendants(Number(k));        // depth-first: reap grandchildren before the child
    try { process.kill(Number(k), 'SIGKILL'); } catch { /* already gone */ }
  }
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
};

// resolve <gameDir> | <gameDir>/src -> the dir that actually holds index.html.
export function resolveSrc(gameDir) {
  const abs = path.resolve(gameDir);
  if (fs.existsSync(path.join(abs, 'index.html'))) return abs;
  const src = path.join(abs, 'src');
  if (fs.existsSync(path.join(src, 'index.html'))) return src;
  return abs; // let the caller surface a 404 / missing-index error
}

// serve `srcDir` on an ephemeral port; returns { base, close }.
async function serve(srcDir) {
  const server = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/') u = '/index.html';
    const f = path.join(srcDir, u);
    if (!f.startsWith(srcDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); return res.end('nf');
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

/**
 * Capture PNG frames of a game at the given step counts.
 * @param {string} gameDir  the game dir (or its src/) — resolved automatically.
 * @param {number[]} ats    step counts to screenshot at (advanced via window.__run).
 * @param {object} [opts]   { width, height, renderer }
 * @returns {Promise<Array<{at:number, base64:string, mimeType:string}>>}
 */
export async function captureFrames(gameDir, ats = [40, 160, 320], opts = {}) {
  const srcDir = resolveSrc(gameDir);
  if (!fs.existsSync(path.join(srcDir, 'index.html'))) {
    throw new Error(`no index.html under ${gameDir} (looked in ./ and ./src)`);
  }
  const width = opts.width || 960, height = opts.height || 540;
  const renderer = opts.renderer || 'webgl';
  const { base, close } = await serve(srcDir);
  const browser = await chromium.launch({
    headless: true,
    // handleSIG*: false — don't let Playwright install signal handlers that keep a
    // helper process alive holding our inherited stdout pipe under execFileSync.
    handleSIGTERM: false, handleSIGINT: false, handleSIGHUP: false,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const frames = [];
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${base}/?r=${renderer}`, { waitUntil: 'load', timeout: 30000 });
    // games install the Studio harness which sets window.__ready; fall back to a
    // short settle if a game doesn't expose it so we still grab *something*.
    await page.waitForFunction(() => window.__ready === true, { timeout: 20000 }).catch(() => {});
    const hasRun = await page.evaluate(() => typeof window.__run === 'function');
    let prev = 0;
    for (const at of ats) {
      if (hasRun) {
        const step = Math.max(0, at - prev);
        if (step > 0) await page.evaluate((n) => window.__run(n), step);
        prev = at;
      } else {
        await page.waitForTimeout(400);
      }
      const buf = await page.screenshot({ type: 'png', timeout: 90000 });
      frames.push({ at, base64: buf.toString('base64'), mimeType: 'image/png' });
    }
    await page.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
    close();
    // backstop: reap any chrome helper that outlived browser.close() so a parent's
    // execFileSync (the dispatcher) sees our stdout pipe hit EOF and returns.
    killDescendants();
  }
  return frames;
}
