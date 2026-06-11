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
// Shaped through the design lens (tools/design-lens): each ground has ONE
// signature (introduce→develop→twist→master), a within-level interest curve
// (HOOK → waves with RESTS → a climactic ASSAULT), and the campaign BACK-LOADS
// to the Warlord boss on G5 (the macro climax). Flanks are scouts only (the base
// gun clears them — keeps the autopilot win-by-construction; see rules.json rts).
window.LEVELS = [
  {
    // G1 — INTRODUCE: the basic convoy (scouts + your first brawler). Gentle.
    name: 'Desert Highway', sky: 0x3a2a16, income: 16, startScrap: 60, garageHp: 900, fortressHp: 700,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 150, dmg: 10 }, garageTurret: { range: 150, dmg: 12 },
    schedule: [
      { t: 1, type: 'scout', lane: 1 }, { t: 2, type: 'scout', lane: 1 },                              // hook: a probe
      { t: 9, type: 'brawler', lane: 1 }, { t: 10, type: 'scout', lane: 1 },                            // wave 1
      { t: 18, type: 'brawler', lane: 1 }, { t: 19, type: 'scout', lane: 1 }, { t: 20, type: 'brawler', lane: 1 } // climax
    ]
  },
  {
    // G2 — DEVELOP: ranged GUNNERS are the signature (a standoff to break).
    name: 'The Junkyard', sky: 0x24281a, income: 18, startScrap: 60, garageHp: 980, fortressHp: 900,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 155, dmg: 12 }, garageTurret: { range: 158, dmg: 13 },
    schedule: [
      { t: 1, type: 'gunner', lane: 1 }, { t: 2, type: 'scout', lane: 1 },                              // hook
      { t: 9, type: 'gunner', lane: 1 }, { t: 10, type: 'brawler', lane: 1 }, { t: 11, type: 'gunner', lane: 1 }, // wave: ranged wall
      { t: 20, type: 'gunner', lane: 1 }, { t: 21, type: 'brawler', lane: 1 },                          // wave
      { t: 30, type: 'gunner', lane: 1 }, { t: 31, type: 'brawler', lane: 1 }, { t: 32, type: 'gunner', lane: 1 } // climax: gunline
    ]
  },
  {
    // G3 — TWIST: FLANK rushes (the react-NOW surprise). A pincer down the sides.
    name: 'Neon Strip', sky: 0x161038, income: 20, startScrap: 72, garageHp: 1020, fortressHp: 1080,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 160, dmg: 14 }, garageTurret: { range: 166, dmg: 14 },
    schedule: [
      { t: 1, type: 'brawler', lane: 1 }, { t: 2, type: 'scout', lane: 0 },                             // hook + first flank
      { t: 9, type: 'scout', lane: 0 }, { t: 10, type: 'scout', lane: 2 }, { t: 11, type: 'brawler', lane: 1 }, // pincer wave
      { t: 19, type: 'gunner', lane: 1 }, { t: 20, type: 'scout', lane: 2 }, { t: 21, type: 'brawler', lane: 1 }, // wave
      { t: 30, type: 'scout', lane: 0 }, { t: 31, type: 'brawler', lane: 1 }, { t: 32, type: 'gunner', lane: 1 }, { t: 33, type: 'scout', lane: 2 } // climax: full pincer
    ]
  },
  {
    // G4 — DEVELOP harder: BRAWLER WALLS (heavy armor columns to out-grind).
    name: 'Red Canyon', sky: 0x301410, income: 22, startScrap: 84, garageHp: 1080, fortressHp: 1320,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 165, dmg: 16 }, garageTurret: { range: 174, dmg: 16 },
    schedule: [
      { t: 1, type: 'brawler', lane: 1 }, { t: 2, type: 'brawler', lane: 1 },                           // hook: an armor wall
      { t: 10, type: 'brawler', lane: 1 }, { t: 11, type: 'gunner', lane: 1 }, { t: 12, type: 'brawler', lane: 1 }, // wave
      { t: 21, type: 'brawler', lane: 1 }, { t: 22, type: 'scout', lane: 0 }, { t: 23, type: 'brawler', lane: 1 }, // wave + flank
      { t: 32, type: 'brawler', lane: 1 }, { t: 33, type: 'gunner', lane: 1 }, { t: 34, type: 'brawler', lane: 1 }, { t: 35, type: 'brawler', lane: 1 } // climax: heavy column
    ]
  },
  {
    // G5 — MASTER + CLIMAX: everything, capped by the WARLORD boss war-rig. The
    // densest, longest ground — the campaign's macro peak (back-loaded).
    name: "Warlord's Gate", sky: 0x200810, income: 26, startScrap: 100, garageHp: 1180, fortressHp: 1820,
    rally: 1, autoBuild: 'brawler', fortressTurret: { range: 170, dmg: 18 }, garageTurret: { range: 182, dmg: 18 },
    schedule: [
      { t: 1, type: 'scout', lane: 1 }, { t: 2, type: 'gunner', lane: 1 }, { t: 3, type: 'scout', lane: 0 },        // hook: a light probe
      { t: 10, type: 'brawler', lane: 1 }, { t: 11, type: 'gunner', lane: 1 }, { t: 12, type: 'scout', lane: 2 },   // wave 1
      { t: 18, type: 'brawler', lane: 1 }, { t: 19, type: 'gunner', lane: 1 }, { t: 20, type: 'brawler', lane: 1 }, { t: 21, type: 'scout', lane: 0 }, // wave 2: pincer
      { t: 26, type: 'brawler', lane: 1 }, { t: 27, type: 'gunner', lane: 1 }, { t: 28, type: 'brawler', lane: 1 }, { t: 29, type: 'gunner', lane: 1 }, { t: 30, type: 'brawler', lane: 1 }, // build-up: the gate's full garrison holds the line
      { t: 32, type: 'warlord', lane: 1 } // CLIMAX: the WARLORD himself rolls out last — the boss the whole campaign built to
    ]
  }
];
