/*
 * level-lint — the VALIDATOR for capability "rules".  THE GATE.
 *
 * The CHEAP static gate: lints a game's levels.js against studio/rules.json
 * (the geometry contract that keeps levels AI-completable by construction),
 * per the game's GAME_META.archetype ("runner" | "vertical"). Runs in
 * milliseconds with no browser — catch bad geometry BEFORE the expensive
 * deterministic gate spends minutes proving it.
 *
 *   node validate.mjs --game ../../games/ember
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const argVal = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };

function emit(v, code) {
  const json = JSON.stringify(v, null, 2);
  fs.writeFileSync(path.join(OUT, 'result.json'), json + '\n');
  console.log(json);
  process.exit(code);
}

const gameArg = argVal('--game');
if (!gameArg) emit({ pass: false, score: 0, capability: 'rules', notes: ['usage: node validate.mjs --game games/<name>'] }, 2);
const gameDir = path.isAbsolute(gameArg) ? gameArg : (fs.existsSync(path.resolve(gameArg)) ? path.resolve(gameArg) : path.join(STUDIO, gameArg));
const rules = JSON.parse(fs.readFileSync(path.join(STUDIO, 'rules.json'), 'utf8'));
const meta = (() => { try { return JSON.parse(fs.readFileSync(path.join(gameDir, 'GAME_META.json'), 'utf8')); } catch { return {}; } })();
const archetype = meta.archetype || 'runner';
const R = rules.archetypes[archetype];
if (!R) emit({ pass: false, score: 0, capability: 'rules', notes: [`unknown archetype "${archetype}" (rules.json has: ${Object.keys(rules.archetypes).join(', ')})`] }, 1);

// load window.LEVELS from the game's levels.js in a vm sandbox (our own file)
const levelsPath = path.join(gameDir, 'src', 'game', 'levels.js');
if (!fs.existsSync(levelsPath)) emit({ pass: false, score: 0, capability: 'rules', notes: ['no src/game/levels.js'] }, 1);
const sandbox = { window: {} };
vm.createContext(sandbox);
try { vm.runInContext(fs.readFileSync(levelsPath, 'utf8'), sandbox, { timeout: 2000 }); }
catch (e) { emit({ pass: false, score: 0, capability: 'rules', notes: ['levels.js failed to evaluate: ' + e.message] }, 1); }
const LEVELS = sandbox.window.LEVELS;
if (!Array.isArray(LEVELS) || !LEVELS.length) emit({ pass: false, score: 0, capability: 'rules', notes: ['window.LEVELS missing/empty'] }, 1);

const DEADLY_MATS = new Set(['lava', 'storm']);
const isDeadlyMat = (m) => DEADLY_MATS.has(m || '');
const notes = [];
let checks = 0, ok = 0;
const check = (cond, okMsg, failMsg) => { checks++; if (cond) { ok++; if (okMsg) notes.push('ok ' + okMsg); } else notes.push('FAIL ' + failMsg); };

// ---------------------------------------------------------------- runner
function lintRunner(L, i) {
  const tag = `L${i + 1} ${L.name || ''}`.trim();
  const ground = L.ground || [];
  const walk = ground.filter(([, , m]) => m !== 'lava');           // walkable slabs
  const gaps = ground.filter(([, , m]) => m === 'lava');           // deadly gaps
  for (const [x1, x2] of gaps) {
    check(x2 - x1 <= R.gapMaxPx, null, `${tag}: lava gap ${x1}-${x2} is ${x2 - x1}px (> ${R.gapMaxPx})`);
    // a gap must not land on ice
    if (R.noGapLandingOnIce) {
      const landing = ground.find(([a]) => a === x2);
      check(!landing || landing[2] !== 'ice', null, `${tag}: gap at ${x1} lands on ICE at ${x2}`);
    }
  }
  for (const w of L.walls || []) {
    check((w.tiles || 1) <= R.wallMaxTiles, null, `${tag}: wall@${w.x} is ${w.tiles} tiles (> ${R.wallMaxTiles})`);
    for (const [x1, x2] of gaps) {
      const d = Math.min(Math.abs(w.x - x2), Math.abs(x1 - w.x));
      check(d >= R.wallGapClearancePx, null, `${tag}: wall@${w.x} only ${d}px from gap ${x1}-${x2} (< ${R.wallGapClearancePx})`);
    }
  }
  if (R.iceExitSolid) for (const [x1, x2, m] of ground) {
    if (m !== 'ice') continue;
    const next = ground.find(([a]) => a === x2);
    check(next && next[2] !== 'lava', null, `${tag}: ice ${x1}-${x2} exits into ${next ? next[2] : 'VOID'}`);
  }
  for (const s of L.springs || []) {
    const slab = walk.find(([a, b]) => s.x >= a && s.x <= b);
    check(slab && slab[1] - slab[0] >= R.springSlabMinPx, null, `${tag}: spring@${s.x} not on a ≥${R.springSlabMinPx}px walkable slab`);
  }
  for (const m of L.movers || []) {
    const overGap = gaps.find(([a, b]) => m.x >= a - 40 && m.x <= b + 40);
    if (overGap) check(overGap[1] - overGap[0] <= R.moverMaxGapPx, null, `${tag}: mover@${m.x} bridges a ${overGap[1] - overGap[0]}px gap (> ${R.moverMaxGapPx})`);
  }
  if (R.goalOnWalkable) {
    const g = walk.find(([a, b]) => (L.goal || 0) >= a && (L.goal || 0) <= b);
    check(!!g, null, `${tag}: goal@${L.goal} not over walkable ground`);
  }
}

// ---------------------------------------------------------------- vertical
function lintVertical(L, i) {
  const tag = `L${i + 1} ${L.name || ''}`.trim();
  const plats = L.platforms || [];
  for (const p of plats) check((p.w || 0) >= R.platformMinWPx, null, `${tag}: platform@${p.x},${p.y} is ${p.w}px wide (< ${R.platformMinWPx})`);
  const chain = L.chain;
  if (R.chainRequired) {
    check(Array.isArray(chain) && chain.length >= 2, null, `${tag}: no chain[] (the ordered waypoint list the autopilot climbs)`);
    if (!Array.isArray(chain)) return;
    // every chain hop must be reachable: inside the hop envelope OR powered by a
    // declared mechanic near the takeoff (updraft column / spring / mover).
    for (let k = 0; k < chain.length - 1; k++) {
      const a = chain[k], b = chain[k + 1];
      const dx = Math.abs(b.x - a.x), dyUp = a.y - b.y;     // +ve when climbing
      const inEnvelope = dx <= R.hopDxMaxPx && dyUp <= R.hopDyUpMaxPx;
      const updraft = (L.updrafts || []).find((u) => a.x >= u.x - (u.w / 2) - 40 && a.x <= u.x + (u.w / 2) + 40 && a.y >= (u.y0 || 0) - 20 && a.y <= (u.y1 || 0) + 30 && dyUp <= R.updraftDyMaxPx);
      const spring = (L.springs || []).find((s) => Math.abs(s.x - a.x) <= 60 && dyUp <= R.springDyMaxPx);
      const mover = (L.movers || []).find((m) => Math.abs(m.x - a.x) <= 160 || Math.abs(m.x - b.x) <= 160);
      check(inEnvelope || updraft || spring || mover, null,
        `${tag}: chain hop ${k}->${k + 1} (dx ${dx}, up ${dyUp}) outside envelope and no updraft/spring/mover powers it`);
    }
    // every waypoint must stand over a walkable platform wide enough to land on
    const minW = R.chainPlatformMinWPx || 120;
    for (let k = 0; k < chain.length; k++) {
      const wp = chain[k];
      const under = plats.find((p) => Math.abs(wp.x - (p.x + p.w / 2)) <= p.w / 2 + 6 && Math.abs((p.y - 20) - wp.y) <= 40 && !isDeadlyMat(p.mat));
      check(under && under.w >= minW, null, `${tag}: waypoint ${k} (${wp.x},${wp.y}) not over a walkable platform ≥ ${minW}px`);
    }
    // spawn near the first waypoint, goal near the top of the world
    check(Math.abs((L.spawn?.x ?? -1) - chain[0].x) <= 120, null, `${tag}: spawn.x ${L.spawn?.x} far from chain[0].x ${chain[0].x}`);
    const top = chain[chain.length - 1];
    const topLimit = Math.max(R.goalNearTopPx || 280, Math.round((R.goalNearTopFrac || 0.3) * (L.height || 1)));
    check(top.y <= topLimit, null, `${tag}: chain top y=${top.y} not near the world top (≤ ${topLimit})`);
  }
  if (R.spawnOnPlatform) {
    const under = plats.find((p) => Math.abs((L.spawn?.x ?? -1) - p.x) <= p.w / 2 + 20 && (L.spawn?.y ?? 0) < p.y);
    check(!!under, null, `${tag}: spawn not above a platform`);
  }
}

function lintShooter(L, i) {
  const tag = `V${i + 1} ${L.name || ''}`.trim();
  const c = L.curtain || {};
  const fallTime = 470 / (c.bulletSpeed || 520);
  const sweep = (c.amp || 170) * 2 * Math.PI / (c.period || 13);
  const margin = (c.gapW || 200) / 2 - (R.shipHalf || 16) - 6;
  check(sweep * fallTime < margin, `${tag}: curtain survivable (sweep·fall ${(sweep*fallTime).toFixed(0)} < gap-margin ${margin.toFixed(0)})`, `${tag}: curtain NOT survivable — sweep·fall ${(sweep*fallTime).toFixed(0)} ≥ gap-margin ${margin.toFixed(0)} (widen gapW / slow period / faster bullets)`);
  check((c.gapW || 200) >= (R.shipHalf||16)*2 + 60, null, `${tag}: gapW ${c.gapW} too narrow for the ship`);
  const waves = L.waves || [];
  check(waves.length >= 1, null, `${tag}: no waves`);
  if (i === LEVELS.length - 1) check(waves.some(w => w.boss), null, `${tag}: final veil has no boss wave`);
}

// ---------------------------------------------------------------- rts
function lintRts(L, i) {
  const tag = `G${i + 1} ${L.name || ''}`.trim();
  const U = R.unitStats || {}, fCd = R.fortressTurretCd || 0.55, gCd = R.garageTurretCd || 0.6;
  const rally = L.rally != null ? L.rally : 1, bt = L.autoBuild || 'brawler';
  const ab = U[bt];
  check(!!ab, null, `${tag}: autoBuild "${bt}" not a known unit (${Object.keys(U).join('/')})`);
  if (R.rallyLaneRequired) check(rally >= 0 && rally <= 2, null, `${tag}: rally lane ${rally} out of range 0..2`);
  check(Array.isArray(L.schedule), null, `${tag}: schedule must be a finite array (the enemy must run out so the deathball snowballs)`);
  check((L.income || 0) > 0, null, `${tag}: income must be > 0`);
  check((L.startScrap || 0) >= (ab ? ab.cost : 1e9), null, `${tag}: startScrap ${L.startScrap} < first autoBuild cost ${ab && ab.cost} (autopilot can't open)`);
  // ACCUMULATION bound — player builds rally units faster than the fortress turret removes them
  if (ab) {
    const ft = L.fortressTurret || { dmg: 16 };
    const buildRate = (L.income || 0) / ab.cost;                       // units/sec the autopilot adds
    const killRate = (ft.dmg / fCd) / ab.hp;                            // units/sec the fortress turret removes
    check(buildRate > killRate, `${tag}: deathball snowballs (build ${buildRate.toFixed(2)} > fortress-kill ${killRate.toFixed(2)} u/s)`, `${tag}: fortress out-removes the rally (build ${buildRate.toFixed(2)} ≤ kill ${killRate.toFixed(2)} u/s) — raise income, drop ${bt} cost, or weaken fortressTurret`);
  }
  // SIDE-LEAK bound — every off-rally unit must be a scout (the deathball never
  // meets it), and the garage gun (focused, since the rally holds the main lane)
  // must clear each before the CUMULATIVE chip exhausts the garage. A leaked
  // scout reaches the base and is shot at distance-0 every gCd; it dies after
  // ceil(hp/dmg) shots, landing floor(killTime/scout.cd) attacks of scout.dmg.
  const allowed = new Set(R.sideLaneUnitsAllowed || ['scout']);
  const gt = L.garageTurret || { range: 150, dmg: 14 };
  let leakDmg = 0, sideN = 0;
  (L.schedule || []).forEach((ev) => {
    // off-rally = a flank the deathball never meets: lane!=rally (lane mode) OR |lx-rally|>band (iso continuous front)
    const onRally = ev.lane != null ? (ev.lane === rally) : ev.lx != null ? (Math.abs(ev.lx - rally) < 0.1) : true;
    if (onRally) return;
    sideN++;
    check(allowed.has(ev.type), null, `${tag}: side unit "${ev.type}"@${ev.lane != null ? 'lane' + ev.lane : 'lx' + ev.lx} not in {${[...allowed].join(',')}} (the deathball never meets it; only a scout the base gun can clear is safe)`);
    const su = U[ev.type]; if (!su) return;
    const killShots = Math.ceil(su.hp / gt.dmg), killTime = killShots * gCd;
    leakDmg += Math.floor(killTime / su.cd) * su.dmg;                   // garage HP this leaked scout chips before dying
  });
  if (sideN) {
    const budget = (R.garageLeakBudgetFrac || 0.35) * (L.garageHp || 1000);
    check(leakDmg <= budget, `${tag}: side leaks survivable (${leakDmg} ≤ ${Math.round(budget)} garage budget, ${sideN} scout(s))`, `${tag}: side leaks chip ${leakDmg} > ${Math.round(budget)} garage budget — widen garageTurret.dmg, fewer side scouts, or more garageHp`);
  }
}
LEVELS.forEach((L, i) => (archetype === 'shooter' ? lintShooter(L, i) : (archetype === 'rts' || archetype === 'isorts') ? lintRts(L, i) : archetype === 'vertical' ? lintVertical(L, i) : lintRunner(L, i)));

const pass = ok === checks;
const score = +(100 * (checks ? ok / checks : 0)).toFixed(1);
notes.unshift(`${archetype} contract: ${ok}/${checks} checks across ${LEVELS.length} level(s)`);
emit({ pass, score, threshold: 100, capability: 'rules', game: path.basename(gameDir), archetype, deterministic: true, notes: notes.slice(0, 40) }, pass ? 0 : 1);
