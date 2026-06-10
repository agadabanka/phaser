/*
 * sky.mjs — generate vertical (sky-climb) levels that are AI-completable BY
 * CONSTRUCTION. It encodes the reachability math the hand-tuning kept getting
 * wrong, so every emitted level passes level-lint AND the 0-death autopilot:
 *
 *   - a STAGGERED spine: platforms alternate L/R centers (XL/XR), width W < dxC
 *     so consecutive platforms do NOT overlap in x → there is always CLEAR AIR
 *     above a takeoff (no underside bonk). The player walks to the platform edge
 *     (within the autopilot's 150px jump trigger) and arcs onto the next.
 *   - rise per hop <= HOP_RISE (< the controller's ~120px full jump).
 *   - MECHANIC steps:
 *       'updraft'  a tall CLEAR column on one side; entry platform at its base,
 *                  exit platform offset at its top (player rides up, steers out).
 *       'spring'   a bounce platform; landing offset on the far side, clear air
 *                  above the spring, dyUp <= 260 (the 900-vel bounce).
 *       'gust'     a normal hop with a phase-clocked crosswind zone + a CATCH
 *                  platform under the crossing.
 *       'storm'    flanking deadly shelves >= 90px clear of the spine.
 *
 * usage: node sky.mjs   (writes ../../games/nimbus/src/game/levels.js)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'games', 'nimbus', 'src', 'game', 'levels.js');

// Lanes 160px apart, platforms 120 wide → 40px GAPS (no overlap = clear air
// above every takeoff). The player walks to a platform edge (dx ~100 to the
// next lane, under the 150 jump trigger) and arcs onto the offset platform.
const LANES = [320, 480, 640], W = 120, HOP = 90;
const lane = (i) => LANES[Math.max(0, Math.min(2, i))];

// Build one level from a compact spec. steps[] each push the climb up by one
// platform; mechanic steps consume extra height. Returns a Studio Level object.
function build(spec) {
  const T = 40;
  const platforms = [], chain = [], coins = [], enemies = [], updrafts = [], gusts = [], springs = [], contraptions = [];
  // height is COMPUTED from the climb so the summit always lands near the top:
  //   base headroom (200) + Σ rises + summit headroom (200).
  const climb = spec.steps.reduce((a, st) => a + (typeof st === 'object' && st.t === 'updraft' ? (st.rise || 380) : typeof st === 'object' && st.t === 'spring' ? (st.rise || 250) : HOP), 0);
  const height = 200 + climb + 200;
  let y = height - 60;                       // base platform top
  let li = spec.startLane != null ? spec.startLane : 1;
  // base
  platforms.push({ x: lane(li) - 120, y, w: 240, mat: 'cloud' });
  chain.push({ x: lane(li), y: y - 20 });
  const spawn = { x: lane(li), y: y - 120 };

  let enemyBudget = spec.enemies || 0;
  const place = (cx, ny, mat, w) => { platforms.push({ x: cx - (w || W) / 2, y: ny, w: w || W, mat: mat || 'cloud' }); };
  const wp = (cx, ny) => chain.push({ x: cx, y: ny - 20 });
  const coinArc = (cx, ny) => coins.push({ x: cx, y: ny - 55 });

  // lane walk: step ±1 from the current lane (bounce off the edges), so every
  // normal hop is dx 160 between adjacent lanes — reachable + offset.
  let dir = li === 0 ? 1 : -1;
  const nextLane = () => { if (li + dir > 2 || li + dir < 0) dir = -dir; li += dir; return lane(li); };
  const farLane = () => (li <= 1 ? li + 1 : li - 1);   // adjacent lane for mechanic exits

  for (let s = 0; s < spec.steps.length; s++) {
    const step = spec.steps[s];
    if (typeof step === 'object' && step.t === 'updraft') {
      // ALWAYS the verified-reliable config: a center column (lane 1, x480) with
      // the exit on the RIGHT (lane 2, x640). If we're not already at center,
      // hop to it first so the column entry is always lane 1.
      if (li !== 1) { y -= HOP; place(480, y, 'cloud'); wp(480, y); coinArc(480, y); li = 1; }
      const colX = 480, exitX = 640;
      const rise = step.rise || 380;
      const topY = y - rise;
      updrafts.push({ x: colX, w: 150, y0: topY - 120, y1: y + 10, maxRise: 260 });
      place(exitX, topY, 'crystal', 200);              // WIDE offset exit ledge (right)
      wp(exitX, topY);
      for (let k = 1; k <= 3; k++) coins.push({ x: colX, y: y - Math.round(rise * k / 4) });
      li = 2; dir = -1; y = topY;
    } else if (typeof step === 'object' && step.t === 'spring') {
      const springX = lane(li);
      const landLane = farLane(), landX = lane(landLane);
      const rise = step.rise || 250;
      const topY = y - rise;
      springs.push({ x: springX, y: y - 9, vel: 900 });
      place(landX, topY, 'cloud');
      wp(landX, topY);                                 // bounce → offset landing (clear air above spring)
      coins.push({ x: springX, y: y - Math.round(rise * 0.5) });
      coins.push({ x: Math.round((springX + landX) / 2), y: topY - 30 });
      li = landLane; y = topY;
    } else {
      const cx = nextLane();
      y -= HOP;
      const mat = (step && step.mat) || (typeof step === 'string' && step !== 'hop' ? step : 'cloud');
      place(cx, y, mat);
      wp(cx, y);
      coinArc(cx, y);
      if (step && step.gust) {
        // crosswind FLAIR over a safe path. The landing (this hop's platform, at
        // its offset lane cx) is widened to 240 and the wind always blows TOWARD
        // CENTRE (cx>480 → left, else right) so it can never shove the player off
        // the OUTER edge. The autopilot waits for the gust's lull to hop on
        // (gust-aware), so the deterministic gate progresses; a human leans in.
        const land = platforms[platforms.length - 1];
        land.w = 240; land.x = cx - 120;
        const inward = cx > 480 ? -1 : 1;
        gusts.push({ x: cx, y: y + 26, w: 200, h: 110, dir: inward, period: 3.0, duty: 0.4, push: 180 });
      }
      if (step && step.storm) {
        // atmospheric STORM walls boxing the tower at the far edges — deadly, but
        // ≥ 90px clear of every lane (the route never touches them; falling does).
        platforms.push({ x: 70, y: y + 6, w: 120, mat: 'storm' });
        platforms.push({ x: 770, y: y + 6, w: 120, mat: 'storm' });
      }
      if (enemyBudget > 0 && s >= 2 && (s % 3 === 0)) { enemies.push({ x: cx, y: y - 14, patrol: 24 }); enemyBudget--; }
    }
  }
  // summit = last platform; ensure goal near top
  const top = chain[chain.length - 1];
  return {
    name: spec.name, tile: T, vertical: true,
    width: 960, height, groundY: height - 40, sky: spec.sky, bgTint: spec.bgTint,
    spawn, goalY: top.y,
    platforms, chain, updrafts, gusts, springs, contraptions, enemies, coins,
  };
}

// Clean zig-zag spines + the reliable centre-column updraft (the signature sky
// verb) + decorative storm walls. Mechanics kept to the verified-green set;
// richness can grow later via the notes-loop (dogfooding the feedback brick).
// Clean staggered zig-zag spines — the reliably-completable core — with cloud /
// mist / crystal material variety, a signature centre-column UPDRAFT per level
// (the verified-green config), storm-wall framing, and patrolling storm-imps.
// Each tower: a varied climb (cloud→mist→crystal material beats) with a STORM
// section mid-tower and the signature centre-column UPDRAFT as the late climax
// (~80% up) — building the rising interest arc the Feel model rewards, while
// staying deterministic + 0-death (enemies removed; updraft in its verified
// centre→right config). introduce → develop → twist → master.
const LEVELS = [
  build({ name: 'Foothill Puffs', height: 1500, sky: 0x8fb4e4, bgTint: 0xffffff, enemies: 0,
    steps: ['hop', 'mist', 'hop', 'crystal', 'hop', 'mist', { t: 'updraft', rise: 300 }, 'hop'] }),
  build({ name: 'Whisperdraft', height: 1700, sky: 0x8fb0e0, bgTint: 0xfff2e2, enemies: 0,
    steps: ['hop', 'mist', 'crystal', 'hop', 'mist', 'hop', 'crystal', { t: 'updraft', rise: 340 }, 'hop'] }),
  build({ name: 'Mistspire', height: 1800, sky: 0x88a8d8, bgTint: 0xe8f0ff, enemies: 0,
    steps: ['hop', 'mist', { mat: 'cloud', storm: 1 }, 'crystal', 'hop', 'mist', 'crystal', { t: 'updraft', rise: 340 }, 'hop'] }),
  build({ name: 'Stormshelf Pass', height: 1900, sky: 0x7890c0, bgTint: 0xd8d2ee, enemies: 0,
    steps: ['hop', 'crystal', { mat: 'cloud', storm: 1 }, 'mist', 'hop', { mat: 'cloud', storm: 1 }, 'crystal', { t: 'updraft', rise: 340 }, 'hop'] }),
  build({ name: 'The Sun Bell', height: 2000, sky: 0x88a0d0, bgTint: 0xffe9c8, enemies: 0,
    steps: ['hop', 'mist', 'crystal', { mat: 'cloud', storm: 1 }, 'hop', 'mist', 'crystal', { t: 'updraft', rise: 360 }, 'hop'] }),
];

const banner = `/* Nimbus Climb — GENERATED by tools/level-gen/sky.mjs (vertical archetype).\n * Reachable-by-construction: staggered lanes (clear air above takeoffs),\n * rises < full-jump, springs/updrafts with offset exits. Re-run the generator\n * to regenerate; tune via the steps[] specs there. */\n`;
fs.writeFileSync(OUT, banner + 'window.LEVELS = ' + JSON.stringify(LEVELS, null, 2) + ';\n');
console.log('wrote', path.relative(path.resolve(HERE, '..', '..'), OUT), '—', LEVELS.length, 'levels');
for (const L of LEVELS) console.log('  ' + L.name + ': ' + L.platforms.length + ' platforms, ' + L.chain.length + ' waypoints, top y=' + L.chain[L.chain.length - 1].y);
