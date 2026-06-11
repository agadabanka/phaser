/*
 * sim.mjs — faithful pure-Node port of Studio.IsoRTS combat + autopilot, to tune
 * the iso campaign deterministically before the browser gate. Same as the RTS sim
 * but lanes → a CONTINUOUS lx with a lateral engage BAND (the only spatial change).
 *   node sim.mjs
 */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { effectiveSchedule } from '../../tools/eval/pressure.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sb = { window: {} }; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(HERE, 'src/game/levels.js'), 'utf8'), sb);
const LEVELS = sb.window.LEVELS;

const FORT_Y = 64, GAR_Y = 492, BAND = 0.22;
const UNIT = {
  scout:   { cost: 20, hp: 42,  dmg: 6,  range: 38,  speed: 96, cd: 0.5,  r: 17 },
  brawler: { cost: 46, hp: 130, dmg: 13, range: 42,  speed: 60, cd: 0.7,  r: 20 },
  gunner:  { cost: 36, hp: 54,  dmg: 9,  range: 140, speed: 74, cd: 0.55, r: 17 },
  warlord: { cost: 999, hp: 620, dmg: 22, range: 46, speed: 42, cd: 0.9, r: 32 }
};
const REFINERY = { cost: 55, bonus: 7, max: 4 };
const tuned = (s, t) => { const u = UNIT[t], o = (s.tune || {})[t] || {}; return { cost: o.cost || u.cost, hp: o.hp || u.hp, dmg: o.dmg || u.dmg, range: u.range, speed: u.speed, cd: u.cd, r: u.r }; };

function runLevel(spec, maxFrames) {
  let units = [], uid = 0, depots = 0, scrap = spec.startScrap != null ? spec.startScrap : 40;
  const income = spec.income || 12, dt = 1 / 60, sched = effectiveSchedule(spec, 'lx');
  const rl = spec.rally != null ? spec.rally : 0, bt = spec.autoBuild || 'brawler';
  let garageHp = spec.garageHp || 1000, fortressHp = spec.fortressHp || 1000, clock = 0, frame = 0, schedIdx = 0, gCd = 0, fCd = 0;
  const curIncome = () => income + depots * REFINERY.bonus;
  function spawn(side, type, lx) { const st = tuned(spec, type); units.push({ id: uid++, side, type, lx, y: side === 'p' ? GAR_Y - 18 : FORT_Y + 18, hp: st.hp, dmg: st.dmg, range: st.range, speed: st.speed, cd: 0, atkCd: st.cd, r: st.r, alive: true }); }
  function build(side, type, lx) { if (type === 'depot') { if (depots >= REFINERY.max || scrap < REFINERY.cost) return false; scrap -= REFINERY.cost; depots++; return true; } if (side === 'p') { const c = tuned(spec, type).cost; if (scrap < c) return false; scrap -= c; } spawn(side, type, lx); return true; }
  function nearestAhead(u) { const foe = u.side === 'p' ? 'e' : 'p'; let best = null, bd = 1e9; for (const o of units) { if (!o.alive || o.side !== foe || Math.abs(o.lx - u.lx) > BAND) continue; const ahead = u.side === 'p' ? (o.y < u.y) : (o.y > u.y); if (!ahead) continue; const d = Math.abs(o.y - u.y); if (d < bd) { bd = d; best = o; } } return best ? { o: best, d: bd } : null; }
  function nearApproach(side, hqY, range) { let best = null, bd = range || 150; for (const u of units) { if (!u.alive || u.side !== side) continue; const d = Math.abs(u.y - hqY); if (d < bd) { bd = d; best = u; } } return best; }
  function tick() {
    scrap += curIncome() * dt;
    for (const u of units) {
      if (!u.alive) continue; u.cd -= dt;
      const ne = nearestAhead(u), dir = u.side === 'p' ? -1 : 1, hqY = u.side === 'p' ? FORT_Y : GAR_Y, hqDist = Math.abs(u.y - hqY);
      if (ne && ne.d <= Math.max(u.range, u.r + 10)) { const want = u.range > 80 ? u.range - 6 : (u.r + ne.o.r + 4); if (ne.d > want + 4) u.y += dir * u.speed * dt; if (u.cd <= 0) { ne.o.hp -= u.dmg; u.cd = u.atkCd; } }
      else if (hqDist <= u.range + 6 && (!ne || ne.d > u.range)) { if (u.cd <= 0) { if (u.side === 'p') fortressHp -= u.dmg; else garageHp -= u.dmg; u.cd = u.atkCd; } }
      else u.y += dir * u.speed * dt;
      if (u.hp <= 0) u.alive = false;
    }
    gCd -= dt; fCd -= dt;
    const gT = nearApproach('e', GAR_Y, spec.garageTurret ? spec.garageTurret.range : 150); if (gT && gCd <= 0) { gCd = 0.6; gT.hp -= (spec.garageTurret ? spec.garageTurret.dmg : 14); }
    const fT = nearApproach('p', FORT_Y, spec.fortressTurret ? spec.fortressTurret.range : 160); if (fT && fCd <= 0) { fCd = 0.55; fT.hp -= (spec.fortressTurret ? spec.fortressTurret.dmg : 16); }
    while (schedIdx < sched.length && clock >= sched[schedIdx].t) { const ev = sched[schedIdx]; build('e', ev.type, ev.lx != null ? ev.lx : 0); schedIdx++; }
  }
  let minG = garageHp, peakP = 0, peakE = 0, bossSeen = false;
  while (fortressHp > 0 && garageHp > 0 && frame < maxFrames) {
    frame++; clock += dt;
    const econ = spec.autoEcon || 0; let eg = 0; while (depots < econ && scrap >= REFINERY.cost && eg < 2) { build('p', 'depot', rl); eg++; }
    let g = 0; while (scrap >= tuned(spec, bt).cost && g < 4) { build('p', bt, rl); g++; }
    tick();
    if (units.some(u => u.type === 'warlord')) bossSeen = true;
    if (garageHp < minG) minG = garageHp;
    const lp = units.filter(u => u.alive && u.side === 'p').length, le = units.filter(u => u.alive && u.side === 'e').length;
    if (lp > peakP) peakP = lp; if (le > peakE) peakE = le;
  }
  const hasBoss = sched.some(e => e.type === 'warlord');
  return { won: fortressHp <= 0, lost: garageHp <= 0, frame, t: +(frame / 60).toFixed(1), fortressHp: Math.round(fortressHp), garageHp: Math.round(garageHp), minG: Math.round(minG), peakP, peakE, hasBoss, bossSeen };
}

let all = true, total = 0;
LEVELS.forEach((spec, i) => {
  const r = runLevel(spec, 22000); total += r.frame;
  const v = r.won && !r.lost ? 'WIN ' : r.lost ? 'LOSE' : 'TIME'; if (!r.won || r.lost) all = false;
  const boss = r.hasBoss ? `  boss=${r.bossSeen ? 'fought✓' : 'NEVER✗'}` : '';
  console.log(`G${i + 1} ${(spec.name + '').padEnd(16)} ${v}  t=${String(r.t).padStart(5)}s  fort=${String(r.fortressHp).padStart(5)}  garage=${String(r.garageHp).padStart(5)}  minG=${String(r.minG).padStart(5)}  peakP=${r.peakP} peakE=${r.peakE}${boss}`);
});
console.log(`\n${all ? '✅ ALL 5 GROUNDS WON' : '❌ NOT ALL WON'}  ·  total frames ${total} (gate budget 22000)`);
process.exit(all ? 0 : 1);
