/* Starlance — levels are data (the Studio shooter DSL). Five nebula veils, each
 * a sequence of WAVES. The deadly thing is the SWEEPING-GAP BULLET CURTAIN
 * (Studio.Shooter); formations are score targets that never fire or descend into
 * the ship band. The curtain constants satisfy the survivability bound
 * (sweepSpeed·fallTime < gapW/2 − shipHalf), so the autopilot rides the live gap
 * 0-death by construction. The fifth veil ends with the MOTHERSHIP boss, whom the
 * ship's constant auto-fire kills in fixed time while it dodges a denser curtain.
 *
 *   curtain: { amp, period(s), gapW, bulletSpeed, fireInterval(frames), columns }
 *     bound: amp·2π/period · (≈0.9s fall) < gapW/2 − 21.  Defaults below hold it.
 *   waves: [{ dur(s), formations:[{tex,count,x,gap,path,amp,holdY,hp}], boss? }]
 */
var CURTAIN_EASY = { amp: 150, period: 14, gapW: 220, bulletSpeed: 500, fireInterval: 46, columns: 10 };
var CURTAIN_MED  = { amp: 170, period: 13, gapW: 210, bulletSpeed: 520, fireInterval: 42, columns: 11 };
var CURTAIN_HARD = { amp: 175, period: 13, gapW: 205, bulletSpeed: 540, fireInterval: 38, columns: 12 };

window.LEVELS = [
  {
    name: 'Rose Veil', sky: 0x2a1430, curtain: CURTAIN_EASY,
    waves: [
      { dur: 7, formations: [{ tex: 'enemy_drone', count: 5, x: 480, gap: 80, path: 'sweep', amp: 90, holdY: 130, hp: 2 }] },
      { dur: 7, formations: [{ tex: 'enemy_drone', count: 4, x: 300, gap: 70, path: 'sweep', amp: 110, holdY: 160, hp: 2 }, { tex: 'enemy_drone', count: 4, x: 660, gap: 70, path: 'sweep', amp: 110, holdY: 160, hp: 2 }] },
      { dur: 6, formations: [{ tex: 'enemy_drone', count: 6, x: 480, gap: 90, path: 'sweep', amp: 130, holdY: 150, hp: 2 }] }
    ]
  },
  {
    name: 'Ion Veil', sky: 0x0c2a3a, curtain: CURTAIN_EASY,
    waves: [
      { dur: 7, formations: [{ tex: 'enemy_dart', count: 5, x: 480, gap: 90, path: 'sweep', amp: 140, holdY: 150, hp: 2 }] },
      { dur: 7, formations: [{ tex: 'enemy_drone', count: 4, x: 260, gap: 70, path: 'sweep', amp: 100, holdY: 150, hp: 2 }, { tex: 'enemy_dart', count: 4, x: 700, gap: 70, path: 'sweep', amp: 120, holdY: 170, hp: 2 }] },
      { dur: 7, formations: [{ tex: 'enemy_dart', count: 6, x: 480, gap: 95, path: 'sweep', amp: 150, holdY: 160, hp: 2 }] }
    ]
  },
  {
    name: 'Storm Veil', sky: 0x241038, curtain: CURTAIN_MED,
    waves: [
      { dur: 7, formations: [{ tex: 'enemy_turret', count: 4, x: 480, gap: 110, path: 'hold', holdY: 130, hp: 3 }] },
      { dur: 8, formations: [{ tex: 'enemy_dart', count: 5, x: 320, gap: 80, path: 'sweep', amp: 120, holdY: 150, hp: 2 }, { tex: 'enemy_drone', count: 5, x: 640, gap: 80, path: 'sweep', amp: 120, holdY: 170, hp: 2 }] },
      { dur: 7, formations: [{ tex: 'enemy_turret', count: 5, x: 480, gap: 120, path: 'hold', holdY: 150, hp: 3 }] }
    ]
  },
  {
    name: 'Void Rift', sky: 0x0a0820, curtain: CURTAIN_MED,
    waves: [
      { dur: 8, formations: [{ tex: 'enemy_dart', count: 6, x: 480, gap: 90, path: 'sweep', amp: 160, holdY: 150, hp: 2 }] },
      { dur: 8, formations: [{ tex: 'enemy_turret', count: 3, x: 240, gap: 110, path: 'hold', holdY: 130, hp: 3 }, { tex: 'enemy_turret', count: 3, x: 720, gap: 110, path: 'hold', holdY: 130, hp: 3 }] },
      { dur: 8, formations: [{ tex: 'enemy_dart', count: 4, x: 300, gap: 80, path: 'sweep', amp: 130, holdY: 160, hp: 2 }, { tex: 'enemy_dart', count: 4, x: 660, gap: 80, path: 'sweep', amp: 130, holdY: 160, hp: 2 }] }
    ]
  },
  {
    name: 'The Hollow Star', sky: 0x2a0410, curtain: CURTAIN_HARD,
    waves: [
      { dur: 7, formations: [{ tex: 'enemy_dart', count: 6, x: 480, gap: 90, path: 'sweep', amp: 150, holdY: 150, hp: 2 }] },
      { dur: 7, formations: [{ tex: 'enemy_turret', count: 5, x: 480, gap: 120, path: 'hold', holdY: 140, hp: 3 }] },
      { dur: 30, boss: true, formations: [] }   // MOTHERSHIP — auto-fire whittles it while the ship rides the gap
    ]
  }
];
window.STARLANCE_BOSS = { hp: 520, w: 540, h: 150 };
