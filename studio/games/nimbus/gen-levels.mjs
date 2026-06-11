/*
 * gen-levels.mjs — Nimbus Climb level generator (lives with the game; derived
 * from tools/level-gen/sky.mjs, which is read-only to this game).
 *
 * Playtest-driven rework (issues #1 #3 #4):
 *   #1/#2  every level gets a DESIGN SIGNATURE + its own sky/bgTint + a `bg`
 *          texture key (per-level painted backdrop wired in game.js).
 *   #3     the angry storm-imp clouds now DO something: every gust zone is
 *          anchored to an imp at its upwind edge (the cloud visibly blows the
 *          crosswind; the SDK's gust emitter streams from that exact point),
 *          and imps patrol wider so they sweep their shelf.
 *   #4     climbs lengthened ~1.5-2x (930-1080px -> 1630-1990px).
 *
 * Reachability is the same math as sky.mjs (kept verbatim where it matters):
 *   - staggered lanes 320/480/640, platforms 120 wide, 90px rises (< full jump)
 *   - updraft: centre column, WIDE exit ledge offset right (verified config)
 *   - gust: only on OUTER-lane steps, wind blowing INWARD over a widened
 *     240px landing; the autopilot is gust-aware (waits for the lull).
 *   - springs are SIDE FLAIR ONLY (off-chain bounce-puffs with coin fountains,
 *     for humans). On-route springs are autopilot-fragile in this SDK: the
 *     vertical driver's jump trigger (dx<150) fires before it walks onto the
 *     pad and a normal jump suppresses the launch (vy<-120 guard) — proven by
 *     a stuck gate run; that is also why the original levels shipped without
 *     route springs.
 *
 * usage: node gen-levels.mjs     (writes src/game/levels.js)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'src', 'game', 'levels.js');

const LANES = [320, 480, 640], W = 120, HOP = 90;
const lane = (i) => LANES[Math.max(0, Math.min(2, i))];

function build(spec) {
  const T = 40;
  const platforms = [], chain = [], coins = [], enemies = [], updrafts = [], gusts = [], springs = [], movers = [];
  // PASS 1: build with y RELATIVE to the base platform top (0 at base, negative up),
  // tracking the real climb; PASS 2 shifts everything by the computed height.
  let y = 0;
  let li = spec.startLane != null ? spec.startLane : 1;
  let dir = li === 0 ? 1 : -1;

  platforms.push({ x: lane(li) - 120, y, w: 240, mat: 'cloud' });
  chain.push({ x: lane(li), y: y - 20 });
  const spawnRel = { x: lane(li), y: y - 120 };

  const place = (cx, ny, mat, w) => { platforms.push({ x: cx - (w || W) / 2, y: ny, w: w || W, mat: mat || 'cloud' }); };
  const wp = (cx, ny) => chain.push({ x: cx, y: ny - 20 });
  const coinArc = (cx, ny) => coins.push({ x: cx, y: ny - 55 });
  const imp = (x, ny, patrol) => enemies.push({ x, y: ny - 14, patrol: patrol || 70 });
  const nextLane = () => { if (li + dir > 2 || li + dir < 0) dir = -dir; li += dir; return lane(li); };
  const farLane = () => (li <= 1 ? li + 1 : li - 1);

  for (let s = 0; s < spec.steps.length; s++) {
    const step = spec.steps[s];
    if (typeof step === 'object' && step.t === 'updraft') {
      // verified-reliable config: centre column (480), WIDE exit ledge right (640)
      if (li !== 1) { y -= HOP; place(480, y, 'cloud'); wp(480, y); coinArc(480, y); li = 1; }
      const colX = 480, exitX = 640;
      const rise = step.rise || 340;
      const topY = y - rise;
      updrafts.push({ x: colX, w: 150, y0: topY - 120, y1: y + 10, maxRise: 260 });
      place(exitX, topY, 'crystal', 200);
      wp(exitX, topY);
      for (let k = 1; k <= 3; k++) coins.push({ x: colX, y: y - Math.round(rise * k / 4) });
      if (step.imp) imp(exitX - 40, topY, 60);             // a sweeper imp guards the exit ledge
      li = 2; dir = -1; y = topY;
    } else {
      const cx = nextLane();
      y -= HOP;
      const mat = (step && step.mat) || (typeof step === 'string' && step !== 'hop' ? step : 'cloud');
      place(cx, y, mat);
      wp(cx, y);
      coinArc(cx, y);
      if (step && step.gust) {
        // ANGRY-CLOUD CROSSWIND (issue #3): outer lanes only, wind blowing
        // INWARD over a widened 240px landing; a storm-imp sits at the UPWIND
        // edge — the SDK's gust emitter streams from that exact point, so the
        // imp is visibly the thing blowing you sideways.
        if (cx === 480) throw new Error(`${spec.name}: gust step ${s} landed on the centre lane (redesign the walk)`);
        const land = platforms[platforms.length - 1];
        land.w = 240; land.x = cx - 120;
        const inward = cx > 480 ? -1 : 1;
        gusts.push({ x: cx, y: y + 26, w: 200, h: 110, dir: inward, period: 3.0, duty: 0.4, push: 180 });
        imp(cx - inward * 100, y, 26);
        coins.push({ x: cx + inward * 80, y: y - 50 });
      }
      if (step && step.storm) {
        platforms.push({ x: 70, y: y + 6, w: 120, mat: 'storm' });
        platforms.push({ x: 770, y: y + 6, w: 120, mat: 'storm' });
      }
      if (step && step.imp) imp(cx, y, step.imp === true ? 70 : step.imp);
    }
  }

  const climb = -y;
  // a SIDE element (flair platform / ferry) must never intrude on the route:
  // x stays in the flank bands (<=230 or >=730) and >=140px vertical clearance
  // from any platform that reaches into the same flank (storm rows, updraft exits).
  const assertClear = (what, fx, fy, halfW, vMargin) => {
    if (fx - halfW < 0 || fx + halfW > 960) throw new Error(`${spec.name}: ${what} off-world at x${fx}`);
    if (fx + halfW > 230 && fx - halfW < 730) throw new Error(`${spec.name}: ${what} at x${fx} reaches into the lanes`);
    for (const p of platforms) {
      const overlapX = (fx + halfW + 20) > p.x && (fx - halfW - 20) < p.x + p.w;
      if (overlapX && Math.abs(p.y - fy) < (vMargin || 140)) throw new Error(`${spec.name}: ${what} at (${fx},${fy}) too close to platform (${p.x},${p.y})`);
    }
  };

  // SIDE BOUNCE-PUFFS (flair springs, off-chain): a flank shelf with a spring
  // and a coin fountain rising above it — a human treat, invisible to the
  // deterministic route (the autopilot never targets the flanks).
  for (const f of spec.flair || []) {
    const fy = -Math.round(climb * f.at);
    assertClear('flair spring', f.x, fy, 80);
    platforms.push({ x: f.x - 80, y: fy, w: 160, mat: 'cloud' });
    springs.push({ x: f.x, y: fy - 9, vel: 900 });
    for (let k = 1; k <= (f.coins || 4); k++) coins.push({ x: f.x, y: fy - 40 - k * 60 });
  }

  // decorative side FERRIES (movers) — drifting cloud shelves on the tower
  // flanks, same clearance contract; pure motion/life, never on the route.
  for (const f of spec.ferries || []) {
    const fy = -Math.round(climb * f.at);
    assertClear('ferry', f.x, fy, 60 + 4);
    movers.push({ x: f.x, y: fy, axis: 'y', range: f.range || 110, speed: f.speed || 40, w: 120, h: 20, mat: 'cloud' });
  }

  // PASS 2: shift relative ys into world space. height = headroom + climb + base.
  const height = 200 + climb + 200;
  const baseY = height - 60;
  const shift = (o, k) => { o[k] += baseY; };
  platforms.forEach((p) => shift(p, 'y'));
  chain.forEach((c) => shift(c, 'y'));
  coins.forEach((c) => shift(c, 'y'));
  enemies.forEach((e) => shift(e, 'y'));
  springs.forEach((s) => shift(s, 'y'));
  movers.forEach((m) => shift(m, 'y'));
  gusts.forEach((g) => shift(g, 'y'));
  updrafts.forEach((u) => { shift(u, 'y0'); shift(u, 'y1'); });
  const spawn = { x: spawnRel.x, y: spawnRel.y + baseY };
  const top = chain[chain.length - 1];

  return {
    name: spec.name, tile: T, vertical: true,
    width: 960, height, groundY: height - 40, sky: spec.sky, bgTint: spec.bgTint,
    bg: spec.bg,
    spawn, goalY: top.y,
    platforms, chain, updrafts, gusts, springs, movers, contraptions: [], enemies, coins,
  };
}

// ---------------------------------------------------------------------------
// FIVE DISTINCT TOWERS (issue #1) — one signature verb each, lengthened ~1.5-2x
// (issue #4), gust imps that visibly blow the wind (issue #3):
//   C1 Foothill Puffs   bouncy intro     — 2 bounce-puff SPRINGS, no wind
//   C2 Whisperdraft     the wind level   — 5 angry-cloud GUST gauntlets
//   C3 Mistspire        slippery dusk    — MIST-heavy footing + drifting side ferries
//   C4 Stormshelf Pass  the storm        — 4 STORM-shelf rows + 3 hard gusts
//   C5 The Sun Bell     the master mix   — spring + gusts + storm + DOUBLE updraft
// ---------------------------------------------------------------------------
const G = { gust: 1 };
const LEVELS = [
  build({
    name: 'Foothill Puffs', sky: 0x9ec7ec, bgTint: 0xffffff, bg: 'bg_lv1',
    steps: ['hop', 'mist', 'hop',
      { t: 'spring' },
      'hop', { mat: 'crystal', imp: true }, 'hop',
      { t: 'spring' },
      'mist',
      { t: 'updraft', rise: 320 },
      'hop'],
  }),
  build({
    name: 'Whisperdraft', sky: 0x7fc0d8, bgTint: 0xeafaff, bg: 'bg_lv2',
    steps: ['hop', 'mist', { ...G }, 'hop', { ...G }, 'crystal', { ...G }, 'mist',
      { ...G }, 'hop', { ...G }, 'mist', 'crystal', 'hop',
      { t: 'updraft', rise: 340 },
      'hop'],
  }),
  build({
    name: 'Mistspire', sky: 0x8f87c8, bgTint: 0xe6dcff, bg: 'bg_lv3',
    ferries: [{ x: 130, at: 0.3 }, { x: 830, at: 0.55 }, { x: 130, at: 0.8 }],
    steps: ['hop', 'mist', 'mist', 'crystal', 'mist',
      { t: 'spring', mat: 'mist' },
      'mist', { mat: 'mist', imp: true }, 'mist', 'crystal', 'mist', { mat: 'mist', imp: true },
      { t: 'updraft', rise: 360 },
      'hop'],
  }),
  build({
    name: 'Stormshelf Pass', sky: 0x55648e, bgTint: 0xc8c4e0, bg: 'bg_lv4',
    steps: [{ mat: 'cloud', storm: 1 }, 'crystal', { ...G }, 'mist',
      { mat: 'cloud', storm: 1 }, 'crystal', { ...G }, 'hop',
      { mat: 'cloud', storm: 1, imp: true }, 'mist', { ...G }, 'crystal',
      { mat: 'cloud', storm: 1 }, 'mist', 'crystal',
      { t: 'updraft', rise: 360, imp: true },
      'hop'],
  }),
  build({
    name: 'The Sun Bell', sky: 0xa3b8e6, bgTint: 0xfff3cc, bg: 'bg_lv5',
    steps: ['hop', 'mist', 'crystal',
      { t: 'spring' },
      'hop', 'hop',
      { t: 'updraft', rise: 300 },
      'hop', { mat: 'mist', gust: 1 }, 'crystal', { ...G }, 'mist',
      { mat: 'cloud', storm: 1, imp: true }, 'crystal',
      { t: 'updraft', rise: 360 },
      'hop'],
  }),
];

const banner = `/* Nimbus Climb — GENERATED by games/nimbus/gen-levels.mjs (vertical archetype;\n * derived from tools/level-gen/sky.mjs). Reachable-by-construction: staggered\n * lanes, rises < full-jump, outer-lane springs/gusts with wide offset landings,\n * verified centre-column updrafts. Per-level signatures + per-level backdrops\n * (issues #1 #2 #3 #4). Re-run the generator to regenerate. */\n`;
fs.writeFileSync(OUT, banner + 'window.LEVELS = ' + JSON.stringify(LEVELS, null, 2) + ';\n');
console.log('wrote', path.relative(HERE, OUT), '—', LEVELS.length, 'levels');
for (const L of LEVELS) {
  const climb = (L.height - 60) - L.chain[L.chain.length - 1].y - 20;
  console.log(`  ${L.name}: climb ${climb}px (h ${L.height}) · ${L.platforms.length} plats · ${L.chain.length} wps · ` +
    `${L.springs.length} springs · ${L.gusts.length} gusts · ${L.updrafts.length} updrafts · ${L.movers.length} ferries · ${L.enemies.length} imps · ${L.coins.length} coins`);
}
