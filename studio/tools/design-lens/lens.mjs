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
import { FUN, LENSES, MECHANICS, DIAGNOSIS, POLISH, FUN_BLEND, FUN_MIN } from './lenses.mjs';

// ── PRODUCTION POLISH: score the real fun the geometry Feel model can't see, from
// the features the game actually ships (juice wired, a boss, an economy, per-level
// music + unit variety, cohesive art). Scans the game's effective source (incl. the
// vendored SDK) + GAME_META. Each dimension 0..1; see POLISH in lenses.mjs.
function scanText(dir) {
  let t = ''; const src = path.join(dir, 'src');
  (function walk(d) { let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of es) { const f = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(f); } else if (/\.(m?js)$/.test(e.name)) { try { t += '\n' + fs.readFileSync(f, 'utf8'); } catch {} } } })(fs.existsSync(src) ? src : dir);
  return t;
}
function scorePolish(dir, meta, levels) {
  const t = scanText(dir);
  const juiceKinds = ['burst', 'explode', 'ring', 'muzzle', 'popText', 'ambient', 'shake', 'flash', 'glow'];
  const juiceHit = juiceKinds.filter((k) => new RegExp('Juice\\.' + k + '\\(').test(t)).length;
  const juice = Math.min(1, juiceHit / 7);                                   // 7+ distinct juice effects wired = full
  const hasBoss = (levels || []).some((l) => l.feat && l.feat.hasBoss);
  const spectacle = hasBoss ? 1 : (/\bboss\b/i.test(t) ? 0.7 : 0.4);
  const economy = /REFINERY|musicByLevel|\bdepot\b|coins\b/.test(t);
  const reward = economy ? 1 : 0.45;
  const tracks = (() => { const m = t.match(/musicByLevel\s*:\s*\[([\s\S]*?)\]/); return m ? [...m[1].matchAll(/['"][^'"]+\.(?:mp3|ogg|wav)['"]/g)].length : 0; })();
  const unitTypes = new Set((levels || []).flatMap((l) => (l.feat && l.feat.unitTypes) || [])).size;
  const variety = Math.min(1, 0.5 * Math.min(1, tracks / Math.max(2, (levels || []).length)) + 0.5 * Math.min(1, unitTypes / 4));
  const art = (meta && (meta.art || (meta.stages && meta.stages.art))) ? (meta.menu || /menu_logo|assets\/menu/.test(t) ? 1 : 0.8) : 0.5;
  const dims = { juice, spectacle, reward, variety, beauty: art };
  let score = 0; for (const k in POLISH) score += POLISH[k].w * (dims[k] != null ? dims[k] : 0);
  return { score: +score.toFixed(3), dims, juiceHit, tracks, unitTypes, hasBoss };
}

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
          const hasBoss = spec.schedule ? spec.schedule.some(e => /boss|warlord|elite|tank/.test(e.type)) : false;
          // absolute INTENSITY (threat load) — what the span-normalized Feel score
          // can't see: does the CAMPAIGN escalate level to level?
          const TW = { scout: 1, gunner: 2, brawler: 3, warlord: 12 };
          const intensity = spec.schedule ? spec.schedule.reduce((a, e) => a + (TW[e.type] || 1), 0) : ((spec.waves || []).length * 3 || (spec.platforms || []).length || (spec.ground || []).length);
          return {
            level: i + 1, name: spec.name || `level ${i + 1}`,
            fun: s.fun, engagement: s.engagement, dynamics: s.dynamics, arc: s.arc, flow: s.flow,
            peakPos: s.peakPos, weakest: s.weakest, curve: p.curve || [], intensity,
            feat: { unitTypes, flanks, hasBoss, hasDepot: !!spec.depot, coins: (spec.coins || []).length }
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

// campaign macro curve. Two axes — the span-normalized Feel score measures each
// level's interest-curve QUALITY (it should be high & even); ESCALATION is the
// separate axis the FUN score can't see (the campaign's absolute intensity must
// climb to the finale, per Schell #61 fractal interest — the whole campaign is
// the envelope, climaxing at the last level).
function macroArc(levels) {
  const f = levels.map(l => l.fun), inten = levels.map(l => l.intensity || 0); const n = f.length;
  if (n < 2) return { funPeakPos: 1, escalates: true, intensity: inten };
  const funPeakPos = f.indexOf(Math.max(...f)) / (n - 1);
  const funEven = (Math.max(...f) - Math.min(...f)) <= 6;             // every level clears a similar (high) bar
  // escalation: intensity trends up, and the finale is the (near-)peak + has a boss
  const finaleIsPeak = inten[n - 1] >= Math.max(...inten) - 1;
  const rising = inten[n - 1] > inten[0];
  const bossFinale = !!(levels[n - 1].feat && levels[n - 1].feat.hasBoss);
  return { funPeakPos: +funPeakPos.toFixed(2), funEven, intensity: inten, escalates: rising && finaleIsPeak, bossFinale };
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
  // headline FUN = level-design interest (geometry) blended with production polish
  const polish = scorePolish(GAME, META, L);
  const composite = +(FUN_BLEND.design * mean + FUN_BLEND.polish * polish.score * 100).toFixed(1);
  report.fun = composite; report.designFun = mean; report.polish = polish; report.blend = FUN_BLEND;
  report.pass = composite >= FUN_MIN; report.dimMean = dimMean; report.campaignWeakest = campWeak;
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
console.log(`   FUN ${report.fun}  ${tick} (bar ${FUN_MIN})   =  ${Math.round(report.blend.design * 100)}% design ${report.designFun}  +  ${Math.round(report.blend.polish * 100)}% polish ${Math.round(report.polish.score * 100)}`);
console.log(`     design components: ` + ['engagement', 'dynamics', 'arc', 'flow'].map(d => `${d} ${report.dimMean[d]}`).join('  '));
console.log(`     polish (Schell #58/#62/#40/#31/#63): ` + Object.keys(report.polish.dims).map(k => `${k} ${report.polish.dims[k].toFixed(2)}`).join('  '));
const m = report.macroArc;
console.log(`   per-level FUN ${m.funEven ? 'even & high ✓' : 'uneven — some levels lag'}  ·  campaign intensity [${(m.intensity || []).join(' → ')}] ${m.escalates ? 'escalates to the finale ✓' : '⚠ does not climb to the finale — make the last ground the most intense'}${m.bossFinale ? ' (boss finale ✓)' : ''}`);
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
