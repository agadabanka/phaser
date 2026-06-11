/*
 * design-lens — the DESIGN DIAGNOSTIC (the studio's /design.html, as a tool).
 *
 * The Feel model gives a NUMBER; this gives the WHY and the FIX. It runs the
 * in-page Studio.Feel over a game's levels, then reads the result through the
 * Jesse Schell LENSES (lenses.js): it scores the lenses that map to each Feel
 * component, names the weakest LENS per level + per campaign, and prints the
 * lens QUESTION plus a concrete, archetype-specific MECHANIC prescription
 * (MDA upward — trace the weak aesthetic to the mechanic, never patch the symptom).
 *
 *   node tools/design-lens/lens.mjs games/roadwar          # the design report
 *   node tools/design-lens/lens.mjs games/roadwar --json   # machine-readable
 *
 * Advisory (always exits 0). The 0-death gate is the hard gate; this steers FUN.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { FUN, LENSES, MECHANICS, DIAGNOSIS, FUN_MIN } from './lenses.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(HERE, '..', '..');
const argDir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'games/ember';
const asJson = process.argv.includes('--json');
const GAME = path.isAbsolute(argDir) ? argDir : path.resolve(STUDIO_ROOT, argDir.replace(/^studio\//, ''));
const SRC = path.join(GAME, 'src');
const META = (() => { try { return JSON.parse(fs.readFileSync(path.join(GAME, 'GAME_META.json'), 'utf8')); } catch { return {}; } })();
const ARCH = META.archetype || 'runner';

// ---- collect, headless, the Feel score + predicted curve + a few spec features ----
async function collect(srcDir) {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg' };
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
  let out;
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.goto(`${BASE}/?r=webgl`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
    out = await page.evaluate(() => {
      if (!window.Studio || !window.Studio.Feel) return { error: 'window.Studio.Feel missing' };
      const specs = window.LEVELS || [];
      return {
        levels: specs.map((spec, i) => {
          const s = window.Studio.Feel.score(spec);
          const p = window.Studio.Feel.predict ? window.Studio.Feel.predict(spec) : { curve: [] };
          // a few spec features the lenses read directly
          const unitTypes = spec.schedule ? [...new Set(spec.schedule.map(e => e.type))] : [];
          const flanks = spec.schedule ? spec.schedule.filter(e => e.lane != null && e.lane !== (spec.rally != null ? spec.rally : 1)).length : 0;
          return {
            level: i + 1, name: spec.name || `level ${i + 1}`,
            fun: s.fun, engagement: s.engagement, dynamics: s.dynamics, arc: s.arc, flow: s.flow,
            peakPos: s.peakPos, weakest: s.weakest, curve: p.curve || [],
            feat: { unitTypes, flanks, hasBoss: spec.schedule ? spec.schedule.some(e => /boss|warlord|elite|tank/.test(e.type)) : false, hasDepot: !!spec.depot, coins: (spec.coins || []).length }
          };
        })
      };
    });
    await page.close();
  } catch (e) { out = { error: String(e).split('\n')[0] }; }
  finally { await browser.close(); server.close(); }
  return out;
}

// map a Feel component (0..1) to a lens score, and the lens that owns it
const COMP_LENS = { engagement: 'inherent', dynamics: 'challenge', arc: 'interest', flow: 'flow' };
const lensFix = (comp) => (DIAGNOSIS[comp].fix[ARCH] || Object.values(DIAGNOSIS[comp].fix)[0]);

// campaign macro interest curve: does per-level FUN climax near the end?
function macroArc(levels) {
  const f = levels.map(l => l.fun); const n = f.length; if (n < 2) return { ok: true, peakPos: 1 };
  const peakPos = (f.indexOf(Math.max(...f))) / (n - 1);
  const rising = f[n - 1] >= f[0];
  return { peakPos: +peakPos.toFixed(2), rising, climaxLate: peakPos >= 0.6 };
}

const res = await collect(SRC);
const report = { game: path.basename(GAME), archetype: ARCH, funMin: FUN_MIN };
if (res.error || !res.levels) { report.error = res.error || 'no levels'; }
else {
  const L = res.levels;
  const mean = +(L.reduce((s, l) => s + l.fun, 0) / L.length).toFixed(1);
  const dims = ['engagement', 'dynamics', 'arc', 'flow'];
  const dimMean = {}; dims.forEach(d => dimMean[d] = +(L.reduce((s, l) => s + l[d], 0) / L.length).toFixed(3));
  const campWeak = dims.reduce((lo, d) => dimMean[d] < dimMean[lo] ? d : lo, dims[0]);
  const macro = macroArc(L);
  // per-level lens diagnosis
  const perLevel = L.map(l => {
    const weak = dims.reduce((lo, d) => l[d] < l[lo] ? d : lo, dims[0]);
    const lens = LENSES[COMP_LENS[weak]];
    return { level: l.level, name: l.name, fun: l.fun, comps: { engagement: l.engagement, dynamics: l.dynamics, arc: l.arc, flow: l.flow }, weakest: weak, lens: `#${lens.n} ${lens.name}`, question: lens.q, prescription: lensFix(weak), feat: l.feat };
  });
  report.mean = mean; report.pass = mean >= FUN_MIN; report.dimMean = dimMean; report.campaignWeakest = campWeak;
  report.campaignLens = `#${LENSES[COMP_LENS[campWeak]].n} ${LENSES[COMP_LENS[campWeak]].name}`;
  report.campaignFix = lensFix(campWeak);
  report.macroArc = macro;
  report.levels = perLevel;
}

if (asJson) { fs.mkdirSync(path.join(GAME, 'out'), { recursive: true }); fs.writeFileSync(path.join(GAME, 'out', 'design-lens.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); process.exit(0); }

// ---- pretty report ----
console.log(`\n🔍 Design Lens — ${report.game}  (${report.archetype})   ·  grounded in MDA + Schell's lenses`);
if (report.error) { console.log('   ⚠ ' + report.error + '\n'); process.exit(0); }
const tick = report.pass ? '✅' : '⚠️';
console.log(`   campaign FUN ${report.mean}  ${tick} (bar ${FUN_MIN})   ·   components: ` + ['engagement', 'dynamics', 'arc', 'flow'].map(d => `${d} ${report.dimMean[d]}`).join('  '));
const m = report.macroArc;
console.log(`   macro interest curve: peak at ${Math.round(m.peakPos * 100)}% of the campaign ${m.climaxLate ? '(climaxes late ✓)' : '(peaks too early — back-load the hardest ground)'} ${m.rising ? '' : '· campaign does not rise overall'}`);
console.log(`   campaign weakest: ${report.campaignLens}  →  ${report.campaignFix}`);
console.log('\n   per-level lens diagnosis:');
for (const l of report.levels) {
  const bar = '█'.repeat(Math.max(0, Math.round(l.fun / 4))).padEnd(25);
  console.log(`     L${l.level} ${String(l.fun).padStart(5)} ${bar} ${l.name}`);
  console.log(`        weakest lens ${l.lens.padEnd(22)} — “${l.question}”`);
  console.log(`        → ${l.prescription}`);
}
// the single highest-leverage move
const worst = report.levels.slice().sort((a, b) => a.fun - b.fun)[0];
console.log(`\n   ▶ highest-leverage fix: ${worst.lens} on L${worst.level} ${worst.name} (FUN ${worst.fun}) — ${worst.prescription}\n`);
process.exit(0);
