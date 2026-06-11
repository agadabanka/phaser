/*
 * sim.mjs — a FAITHFUL pure-Node port of Studio.RTS tickWorld + the all-in-rally
 * autopilot, so we can tune the economy deterministically in milliseconds before
 * paying for the browser gate. Mirrors the SDK math exactly (dt=1/60, id-order
 * iteration, same tie-breaks) — what wins here wins in the real gate.
 *   node sim.mjs            # trace all 5 grounds
 *   node sim.mjs --quiet    # one-line verdict per ground
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(HERE, 'src/game/levels.js'), 'utf8'), sandbox);
const LEVELS = sandbox.window.LEVELS;

const LANES = [260, 480, 700], GAR_Y = 492, FORT_Y = 64;
const UNIT = {
  scout:   { cost: 20, hp: 42,  dmg: 6,  range: 38,  speed: 96, cd: 0.5,  r: 17 },
  brawler: { cost: 46, hp: 130, dmg: 13, range: 42,  speed: 60, cd: 0.7,  r: 20 },
  gunner:  { cost: 36, hp: 54,  dmg: 9,  range: 140, speed: 74, cd: 0.55, r: 17 },
  warlord: { cost: 999, hp: 620, dmg: 22, range: 46, speed: 42, cd: 0.9, r: 32 }
};
const QUIET = process.argv.includes('--quiet');

function tuned(spec, type) {
  const u = UNIT[type], t = (spec.tune || {})[type] || {};
  return { cost: t.cost || u.cost, hp: t.hp || u.hp, dmg: t.dmg || u.dmg, range: u.range, speed: u.speed, cd: u.cd, r: u.r };
}

function runLevel(spec, maxFrames) {
  let units = [], uid = 0;
  let scrap = spec.startScrap != null ? spec.startScrap : 40;
  const income = spec.income || 12;
  let garageHp = spec.garageHp || 1000, fortressHp = spec.fortressHp || 1000;
  let clock = 0, frame = 0, schedIdx = 0, gTurretCd = 0, fTurretCd = 0;
  const dt = 1 / 60;
  const rl = spec.rally != null ? spec.rally : 1, bt = spec.autoBuild || 'brawler';
  const sched = spec.schedule || [];

  function spawnUnit(side, type, lane) {
    const st = tuned(spec, type);
    const y = side === 'p' ? GAR_Y - 20 : FORT_Y + 20;
    units.push({ id: uid++, side, type, lane, x: LANES[lane], y, hp: st.hp, maxHp: st.hp, dmg: st.dmg, range: st.range, speed: st.speed, cd: 0, atkCd: st.cd, r: st.r, alive: true });
  }
  function build(side, type, lane) {
    if (side === 'p') { const c = tuned(spec, type).cost; if (scrap < c) return false; scrap -= c; }
    spawnUnit(side, type, lane); return true;
  }
  function nearestEnemyAhead(u) {
    const foe = u.side === 'p' ? 'e' : 'p'; let best = null, bd = 1e9;
    for (const o of units) { if (!o.alive || o.side !== foe || o.lane !== u.lane) continue; const ahead = u.side === 'p' ? (o.y < u.y) : (o.y > u.y); if (!ahead) continue; const d = Math.abs(o.y - u.y); if (d < bd) { bd = d; best = o; } }
    return best ? { o: best, d: bd } : null;
  }
  function nearestApproaching(side, hqY, range) {
    let best = null, bd = range || 150;
    for (const u of units) { if (!u.alive || u.side !== side) continue; const d = Math.abs(u.y - hqY); if (d < bd) { bd = d; best = u; } }
    return best;
  }
  function tickWorld() {
    scrap += income * dt;
    for (const u of units) {
      if (!u.alive) continue;
      u.cd -= dt;
      const ne = nearestEnemyAhead(u);
      const dir = u.side === 'p' ? -1 : 1;
      const hqY = u.side === 'p' ? FORT_Y : GAR_Y, hqDist = Math.abs(u.y - hqY);
      if (ne && ne.d <= Math.max(u.range, u.r + 10)) {
        const want = u.range > 80 ? u.range - 6 : (u.r + ne.o.r + 4);
        if (ne.d > want + 4) u.y += dir * u.speed * dt;
        if (u.cd <= 0) { ne.o.hp -= u.dmg; u.cd = u.atkCd; }
      } else if (hqDist <= u.range + 6 && (!ne || ne.d > u.range)) {
        if (u.cd <= 0) { if (u.side === 'p') fortressHp -= u.dmg; else garageHp -= u.dmg; u.cd = u.atkCd; }
      } else {
        u.y += dir * u.speed * dt;
      }
      if (u.hp <= 0) u.alive = false;
    }
    gTurretCd -= dt; fTurretCd -= dt;
    const gT = nearestApproaching('e', GAR_Y, spec.garageTurret ? spec.garageTurret.range : 150);
    if (gT && gTurretCd <= 0) { gTurretCd = 0.6; gT.hp -= (spec.garageTurret ? spec.garageTurret.dmg : 14); }
    const fT = nearestApproaching('p', FORT_Y, spec.fortressTurret ? spec.fortressTurret.range : 160);
    if (fT && fTurretCd <= 0) { fTurretCd = 0.55; fT.hp -= (spec.fortressTurret ? spec.fortressTurret.dmg : 16); }
    while (schedIdx < sched.length && clock >= sched[schedIdx].t) { const ev = sched[schedIdx]; build('e', ev.type, ev.lane != null ? ev.lane : 1); schedIdx++; }
  }

  let minGarage = garageHp, maxLiveP = 0, maxLiveE = 0, bossSeen = false, bossAliveAtWin = false;
  while (fortressHp > 0 && garageHp > 0 && frame < maxFrames) {
    frame++; clock += dt;
    // autopilot
    let guard = 0;
    while (scrap >= tuned(spec, bt).cost && guard < 4) { build('p', bt, rl); guard++; }
    tickWorld();
    if (units.some(u => u.type === 'warlord')) bossSeen = true;
    if (garageHp < minGarage) minGarage = garageHp;
    const lp = units.filter(u => u.alive && u.side === 'p').length, le = units.filter(u => u.alive && u.side === 'e').length;
    if (lp > maxLiveP) maxLiveP = lp; if (le > maxLiveE) maxLiveE = le;
  }
  const hasBoss = sched.some(e => e.type === 'warlord');
  if (hasBoss) bossAliveAtWin = units.some(u => u.type === 'warlord' && u.alive);
  return { won: fortressHp <= 0, lost: garageHp <= 0, frame, t: +(frame / 60).toFixed(1), fortressHp: Math.round(fortressHp), garageHp: Math.round(garageHp), minGarage: Math.round(minGarage), maxLiveP, maxLiveE, hasBoss, bossSeen, bossAliveAtWin };
}

let allWon = true, totalFrames = 0;
LEVELS.forEach((spec, i) => {
  const r = runLevel(spec, 22000);
  totalFrames += r.frame;
  const verdict = r.won && !r.lost ? 'WIN ' : r.lost ? 'LOSE' : 'TIME';
  if (!r.won || r.lost) allWon = false;
  const boss = r.hasBoss ? `  boss=${r.bossSeen ? (r.bossAliveAtWin ? 'ALIVE@win!' : 'fought✓') : 'NEVER-SPAWNED✗'}` : '';
  console.log(`G${i + 1} ${(spec.name + '').padEnd(16)} ${verdict}  t=${String(r.t).padStart(5)}s  fort=${String(r.fortressHp).padStart(5)}  garage=${String(r.garageHp).padStart(5)}  minGarage=${String(r.minGarage).padStart(5)}  peakP=${r.maxLiveP} peakE=${r.maxLiveE}${boss}`);
});
console.log(`\n${allWon ? '✅ ALL 5 GROUNDS WON' : '❌ NOT ALL WON'}  ·  total frames ${totalFrames} (gate budget 22000, ${(totalFrames / 60).toFixed(0)}s)`);
process.exit(allWon ? 0 : 1);
