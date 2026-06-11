/* Roadwar — levels are data (the Studio RTS DSL). Five grounds: a garage (you,
 * bottom) vs a warlord fortress (top) across 3 lanes. You spend SCRAP (auto-
 * income) to BUILD cars into a lane; cars drive up and brawl. Win = fortress
 * HP→0; lose = garage HP→0. Deterministic lane combat (Studio.RTS).
 *
 * WINNABLE-BY-CONSTRUCTION (rules.json "rts" bound): the autopilot goes ALL-IN
 * on `rally` lane with `autoBuild`. Its throughput (income / cost · dmg) must
 * out-DPS the enemy's per-lane defence (turret + schedule) so cars leak onto the
 * fortress before the garage falls. Escalating: more income + tougher schedules.
 *
 *   { name, sky, income, startScrap, garageHp, fortressHp, rally, autoBuild,
 *     garageTurret:{range,dmg}, fortressTurret:{range,dmg},
 *     schedule:[{t(s),type,lane}], tune:{type:{cost,hp,dmg}} }
 */
window.LEVELS = [
  {
    name: 'Desert Highway', sky: 0x3a2a16, income: 16, startScrap: 60, garageHp: 900, fortressHp: 760,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 150, dmg: 10 }, garageTurret: { range: 150, dmg: 12 },
    schedule: [
      { t: 1, type: 'scout', lane: 1 }, { t: 2, type: 'scout', lane: 1 },
      { t: 6, type: 'brawler', lane: 1 }, { t: 7, type: 'scout', lane: 0 },
      { t: 12, type: 'scout', lane: 1 }, { t: 13, type: 'brawler', lane: 1 },
      { t: 19, type: 'scout', lane: 2 }, { t: 20, type: 'brawler', lane: 1 }, { t: 21, type: 'scout', lane: 1 }
    ]
  },
  {
    name: 'The Junkyard', sky: 0x24281a, income: 18, startScrap: 60, garageHp: 980, fortressHp: 920,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 155, dmg: 12 }, garageTurret: { range: 158, dmg: 13 },
    schedule: [
      { t: 1, type: 'scout', lane: 1 }, { t: 2, type: 'brawler', lane: 1 },
      { t: 6, type: 'scout', lane: 0 }, { t: 7, type: 'scout', lane: 2 }, { t: 8, type: 'gunner', lane: 1 },
      { t: 13, type: 'brawler', lane: 1 }, { t: 14, type: 'scout', lane: 1 },
      { t: 20, type: 'brawler', lane: 1 }, { t: 21, type: 'gunner', lane: 1 }, { t: 22, type: 'scout', lane: 0 },
      { t: 28, type: 'brawler', lane: 1 }, { t: 29, type: 'scout', lane: 2 }, { t: 34, type: 'brawler', lane: 1 }
    ]
  },
  {
    name: 'Neon Strip', sky: 0x161038, income: 20, startScrap: 70, garageHp: 1020, fortressHp: 1120,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 160, dmg: 14 }, garageTurret: { range: 166, dmg: 14 },
    schedule: [
      { t: 1, type: 'brawler', lane: 1 }, { t: 2, type: 'scout', lane: 1 },
      { t: 6, type: 'gunner', lane: 1 }, { t: 7, type: 'scout', lane: 0 }, { t: 8, type: 'scout', lane: 2 },
      { t: 13, type: 'brawler', lane: 1 }, { t: 14, type: 'brawler', lane: 1 }, { t: 15, type: 'gunner', lane: 1 },
      { t: 21, type: 'scout', lane: 0 }, { t: 22, type: 'brawler', lane: 1 }, { t: 23, type: 'scout', lane: 2 },
      { t: 29, type: 'brawler', lane: 1 }, { t: 30, type: 'gunner', lane: 1 }, { t: 31, type: 'brawler', lane: 1 },
      { t: 38, type: 'brawler', lane: 1 }, { t: 39, type: 'scout', lane: 1 }
    ]
  },
  {
    name: 'Red Canyon', sky: 0x301410, income: 22, startScrap: 80, garageHp: 1080, fortressHp: 1320,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 165, dmg: 16 }, garageTurret: { range: 174, dmg: 16 },
    schedule: [
      { t: 1, type: 'brawler', lane: 1 }, { t: 2, type: 'brawler', lane: 1 },
      { t: 6, type: 'gunner', lane: 1 }, { t: 7, type: 'scout', lane: 0 }, { t: 8, type: 'scout', lane: 2 },
      { t: 13, type: 'brawler', lane: 1 }, { t: 14, type: 'gunner', lane: 1 }, { t: 15, type: 'brawler', lane: 1 },
      { t: 21, type: 'brawler', lane: 1 }, { t: 22, type: 'scout', lane: 0 }, { t: 23, type: 'gunner', lane: 1 },
      { t: 29, type: 'brawler', lane: 1 }, { t: 30, type: 'brawler', lane: 1 }, { t: 31, type: 'scout', lane: 2 },
      { t: 38, type: 'gunner', lane: 1 }, { t: 39, type: 'brawler', lane: 1 }, { t: 40, type: 'brawler', lane: 1 },
      { t: 47, type: 'brawler', lane: 1 }, { t: 48, type: 'gunner', lane: 1 }
    ]
  },
  {
    name: "Warlord's Gate", sky: 0x200810, income: 26, startScrap: 100, garageHp: 1160, fortressHp: 1700,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 170, dmg: 18 }, garageTurret: { range: 182, dmg: 18 },
    schedule: [
      { t: 1, type: 'brawler', lane: 1 }, { t: 2, type: 'brawler', lane: 1 }, { t: 3, type: 'gunner', lane: 1 },
      { t: 7, type: 'scout', lane: 0 }, { t: 8, type: 'scout', lane: 2 }, { t: 9, type: 'brawler', lane: 1 },
      { t: 14, type: 'brawler', lane: 1 }, { t: 15, type: 'gunner', lane: 1 }, { t: 16, type: 'brawler', lane: 1 },
      { t: 22, type: 'brawler', lane: 1 }, { t: 23, type: 'scout', lane: 0 }, { t: 24, type: 'gunner', lane: 1 }, { t: 25, type: 'scout', lane: 2 },
      { t: 31, type: 'brawler', lane: 1 }, { t: 32, type: 'brawler', lane: 1 }, { t: 33, type: 'gunner', lane: 1 },
      { t: 40, type: 'brawler', lane: 1 }, { t: 41, type: 'gunner', lane: 1 }, { t: 42, type: 'brawler', lane: 1 },
      { t: 49, type: 'brawler', lane: 1 }, { t: 50, type: 'brawler', lane: 1 }, { t: 51, type: 'gunner', lane: 1 },
      { t: 58, type: 'brawler', lane: 1 }, { t: 59, type: 'gunner', lane: 1 }
    ]
  }
];
