/*
 * Studio Feel runner — the DETERMINISTIC fun-score leaderboard (a SOFT metric).
 *
 * Serves a game's src/, loads it headless (the same chromium/swiftshader pattern
 * as the game's eval.mjs), reads window.LEVELS, and scores EACH level through the
 * in-page window.Studio.Feel.score (the ported jazz feel model). Prints a per-level
 * FUN leaderboard + the campaign mean + the single weakest dimension across the
 * campaign, then ALWAYS exits 0 (feel is advisory; the 0-death gate is the hard gate).
 *
 *   node studio/tools/eval/feel.mjs [gameDir]          # default: studio/games/ember
 *   node studio/tools/eval/feel.mjs <gameDir> --json   # machine-readable
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// studio/tools/eval -> studio root is two levels up
const STUDIO_ROOT = path.resolve(HERE, '..', '..');
const argDir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'games/ember';
const asJson = process.argv.includes('--json');
const gameDir = path.resolve(process.cwd(), argDir.startsWith('studio/') ? argDir.slice('studio/'.length) : argDir);
// fall back: allow passing a path relative to studio root too
const GAME = fs.existsSync(path.join(gameDir, 'src')) ? gameDir : path.resolve(STUDIO_ROOT, argDir.replace(/^studio\//, ''));
const SRC = path.join(GAME, 'src');

// ---- compute the campaign-level result (exported so the conductor can reuse it) ----
export async function runFeel(srcDir) {
  if (!fs.existsSync(srcDir)) return { ok: false, error: `no src/ at ${srcDir}`, levels: [], mean: 0, weakest: null };
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
  const server = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
    const f = path.join(srcDir, u);
    if (!f.startsWith(srcDir) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let result;
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.goto(`${BASE}/?r=webgl`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
    // score every level via the IN-PAGE Studio.Feel (the SDK is the single source of truth)
    const scored = await page.evaluate(() => {
      if (!window.Studio || !window.Studio.Feel) return { error: 'window.Studio.Feel missing' };
      const specs = window.LEVELS || [];
      return {
        levels: specs.map((spec, i) => {
          const s = window.Studio.Feel.score(spec);
          return {
            level: i + 1, name: spec.name || `level ${i + 1}`,
            fun: s.fun, engagement: s.engagement, dynamics: s.dynamics, arc: s.arc, flow: s.flow,
            peakPos: s.peakPos, weakest: s.weakest
          };
        })
      };
    });
    await page.close();
    if (scored.error) { result = { ok: false, error: scored.error, levels: [], mean: 0, weakest: null }; }
    else result = summarize(scored.levels);
  } catch (e) {
    result = { ok: false, error: String(e).split('\n')[0], levels: [], mean: 0, weakest: null };
  } finally {
    await browser.close(); server.close();
  }
  return result;
}

// reduce per-level scores -> campaign mean FUN + the single weakest dimension overall
function summarize(levels) {
  if (!levels.length) return { ok: true, levels: [], mean: 0, weakest: null };
  const mean = +(levels.reduce((s, l) => s + l.fun, 0) / levels.length).toFixed(1);
  // campaign weakest = the component with the lowest MEAN across all levels
  const dims = ['engagement', 'dynamics', 'arc', 'flow'];
  const dimMean = {};
  dims.forEach(d => { dimMean[d] = +(levels.reduce((s, l) => s + l[d], 0) / levels.length).toFixed(3); });
  const weakest = dims.reduce((lo, d) => (dimMean[d] < dimMean[lo] ? d : lo), dims[0]);
  // the worst single level (for the feel-guided "improve X on level N")
  const worstLevel = levels.reduce((lo, l) => (l.fun < lo.fun ? l : lo), levels[0]);
  return { ok: true, levels, mean, dimMean, weakest, worstLevel };
}

// ----------------------------------------------------------------- main / print
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const res = await runFeel(SRC);
  if (asJson) { console.log(JSON.stringify(res, null, 2)); process.exit(0); }
  console.log(`\n🎛  Studio Feel — ${path.basename(GAME)}  (deterministic fun-score · soft metric)`);
  if (!res.ok) {
    console.log(`   ⚠ could not score: ${res.error}`);
    process.exit(0); // soft metric — never fail the build
  }
  if (!res.levels.length) {
    console.log('   (no levels found on window.LEVELS)');
    process.exit(0);
  }
  // FUN leaderboard, best first
  const board = res.levels.slice().sort((a, b) => b.fun - a.fun);
  console.log('   FUN leaderboard:');
  for (const l of board) {
    const bar = '█'.repeat(Math.max(0, Math.round(l.fun / 4))).padEnd(25);
    console.log(`     L${l.level} ${String(l.fun).padStart(5)}  ${bar}  ${l.name}  (weakest: ${l.weakest})`);
  }
  console.log(`   components (campaign mean): ` + ['engagement', 'dynamics', 'arc', 'flow'].map(d => `${d} ${res.dimMean[d]}`).join('  '));
  console.log(`   campaign mean FUN: ${res.mean}`);
  console.log(`   weakest dimension: ${res.weakest}  →  improve ${res.weakest} on level ${res.worstLevel.level} (${res.worstLevel.name}, FUN ${res.worstLevel.fun})\n`);
  process.exit(0); // ALWAYS exit 0
}
