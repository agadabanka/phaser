/* Roadwar Iso — the isometric redesign. Same deterministic economy + combat as
 * the top-down RTS, but a FREER battlefield: units deploy at a CONTINUOUS lateral
 * spot lx∈[-1,1] (not 3 fixed lanes) and the field is drawn in perspective iso.
 * Win = fortress HP→0; lose = garage HP→0. Win-by-construction unchanged: the
 * autopilot rallies at lx 0 (centre); flanks are scouts the all-lx garage gun clears.
 *   { name, sky, income, startScrap, garageHp, fortressHp, rally(lx), autoBuild,
 *     autoEcon, garageTurret:{range,dmg}, fortressTurret:{range,dmg},
 *     schedule:[{t(s),type,lx}] }
 */
window.LEVELS = [
  {
    name: 'Desert Highway', difficulty: 0.5, sky: 0x3a2a16, income: 16, startScrap: 60, garageHp: 900, fortressHp: 600,
    rally: 0, autoBuild: 'brawler', fortressTurret: { range: 150, dmg: 10 }, garageTurret: { range: 150, dmg: 12 },
    schedule: [
      { t: 2, type: 'scout', lx: 0 },
      { t: 10, type: 'scout', lx: 0 }, { t: 11, type: 'brawler', lx: 0 },
      { t: 19, type: 'brawler', lx: 0 }, { t: 20, type: 'scout', lx: 0 }
    ]
  },
  {
    name: 'The Junkyard', difficulty: 0.65, sky: 0x24281a, income: 18, startScrap: 60, garageHp: 980, fortressHp: 900,
    rally: 0, autoBuild: 'brawler', autoEcon: 1, fortressTurret: { range: 155, dmg: 12 }, garageTurret: { range: 158, dmg: 13 },
    schedule: [
      { t: 1, type: 'gunner', lx: 0 }, { t: 2, type: 'scout', lx: 0 },
      { t: 9, type: 'gunner', lx: 0 }, { t: 10, type: 'brawler', lx: 0 }, { t: 11, type: 'gunner', lx: 0 },
      { t: 20, type: 'gunner', lx: 0 }, { t: 21, type: 'brawler', lx: 0 },
      { t: 30, type: 'gunner', lx: 0 }, { t: 31, type: 'brawler', lx: 0 }, { t: 32, type: 'gunner', lx: 0 }
    ]
  },
  {
    name: 'Neon Strip', difficulty: 1, sky: 0x161038, income: 20, startScrap: 72, garageHp: 1020, fortressHp: 1080,
    rally: 0, autoBuild: 'brawler', autoEcon: 2, fortressTurret: { range: 160, dmg: 14 }, garageTurret: { range: 166, dmg: 14 },
    schedule: [
      { t: 1, type: 'brawler', lx: 0 }, { t: 2, type: 'scout', lx: -0.6 },
      { t: 9, type: 'scout', lx: -0.6 }, { t: 10, type: 'scout', lx: 0.6 }, { t: 11, type: 'brawler', lx: 0 },
      { t: 19, type: 'gunner', lx: 0 }, { t: 20, type: 'scout', lx: 0.6 }, { t: 21, type: 'brawler', lx: 0 },
      { t: 30, type: 'scout', lx: -0.6 }, { t: 31, type: 'brawler', lx: 0 }, { t: 32, type: 'gunner', lx: 0 }, { t: 33, type: 'scout', lx: 0.6 }
    ]
  },
  {
    name: 'Red Canyon', difficulty: 1, sky: 0x301410, income: 22, startScrap: 84, garageHp: 1080, fortressHp: 1320,
    rally: 0, autoBuild: 'brawler', autoEcon: 2, fortressTurret: { range: 165, dmg: 16 }, garageTurret: { range: 174, dmg: 16 },
    schedule: [
      { t: 1, type: 'brawler', lx: 0 }, { t: 2, type: 'brawler', lx: 0 },
      { t: 10, type: 'brawler', lx: 0 }, { t: 11, type: 'gunner', lx: 0 }, { t: 12, type: 'brawler', lx: 0 },
      { t: 21, type: 'brawler', lx: 0 }, { t: 22, type: 'scout', lx: -0.6 }, { t: 23, type: 'brawler', lx: 0 },
      { t: 32, type: 'brawler', lx: 0 }, { t: 33, type: 'gunner', lx: 0 }, { t: 34, type: 'brawler', lx: 0 }, { t: 35, type: 'brawler', lx: 0 }
    ]
  },
  {
    name: "Warlord's Gate", difficulty: 0.8, sky: 0x200810, income: 26, startScrap: 100, garageHp: 1180, fortressHp: 1820,
    rally: 0, autoBuild: 'brawler', autoEcon: 2, fortressTurret: { range: 170, dmg: 18 }, garageTurret: { range: 182, dmg: 18 },
    schedule: [
      { t: 1, type: 'scout', lx: 0 }, { t: 2, type: 'gunner', lx: 0 }, { t: 3, type: 'scout', lx: -0.6 },
      { t: 10, type: 'brawler', lx: 0 }, { t: 11, type: 'gunner', lx: 0 }, { t: 12, type: 'scout', lx: 0.6 },
      { t: 18, type: 'brawler', lx: 0 }, { t: 19, type: 'gunner', lx: 0 }, { t: 20, type: 'brawler', lx: 0 }, { t: 21, type: 'scout', lx: -0.6 }, { t: 22, type: 'scout', lx: 0.6 },
      { t: 26, type: 'brawler', lx: 0 }, { t: 27, type: 'gunner', lx: 0 }, { t: 28, type: 'brawler', lx: 0 }, { t: 29, type: 'gunner', lx: 0 }, { t: 30, type: 'brawler', lx: 0 },
      { t: 32, type: 'warlord', lx: 0 }
    ]
  }
];
