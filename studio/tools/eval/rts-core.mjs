/*
 * rts-core — the shared pure-Node (Iso)RTS simulator + AI PLAYSTYLES, the building
 * block under every RTS eval (strategy-sweep, balancer, and any future one). It is a
 * faithful port of Studio.(Iso)RTS combat + economy, consuming the SAME systematic
 * schedule as the engine (effectiveSchedule). One sim, many evals.
 */
import { effectiveSchedule } from './pressure.mjs';

export const FORT_Y = 64, GAR_Y = 492, BAND = 0.22;
export const UNIT = {
  scout:   { cost: 20, hp: 42,  dmg: 6,  range: 38,  speed: 96, cd: 0.5,  r: 17 },
  brawler: { cost: 46, hp: 130, dmg: 13, range: 42,  speed: 60, cd: 0.7,  r: 20 },
  gunner:  { cost: 36, hp: 54,  dmg: 9,  range: 140, speed: 74, cd: 0.55, r: 17 },
  warlord: { cost: 999, hp: 620, dmg: 22, range: 46, speed: 42, cd: 0.9, r: 32 }
};
export const REFINERY = { cost: 55, bonus: 7, max: 4 };
export const tuned = (s, t) => { const u = UNIT[t], o = (s.tune || {})[t] || {}; return { cost: o.cost || u.cost, hp: o.hp || u.hp, dmg: o.dmg || u.dmg, range: u.range, speed: u.speed, cd: u.cd, r: u.r }; };
const evLx = (e) => (e.lx != null ? e.lx : (e.lane != null ? [-0.6, 0, 0.6][e.lane] : 0));
// a game is in LANE mode (rally is a lane index 0/1/2) or LX mode (rally is a lateral
// lx ∈ [-1,1]); disambiguate from the schedule so rally maps to the right spot.
const laneMode = (s) => (s.schedule || []).some((e) => e.lane != null) && !(s.schedule || []).some((e) => e.lx != null);
export const rallyLx = (s) => (s.rally == null ? 0 : laneMode(s) ? ([-0.6, 0, 0.6][s.rally] ?? 0) : s.rally);

// the AI PLAYSTYLES the evals sweep. Each → { econ, picks: [[type, lx], …] }.
export const STYLES = {
  'brawler-ball': (s) => ({ econ: s.autoEcon || 0, picks: [['brawler', rallyLx(s)]] }),
  'scout-swarm':  (s) => ({ econ: 0, picks: [['scout', rallyLx(s)]] }),
  'gunner-line':  (s) => ({ econ: 0, picks: [['gunner', rallyLx(s)]] }),
  'eco-boom':     (s) => ({ econ: 4, picks: [['brawler', rallyLx(s)]] }),
  'no-eco':       (s) => ({ econ: 0, picks: [['brawler', rallyLx(s)]] }),
  'mixed-arms':   (s) => ({ econ: s.autoEcon || 0, picks: [['brawler', rallyLx(s)], ['gunner', rallyLx(s)], ['scout', rallyLx(s)]] }),
  'spread-front': (s) => ({ econ: s.autoEcon || 0, picks: [['brawler', -0.6], ['brawler', 0], ['brawler', 0.6]] })
};

// run one level under one playstyle → outcome (won/lost, time, garage tension, peak).
export function runStyle(spec, style, maxFrames = 22000) {
  let units = [], uid = 0, depots = 0, scrap = spec.startScrap != null ? spec.startScrap : 40;
  const mode = (spec.schedule || []).some((e) => e.lx != null) ? 'lx' : 'lane';
  const income = spec.income || 12, dt = 1 / 60, sched = effectiveSchedule(spec, mode);
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

// the tension profile of a level. `tension` = the CANONICAL experience (the
// brawler-ball autopilot's garage loss — clean & monotonic in difficulty, what the
// balancer targets). `worst` = the closest any winning style came (a near-loss flag).
// `diversity` = how many of the playstyles win (meaningful choices, Schell #32).
export function tensionOf(spec) {
  const garage = spec.garageHp || 1000;
  const rows = Object.keys(STYLES).map((n) => ({ n, r: runStyle(spec, STYLES[n]) }));
  const winners = rows.filter((x) => x.r.won);
  const auto = rows.find((x) => x.n === 'brawler-ball').r;
  const autoTension = auto.won ? +(1 - auto.minG / garage).toFixed(3) : 1;
  return { rows, winners, garage, diversity: winners.length / rows.length, autoWon: auto.won, tension: autoTension, worst: winners.length ? +(1 - Math.min(...winners.map((w) => w.r.minG)) / garage).toFixed(3) : 1 };
}
