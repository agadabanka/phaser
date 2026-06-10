/* Nimbus Climb — levels are data (the Studio Level DSL, VERTICAL archetype).
 *
 * THEME: a sky-climbing platformer. Five towers of cumulus, climbed bottom→top,
 * on the introduce→develop→twist→master grammar, tuned against the vertical
 * Studio.Feel model (beats along the CLIMB axis, interest peak ~84% of height).
 *
 *   C1 Foothill Puffs   — INTRODUCE: zig-zag hops + the bouncy cloud (spring).
 *   C2 Whisperdraft     — TWIST 1:   the UPDRAFT — ride a wind column ~410px up.
 *   C3 The Gustline     — TWIST 2:   GUSTS — timed crosswinds over the hops.
 *   C4 Stormshelf Pass  — DEVELOP:   storm shelves (deadly) flank the route; an
 *                                    updraft threads the pinch.
 *   C5 The Sun Bell     — MASTER:    everything at once, summit bell at the top.
 *
 * VERTICAL CONTRACT (rules.json "vertical", enforced by tools/level-lint):
 *   platforms: x=LEFT edge, y=TOP, w, mat (cloud/mist/crystal walkable, STORM
 *   deadly). chain[]: ORDERED waypoints (y = platform top − 20); each hop dx≤180
 *   /up≤110 OR powered by updraft(≤420)/spring(≤260,vel760); every waypoint over
 *   a walkable platform ≥120px. updrafts {x,w,y0,y1,maxRise}. gusts {x,y,w,h,dir,
 *   period,duty,push} with a catch platform under each crossing. storm shelves
 *   sit ≥90px clear of every landing.
 */
window.LEVELS = [
  {
    name: 'Foothill Puffs', tile: 40, vertical: true,
    width: 960, height: 1400, groundY: 1360, sky: 0x8fb4e4, bgTint: 0xffffff,
    spawn: { x: 480, y: 1240 }, goalY: 220,
    platforms: [
      { x: 360, y: 1300, w: 240, mat: 'cloud' },
      { x: 250, y: 1200, w: 140, mat: 'cloud' },
      { x: 410, y: 1100, w: 140, mat: 'cloud' },
      { x: 570, y: 1000, w: 140, mat: 'cloud' },
      { x: 410, y: 900,  w: 140, mat: 'mist'  },
      { x: 250, y: 800,  w: 140, mat: 'cloud' },
      { x: 410, y: 700,  w: 140, mat: 'cloud' },
      { x: 560, y: 600,  w: 160, mat: 'cloud' },
      { x: 570, y: 340,  w: 140, mat: 'cloud' },
      { x: 390, y: 240,  w: 180, mat: 'cloud' },
      { x: 60,  y: 1150, w: 100, mat: 'mist'  }
    ],
    chain: [
      { x: 480, y: 1280 }, { x: 320, y: 1180 }, { x: 480, y: 1080 }, { x: 640, y: 980 },
      { x: 480, y: 880 }, { x: 320, y: 780 }, { x: 480, y: 680 }, { x: 640, y: 580 },
      { x: 640, y: 320 }, { x: 480, y: 220 }
    ],
    springs: [{ x: 640, y: 591, vel: 760 }],
    enemies: [{ x: 480, y: 886, patrol: 28 }],
    coins: [
      { x: 320, y: 1140 }, { x: 480, y: 1040 }, { x: 640, y: 940 },
      { x: 480, y: 840 }, { x: 320, y: 740 }, { x: 480, y: 640 },
      { x: 640, y: 540 }, { x: 640, y: 470 }, { x: 640, y: 400 },
      { x: 480, y: 180 }, { x: 80, y: 1110 }, { x: 110, y: 1110 }, { x: 140, y: 1110 }
    ]
  },
  {
    name: 'Whisperdraft', tile: 40, vertical: true,
    width: 960, height: 1700, groundY: 1660, sky: 0x8fb0e0, bgTint: 0xfff2e2,
    spawn: { x: 480, y: 1540 }, goalY: 250,
    platforms: [
      { x: 360, y: 1600, w: 240, mat: 'cloud' },
      { x: 250, y: 1500, w: 140, mat: 'mist'  },
      { x: 410, y: 1400, w: 140, mat: 'cloud' },
      { x: 570, y: 1300, w: 140, mat: 'cloud' },
      { x: 570, y: 1190, w: 140, mat: 'cloud' },
      { x: 400, y: 1090, w: 160, mat: 'cloud' },
      { x: 400, y: 680,  w: 160, mat: 'crystal' },
      { x: 250, y: 580,  w: 140, mat: 'mist'  },
      { x: 410, y: 480,  w: 140, mat: 'cloud' },
      { x: 250, y: 370,  w: 140, mat: 'mist'  },
      { x: 390, y: 270,  w: 180, mat: 'cloud' }
    ],
    updrafts: [{ x: 480, w: 130, y0: 650, y1: 1075, maxRise: 250 }],
    chain: [
      { x: 480, y: 1580 }, { x: 320, y: 1480 }, { x: 480, y: 1380 }, { x: 640, y: 1280 },
      { x: 640, y: 1170 }, { x: 480, y: 1070 }, { x: 480, y: 660 },
      { x: 320, y: 560 }, { x: 480, y: 460 }, { x: 320, y: 350 }, { x: 480, y: 250 }
    ],
    enemies: [{ x: 640, y: 1276, patrol: 28 }],
    coins: [
      { x: 320, y: 1440 }, { x: 480, y: 1340 }, { x: 640, y: 1240 },
      { x: 480, y: 1000 }, { x: 480, y: 900 }, { x: 480, y: 800 }, { x: 480, y: 700 },
      { x: 320, y: 520 }, { x: 480, y: 420 }, { x: 320, y: 310 }, { x: 480, y: 200 }
    ]
  },
  {
    name: 'The Gustline', tile: 40, vertical: true,
    width: 960, height: 1900, groundY: 1860, sky: 0x88a8d8, bgTint: 0xe8f0ff,
    spawn: { x: 480, y: 1740 }, goalY: 280,
    platforms: [
      { x: 360, y: 1800, w: 240, mat: 'cloud' },
      { x: 570, y: 1700, w: 140, mat: 'cloud' },
      { x: 410, y: 1600, w: 140, mat: 'mist'  },
      { x: 250, y: 1500, w: 140, mat: 'cloud' },
      { x: 410, y: 1400, w: 140, mat: 'cloud' },
      { x: 570, y: 1300, w: 140, mat: 'cloud' },
      { x: 410, y: 1340, w: 120, mat: 'mist'  },
      { x: 410, y: 1200, w: 140, mat: 'cloud' },
      { x: 570, y: 1100, w: 140, mat: 'crystal' },
      { x: 410, y: 1000, w: 140, mat: 'cloud' },
      { x: 250, y: 900,  w: 140, mat: 'cloud' },
      { x: 410, y: 940,  w: 120, mat: 'mist'  },
      { x: 410, y: 800,  w: 140, mat: 'cloud' },
      { x: 570, y: 700,  w: 140, mat: 'mist'  },
      { x: 410, y: 600,  w: 160, mat: 'cloud' },
      { x: 250, y: 500,  w: 140, mat: 'cloud' },
      { x: 410, y: 400,  w: 140, mat: 'cloud' },
      { x: 390, y: 300,  w: 180, mat: 'cloud' },
      { x: 150, y: 1080, w: 140, mat: 'mist'  }
    ],
    gusts: [
      { x: 560, y: 1340, w: 280, h: 130, dir: -1, period: 3.4, duty: 0.4, push: 820 },
      { x: 400, y: 940,  w: 260, h: 130, dir: 1,  period: 3.0, duty: 0.45, push: 820 }
    ],
    contraptions: [{ type: 'crumble', x: 220, w: 130, top: 1060 }],
    chain: [
      { x: 480, y: 1780 }, { x: 640, y: 1680 }, { x: 480, y: 1580 }, { x: 320, y: 1480 },
      { x: 480, y: 1380 }, { x: 640, y: 1280 }, { x: 480, y: 1180 }, { x: 640, y: 1080 },
      { x: 480, y: 980 }, { x: 320, y: 880 }, { x: 480, y: 780 }, { x: 640, y: 680 },
      { x: 480, y: 580 }, { x: 320, y: 480 }, { x: 480, y: 380 }, { x: 480, y: 280 }
    ],
    enemies: [{ x: 480, y: 1186, patrol: 30 }, { x: 480, y: 586, patrol: 30 }],
    coins: [
      { x: 640, y: 1640 }, { x: 480, y: 1540 }, { x: 320, y: 1440 },
      { x: 520, y: 1330 }, { x: 600, y: 1310 }, { x: 480, y: 1140 }, { x: 640, y: 1040 },
      { x: 360, y: 920 }, { x: 290, y: 900 }, { x: 480, y: 740 }, { x: 640, y: 640 },
      { x: 320, y: 440 }, { x: 480, y: 340 }, { x: 180, y: 1040 }, { x: 220, y: 1040 }, { x: 260, y: 1040 }
    ]
  },
  {
    name: 'Stormshelf Pass', tile: 40, vertical: true,
    width: 960, height: 2100, groundY: 2060, sky: 0x7890c0, bgTint: 0xd8d2ee,
    spawn: { x: 480, y: 1940 }, goalY: 260,
    platforms: [
      { x: 360, y: 2000, w: 240, mat: 'cloud' },
      { x: 250, y: 1900, w: 140, mat: 'cloud' },
      { x: 410, y: 1800, w: 140, mat: 'mist'  },
      { x: 570, y: 1700, w: 140, mat: 'cloud' },
      { x: 410, y: 1600, w: 140, mat: 'cloud' },
      { x: 250, y: 1500, w: 140, mat: 'cloud' },
      { x: 410, y: 1400, w: 160, mat: 'cloud' },
      { x: 410, y: 1000, w: 160, mat: 'crystal' },
      { x: 250, y: 900,  w: 140, mat: 'mist'  },
      { x: 410, y: 800,  w: 140, mat: 'cloud' },
      { x: 570, y: 700,  w: 140, mat: 'cloud' },
      { x: 410, y: 600,  w: 140, mat: 'mist'  },
      { x: 250, y: 500,  w: 140, mat: 'cloud' },
      { x: 410, y: 400,  w: 140, mat: 'cloud' },
      { x: 390, y: 280,  w: 180, mat: 'cloud' },
      { x: 410, y: 360,  w: 140, mat: 'cloud' },
      { x: 150, y: 1320, w: 120, mat: 'storm' },
      { x: 690, y: 1320, w: 120, mat: 'storm' },
      { x: 150, y: 1120, w: 120, mat: 'storm' },
      { x: 690, y: 1120, w: 120, mat: 'storm' },
      { x: 640, y: 460,  w: 100, mat: 'storm' },
      { x: 130, y: 700,  w: 100, mat: 'storm' }
    ],
    updrafts: [{ x: 480, w: 130, y0: 970, y1: 1380, maxRise: 250 }],
    movers: [{ x: 760, y: 950, w: 120, axis: 'y', range: 60, speed: 40, mat: 'cloud' }],
    chain: [
      { x: 480, y: 1980 }, { x: 320, y: 1880 }, { x: 480, y: 1780 }, { x: 640, y: 1680 },
      { x: 480, y: 1580 }, { x: 320, y: 1480 }, { x: 480, y: 1380 }, { x: 480, y: 980 },
      { x: 320, y: 880 }, { x: 480, y: 780 }, { x: 640, y: 680 }, { x: 480, y: 580 },
      { x: 320, y: 480 }, { x: 480, y: 380 }, { x: 480, y: 340 }, { x: 480, y: 260 }
    ],
    enemies: [{ x: 480, y: 1586, patrol: 30 }, { x: 480, y: 786, patrol: 30 }],
    coins: [
      { x: 320, y: 1840 }, { x: 480, y: 1740 }, { x: 640, y: 1640 }, { x: 480, y: 1540 },
      { x: 480, y: 1300 }, { x: 480, y: 1200 }, { x: 480, y: 1100 },
      { x: 320, y: 840 }, { x: 480, y: 740 }, { x: 640, y: 640 }, { x: 760, y: 900 }, { x: 760, y: 860 },
      { x: 320, y: 440 }, { x: 480, y: 340 }, { x: 480, y: 220 }
    ]
  },
  {
    name: 'The Sun Bell', tile: 40, vertical: true,
    width: 960, height: 2400, groundY: 2360, sky: 0x88a0d0, bgTint: 0xffe9c8,
    spawn: { x: 480, y: 2240 }, goalY: 240,
    platforms: [
      { x: 360, y: 2300, w: 240, mat: 'cloud' },
      { x: 250, y: 2200, w: 140, mat: 'mist'  },
      { x: 410, y: 2100, w: 140, mat: 'cloud' },
      { x: 570, y: 2000, w: 140, mat: 'cloud' },
      { x: 410, y: 1900, w: 140, mat: 'mist'  },
      { x: 410, y: 1500, w: 160, mat: 'crystal' },
      { x: 250, y: 1400, w: 140, mat: 'cloud' },
      { x: 410, y: 1300, w: 140, mat: 'cloud' },
      { x: 250, y: 1340, w: 120, mat: 'mist'  },
      { x: 570, y: 1200, w: 140, mat: 'crystal' },
      { x: 410, y: 1100, w: 140, mat: 'cloud' },
      { x: 560, y: 1000, w: 160, mat: 'cloud' },
      { x: 570, y: 740,  w: 140, mat: 'cloud' },
      { x: 410, y: 640,  w: 160, mat: 'cloud' },
      { x: 400, y: 280,  w: 180, mat: 'cloud' },
      { x: 410, y: 360,  w: 140, mat: 'cloud' },
      { x: 160, y: 560,  w: 120, mat: 'storm' },
      { x: 680, y: 560,  w: 120, mat: 'storm' },
      { x: 160, y: 400,  w: 120, mat: 'storm' },
      { x: 680, y: 400,  w: 120, mat: 'storm' },
      { x: 120, y: 1900, w: 100, mat: 'storm' },
      { x: 700, y: 1700, w: 100, mat: 'storm' }
    ],
    updrafts: [
      { x: 480, w: 130, y0: 1470, y1: 1880, maxRise: 250 },
      { x: 480, w: 130, y0: 250,  y1: 620,  maxRise: 250 }
    ],
    gusts: [{ x: 330, y: 1340, w: 260, h: 130, dir: 1, period: 3.2, duty: 0.42, push: 820 }],
    springs: [{ x: 640, y: 991, vel: 760 }],
    contraptions: [{ type: 'crumble', x: 760, w: 130, top: 1160 }],
    chain: [
      { x: 480, y: 2280 }, { x: 320, y: 2180 }, { x: 480, y: 2080 }, { x: 640, y: 1980 },
      { x: 480, y: 1880 }, { x: 480, y: 1480 }, { x: 320, y: 1380 }, { x: 480, y: 1280 },
      { x: 640, y: 1180 }, { x: 480, y: 1080 }, { x: 640, y: 980 }, { x: 640, y: 720 },
      { x: 480, y: 620 }, { x: 480, y: 340 }, { x: 490, y: 260 }
    ],
    enemies: [{ x: 480, y: 2086, patrol: 30 }, { x: 640, y: 1186, patrol: 26 }, { x: 480, y: 1086, patrol: 30 }],
    coins: [
      { x: 320, y: 2140 }, { x: 480, y: 2040 }, { x: 640, y: 1940 },
      { x: 480, y: 1800 }, { x: 480, y: 1700 }, { x: 480, y: 1600 },
      { x: 380, y: 1330 }, { x: 440, y: 1310 }, { x: 640, y: 1140 }, { x: 480, y: 1040 },
      { x: 640, y: 940 }, { x: 640, y: 860 }, { x: 640, y: 790 },
      { x: 480, y: 560 }, { x: 480, y: 460 }, { x: 480, y: 360 }, { x: 490, y: 200 },
      { x: 760, y: 1120 }, { x: 800, y: 1120 }
    ]
  }
];
