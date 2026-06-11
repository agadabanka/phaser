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
    name: 'Desert Highway', sky: 0x3a2a16, income: 16, startScrap: 60, garageHp: 900, fortressHp: 700,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 150, dmg: 10 }, garageTurret: { range: 150, dmg: 12 },
    schedule: [{ t: 2, type: 'scout', lane: 1 }, { t: 6, type: 'scout', lane: 1 }, { t: 11, type: 'brawler', lane: 1 }, { t: 17, type: 'scout', lane: 0 }, { t: 24, type: 'brawler', lane: 1 }]
  },
  {
    name: 'The Junkyard', sky: 0x24281a, income: 18, startScrap: 60, garageHp: 950, fortressHp: 850,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 155, dmg: 12 }, garageTurret: { range: 150, dmg: 12 },
    schedule: [{ t: 2, type: 'scout', lane: 1 }, { t: 6, type: 'brawler', lane: 1 }, { t: 12, type: 'scout', lane: 2 }, { t: 18, type: 'brawler', lane: 1 }, { t: 25, type: 'gunner', lane: 1 }, { t: 33, type: 'brawler', lane: 1 }]
  },
  {
    name: 'Neon Strip', sky: 0x161038, income: 20, startScrap: 70, garageHp: 1000, fortressHp: 1000,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 160, dmg: 14 }, garageTurret: { range: 150, dmg: 13 },
    schedule: [{ t: 2, type: 'brawler', lane: 1 }, { t: 8, type: 'gunner', lane: 1 }, { t: 14, type: 'scout', lane: 0 }, { t: 20, type: 'brawler', lane: 1 }, { t: 28, type: 'gunner', lane: 1 }, { t: 36, type: 'brawler', lane: 1 }, { t: 44, type: 'brawler', lane: 1 }]
  },
  {
    name: 'Red Canyon', sky: 0x301410, income: 22, startScrap: 80, garageHp: 1050, fortressHp: 1150,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 165, dmg: 16 }, garageTurret: { range: 155, dmg: 14 },
    schedule: [{ t: 2, type: 'brawler', lane: 1 }, { t: 7, type: 'brawler', lane: 1 }, { t: 13, type: 'gunner', lane: 1 }, { t: 20, type: 'scout', lane: 2 }, { t: 27, type: 'brawler', lane: 1 }, { t: 35, type: 'gunner', lane: 1 }, { t: 44, type: 'brawler', lane: 1 }, { t: 52, type: 'brawler', lane: 1 }]
  },
  {
    name: "Warlord's Gate", sky: 0x200810, income: 26, startScrap: 100, garageHp: 1100, fortressHp: 1500,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 170, dmg: 18 }, garageTurret: { range: 160, dmg: 16 },
    schedule: [{ t: 2, type: 'brawler', lane: 1 }, { t: 7, type: 'gunner', lane: 1 }, { t: 13, type: 'brawler', lane: 1 }, { t: 20, type: 'brawler', lane: 1 }, { t: 27, type: 'gunner', lane: 1 }, { t: 35, type: 'brawler', lane: 1 }, { t: 43, type: 'gunner', lane: 1 }, { t: 52, type: 'brawler', lane: 1 }, { t: 60, type: 'brawler', lane: 1 }]
  }
];
