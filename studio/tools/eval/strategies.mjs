/*
 * strategies — a DIFFERENT kind of level eval. The 0-death gate asks one yes/no
 * question of ONE optimal strategy. This asks the richer ones: is the level a
 * STOMP or a nail-biter? Does it reward MORE THAN ONE strategy (meaningful
 * choices, Schell #32) or only the deathball? How much skill HEADROOM is there?
 *
 * It runs a faithful Studio.(Iso)RTS sim under several AI PLAYSTYLES (brawler-ball,
 * scout-swarm, gunner-line, eco-boom, no-eco, mixed-arms, spread-front) and reports
 * per level: which playstyles win, time-to-win, the closest the garage came (tension),
 * peak army — then a per-level CHALLENGE profile + strategic DIVERSITY, and a
 * campaign summary. Deterministic, pure-Node, milliseconds. Advisory (exits 0).
 *
 *   node tools/eval/strategies.mjs games/roadwar-iso
 */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const arg = process.argv[2] || 'games/roadwar-iso';
const GAME = path.isAbsolute(arg) ? arg : path.join(STUDIO, arg.replace(/^studio\//, ''));
const sb = { window: {} }; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(GAME, 'src/game/levels.js'), 'utf8'), sb);
const LEVELS = sb.window.LEVELS || [];

const FORT_Y = 64, GAR_Y = 492, BAND = 0.22;
const UNIT = {
  scout:   { cost: 20, hp: 42,  dmg: 6,  range: 38,  speed: 96, cd: 0.5,  r: 17 },
  brawler: { cost: 46, hp: 130, dmg: 13, range: 42,  speed: 60, cd: 0.7,  r: 20 },
  gunner:  { cost: 36, hp: 54,  dmg: 9,  range: 140, speed: 74, cd: 0.55, r: 17 },
  warlord: { cost: 999, hp: 620, dmg: 22, range: 46, speed: 42, cd: 0.9, r: 32 }
};
const REFINERY = { cost: 55, bonus: 7, max: 4 };
const tuned = (s, t) => { const u = UNIT[t], o = (s.tune || {})[t] || {}; return { cost: o.cost || u.cost, hp: o.hp || u.hp, dmg: o.dmg || u.dmg, range: u.range, speed: u.speed, cd: u.cd, r: u.r }; };
// a schedule entry's lateral spot (iso lx, or lane mapped to lx)
const evLx = (e) => (e.lx != null ? e.lx : (e.lane != null ? [-0.6, 0, 0.6][e.lane] : 0));
const rallyLx = (s) => (s.rally != null ? (typeof s.rally === 'number' && Math.abs(s.rally) <= 1 ? s.rally : [-0.6, 0, 0.6][s.rally] || 0) : 0);

// PLAYSTYLES — each decides what to build this frame given (scrap, depots, frame).
// Returns a list of build actions {type, lx}. The sim spends scrap in order.
const STYLES = {
  'brawler-ball': (s) => ({ econ: s.autoEcon || 0, picks: [['brawler', rallyLx(s)]] }),
  'scout-swarm':  (s) => ({ econ: 0, picks: [['scout', rallyLx(s)]] }),
  'gunner-line':  (s) => ({ econ: 0, picks: [['gunner', rallyLx(s)]] }),
  'eco-boom':     (s) => ({ econ: 4, picks: [['brawler', rallyLx(s)]] }),
  'no-eco':       (s) => ({ econ: 0, picks: [['brawler', rallyLx(s)]] }),
  'mixed-arms':   (s) => ({ econ: s.autoEcon || 0, picks: [['brawler', rallyLx(s)], ['gunner', rallyLx(s)], ['scout', rallyLx(s)]] }),
  'spread-front': (s) => ({ econ: s.autoEcon || 0, picks: [['brawler', -0.6], ['brawler', 0], ['brawler', 0.6]] })
};

function runStyle(spec, style, maxFrames) {
  let units = [], uid = 0, depots = 0, scrap = spec.startScrap != null ? spec.startScrap : 40;
  const income = spec.income || 12, dt = 1 / 60, sched = spec.schedule || [];
  let garageHp = spec.garageHp || 1000, fortressHp = spec.fortressHp || 1000, clock = 0, frame = 0, si = 0, gCd = 0, fCd = 0, pickRot = 0;
  const curIncome = () => income + depots * REFINERY.bonus;
  const plan = style(spec);
  function spawn(side, type, lx) { const st = tuned(spec, type); units.push({ id: uid++, side, type, lx, y: side === 'p' ? GAR_Y - 18 : FORT_Y + 18, hp: st.hp, dmg: st.dmg, range: st.range, speed: st.speed, cd: 0, atkCd: st.cd, r: st.r, alive: true }); }
  function buy(side, type, lx) { if (type === 'depot') { if (depots >= REFINERY.max || scrap < REFINERY.cost) return false; scrap -= REFINERY.cost; depots++; return true; } if (side === 'p') { const c = tuned(spec, type).cost; if (scrap < c) return false; scrap -= c; } spawn(side, type, lx); return true; }
  function nearestAhead(u) { const foe = u.side === 'p' ? 'e' : 'p'; let best = null, bd = 1e9; for (const o of units) { if (!o.alive || o.side !== foe || Math.abs(o.lx - u.lx) > BAND) continue; const ahead = u.side === 'p' ? (o.y < u.y) : (o.y > u.y); if (!ahead) continue; const d = Math.abs(o.y - u.y); if (d < bd) { bd = d; best = o; } } return best ? { o: best, d: bd } : null; }
  function nearApproach(side, hqY, range) { let best = null, bd = range || 150; for (const u of units) { if (!u.alive || u.side !== side) continue; const d = Math.abs(u.y - hqY); if (d < bd) { bd = d; best = u; } } return best; }
  function tick() {
    scrap += curIncome() * dt;
    for (const u of units) { if (!u.alive) continue; u.cd -= dt; const ne = nearestAhead(u), dir = u.side === 'p' ? -1 : 1, hqY = u.side === 'p' ? FORT_Y : GAR_Y, hqDist = Math.abs(u.y - hqY);
      if (ne && ne.d <= Math.max(u.range, u.r + 10)) { const want = u.range > 80 ? u.range - 6 : (u.r + ne.o.r + 4); if (ne.d > want + 4) u.y += dir * u.speed * dt; if (u.cd <= 0) { ne.o.hp -= u.dmg; u.cd = u.atkCd; } }
      else if (hqDist <= u.range + 6 && (!ne || ne.d > u.range)) { if (u.cd <= 0) { if (u.side === 'p') fortressHp -= u.dmg; else garageHp -= u.dmg; u.cd = u.atkCd; } }
      else u.y += dir * u.speed * dt;
      if (u.hp <= 0) u.alive = false; }
    gCd -= dt; fCd -= dt;
    const gT = nearApproach('e', GAR_Y, spec.garageTurret ? spec.garageTurret.range : 150); if (gT && gCd <= 0) { gCd = 0.6; gT.hp -= (spec.garageTurret ? spec.garageTurret.dmg : 14); }
    const fT = nearApproach('p', FORT_Y, spec.fortressTurret ? spec.fortressTurret.range : 160); if (fT && fCd <= 0) { fCd = 0.55; fT.hp -= (spec.fortressTurret ? spec.fortressTurret.dmg : 16); }
    while (si < sched.length && clock >= sched[si].t) { const ev = sched[si]; buy('e', ev.type, evLx(ev)); si++; }
  }
  let minG = garageHp, peakP = 0;
  while (fortressHp > 0 && garageHp > 0 && frame < maxFrames) {
    frame++; clock += dt;
    let eg = 0; while (depots < plan.econ && scrap >= REFINERY.cost && eg < 2) { buy('p', 'depot', 0); eg++; }
    let g = 0; while (g < 4) { const pk = plan.picks[pickRot % plan.picks.length]; if (scrap < tuned(spec, pk[0]).cost) break; buy('p', pk[0], pk[1]); pickRot++; g++; }
    tick();
    if (garageHp < minG) minG = garageHp;
    const lp = units.filter(u => u.alive && u.side === 'p').length; if (lp > peakP) peakP = lp;
  }
  return { won: fortressHp <= 0 && garageHp > 0, lost: garageHp <= 0, t: +(frame / 60).toFixed(1), minG: Math.round(minG), garageHp: Math.round(garageHp), fortressHp: Math.round(fortressHp), peakP, frame };
}

const styleNames = Object.keys(STYLES);
console.log(`\n🎲 Strategy-sweep eval — ${path.basename(GAME)}   ·   ${styleNames.length} playstyles × ${LEVELS.length} grounds (deterministic)`);
let campViable = 0, campTension = [];
LEVELS.forEach((spec, i) => {
  const garage = spec.garageHp || 1000;
  const rows = styleNames.map((n) => ({ n, r: runStyle(spec, STYLES[n], 22000) }));
  const winners = rows.filter((x) => x.r.won);
  const diversity = winners.length / styleNames.length;
  // tension = how close the garage came among WINNING styles (0 = stomp, 1 = near-death)
  const tension = winners.length ? +(1 - Math.min(...winners.map((w) => w.r.minG)) / garage).toFixed(2) : 0;
  const label = winners.length === 0 ? 'UNFAIR (no style wins)' : tension < 0.06 ? 'STOMP (too easy)' : tension < 0.4 ? 'comfortable' : tension < 0.75 ? 'TENSE (good)' : 'BRUTAL (near-loss)';
  campViable += diversity; campTension.push(tension);
  console.log(`\n  G${i + 1} ${spec.name}  —  ${winners.length}/${styleNames.length} styles win · diversity ${(diversity * 100) | 0}% · tension ${tension} → ${label}`);
  rows.sort((a, b) => (a.r.won === b.r.won ? a.r.t - b.r.t : a.r.won ? -1 : 1)).forEach(({ n, r }) => {
    const tag = r.won ? '✅ win ' : r.lost ? '💥 LOSE' : '⏳ time';
    console.log(`     ${tag}  ${n.padEnd(13)} t=${String(r.t).padStart(5)}s  garage-left ${String(r.won ? r.garageHp : r.minG).padStart(5)}  closest ${String(r.minG).padStart(5)}/${garage}  peak ${r.peakP}`);
  });
});
const meanDiv = +(campViable / LEVELS.length * 100).toFixed(0), meanTen = +(campTension.reduce((a, b) => a + b, 0) / LEVELS.length).toFixed(2);
console.log(`\n  campaign — strategic diversity ${meanDiv}% (how many playstyles are viable; higher = more meaningful choices)`);
console.log(`           — mean tension ${meanTen} (0 stomp · ~0.5 tense · 1 near-loss). A good campaign rises in tension to the finale.`);
console.log(`           — per-ground tension curve: [${campTension.join(' → ')}]\n`);
process.exit(0);
