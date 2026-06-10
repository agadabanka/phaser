/* Ember Depths — levels are data (the Studio Level DSL). Level Design agent owns this file.
 *
 * THEME: a molten lava-cave platformer. The campaign is a 5-level descent built on
 * Nintendo's four-step grammar (introduce -> develop -> twist -> master) and tuned
 * against the Studio.Feel model: a steady cadence of VARIED beats every ~1-2 windows
 * (so FLOW stays high — no dead air), rising to an INTEREST PEAK near ~84% of each
 * level, with the heaviest signature beat (spring / mover) as that climax.
 *
 *   L1 Molten Shallows — INTRODUCE: run, mud trudge, ice glide, stomp, one lava hop.
 *   L2 The Caldera     — DEVELOP:   two lava hops, a 2-tile wall, an ice finale.
 *   L3 Ember Vents     — TWIST 1:   the SPRING bounce pad (signature) as the climax.
 *   L4 Magma Run       — TWIST 2:   a MOVING PLATFORM bridging lava + an early spring.
 *   L5 The Core        — MASTER:    a medley of every verb, mover climax near 84%.
 *
 * LAVA is modelled as a GAP in the floor (no walkable ground) FILLED with a DEADLY
 * 'lava' slab. Studio.Materials marks 'lava' deadly + non-ground, so Studio.Level
 * routes it into the HAZARDS group:
 *   - the autopilot's groundAhead probe (scans world.platforms + world.moverGroup)
 *     sees NO ground over a lava pit  ->  it jumps the gap, exactly like an empty pit;
 *   - touching the lava (falling short) overlaps a hazard  ->  death.
 *
 * PHYSICS / REACHABILITY CONTRACT (must match game.js): the Studio.Platformer tune
 * gives a full held hop of ~3 tiles up / ~200px across; the autopilot probes ground
 * at x+26, fires a FULL hop for gaps & walls, holds jump while rising, rides movers
 * and springs passively. GEOMETRY RULES that keep the 0-death gate green:
 *   - every lava gap <= 120px wide (well under the ~200px hop),
 *   - walls <= 2 tiles (80px) tall, NEVER adjacent to a gap (a wall-hop sails ~200px,
 *     so a wall must sit a full runway-window away from any pit, and a gap landing
 *     gets a full window of stone before the next wall),
 *   - a gap NEVER lands on ice (it lands on stone or grippy mud — slick footing out
 *     of a jump is unsafe); ICE sections are ENTERED off stone at run speed and END
 *     on solid ground (no gap right after ice),
 *   - SPRINGS sit on a long continuous slab so the bounce arc lands back on ground,
 *   - MOVERS (w=120, tiny range) bridge a 120px lava gap so the bot rides-or-jumps;
 *     either outcome lands on solid ground.
 * These rules are encoded so each level is AI-completable 0-death by construction.
 */
window.LEVELS = [
  {
    // L1 — INTRODUCE. Gentle teach of the core verbs. A low platform + wall ledge,
    // a mud trudge, an ice glide (entered off stone, ends on mud), a stomp, then the
    // single lava hop as the climax (~84%) landing on continuous mud to the goal.
    name: 'Molten Shallows', tile: 40, width: 1680, height: 540, groundY: 470, sky: 0x140a08, bgTint: 0xffffff,
    spawn: { x: 60, y: 360 }, goal: 1620,
    ground: [
      [0, 420, 'stone'],
      [420, 630, 'mud'],          // first trudge (grippy, safe) — material-change beat
      [630, 840, 'stone'],
      [840, 1050, 'ice'],         // glide (entered off stone, ENDS on mud — no gap after)
      [1050, 1260, 'mud'],
      [1260, 1305, 'stone'],      // takeoff runway for the climax hop
      [1305, 1425, 'lava'],       // the lava hop (120px) — interest peak ~84%
      [1425, 1680, 'mud']         // lands on mud, continuous to the goal
    ],
    walls: [{ x: 295, tiles: 1, mat: 'stone' }],
    platforms: [{ x: 140, y: 350, w: 90, mat: 'stone' }],
    // second walker just past the lava landing: compounds the late climax (the
    // hop + a stomp in one breath) — lifts dynamics AND keeps the arc peak ~84%.
    enemies: [{ x: 1285, patrol: 18 }, { x: 1475, patrol: 24 }],
    // CRUMBLE — a fragile riser on the continuous stone slab (630-840). The run
    // crosses it and it collapses a few frames later, dropping the player onto the
    // solid stone below: urgency/dread FLAIR over a safe path (never blocks the gate).
    contraptions: [{ type: 'crumble', x: 730, w: 120, top: 446 }],
    coins: [
      { x: 185, y: 310 }, { x: 315, y: 320 },
      { x: 495, y: 430 }, { x: 525, y: 430 }, { x: 555, y: 430 },
      { x: 735, y: 430 },
      { x: 915, y: 430 }, { x: 945, y: 430 }, { x: 975, y: 430 },
      { x: 1365, y: 350 },
      { x: 1545, y: 430 }, { x: 1575, y: 430 }, { x: 1605, y: 430 }
    ]
  },
  {
    // L2 — DEVELOP. Two lava hops + a taller (2-tile) wall + an ice finale. Both gaps
    // land on grippy mud; the second hop is the climax (~84%). Ends on mud to the goal.
    name: 'The Caldera', tile: 40, width: 1920, height: 540, groundY: 470, sky: 0x141008, bgTint: 0xffe2cc,
    spawn: { x: 60, y: 360 }, goal: 1860,
    ground: [
      [0, 480, 'stone'],
      [480, 720, 'mud'],
      [720, 1020, 'stone'],
      [1020, 1140, 'lava'],       // first lava hop (120px) -> lands mud
      [1140, 1440, 'mud'],
      [1440, 1500, 'stone'],      // takeoff runway for hop #2
      [1500, 1620, 'lava'],       // climax hop (~84%) -> lands mud
      [1620, 1920, 'mud']
    ],
    walls: [{ x: 340, tiles: 2, mat: 'stone' }],
    platforms: [{ x: 75, y: 350, w: 90, mat: 'stone' }],
    enemies: [{ x: 1465, patrol: 18 }],
    coins: [
      { x: 120, y: 310 }, { x: 360, y: 320 },
      { x: 570, y: 430 }, { x: 600, y: 430 }, { x: 630, y: 430 },
      { x: 840, y: 430 },
      { x: 1050, y: 350 }, { x: 1080, y: 350 }, { x: 1110, y: 350 },
      { x: 1560, y: 350 },
      { x: 1770, y: 430 }, { x: 1800, y: 430 }, { x: 1830, y: 430 }
    ]
  },
  {
    // L3 — TWIST 1: the SPRING. The signature bounce pad sits on a long stone slab at
    // ~84% and is the interest peak: run into it, float up through a coin column, land
    // back on continuous ground. Plus one lava hop, a mud trudge and an ice glide.
    name: 'Ember Vents', tile: 40, width: 2160, height: 540, groundY: 470, sky: 0x120806, bgTint: 0xffc9a8,
    spawn: { x: 60, y: 360 }, goal: 2100,
    ground: [
      [0, 480, 'stone'],
      [480, 720, 'mud'],
      [720, 1020, 'stone'],
      [1020, 1140, 'lava'],       // lava hop -> lands mud
      [1140, 1440, 'mud'],
      [1440, 1680, 'ice'],        // glide -> ENDS on stone (no gap after)
      [1680, 1920, 'stone'],      // long slab carrying the SPRING + its landing
      [1920, 2160, 'mud']
    ],
    walls: [{ x: 340, tiles: 1, mat: 'stone' }],
    platforms: [{ x: 140, y: 350, w: 90, mat: 'stone' }],
    enemies: [{ x: 985, patrol: 40 }],
    springs: [{ x: 1800 }],        // climax (~84%): on the stone slab, arc lands on stone/mud
    // SEESAW — a tilting balance plank on the continuous stone slab (720-1020). It
    // reads as flat ground (the autopilot runs straight across); the gentle downhill
    // nudge is bounded flair: balance/tension/control over a safe path.
    contraptions: [{ type: 'seesaw', x: 870, w: 200 }],
    coins: [
      { x: 185, y: 310 }, { x: 360, y: 320 },
      { x: 840, y: 430 },
      { x: 1080, y: 350 },
      { x: 1290, y: 430 }, { x: 1320, y: 430 }, { x: 1350, y: 430 },
      { x: 1530, y: 430 }, { x: 1560, y: 430 }, { x: 1590, y: 430 },
      { x: 1800, y: 300 }, { x: 1800, y: 340 },   // coin column rewarding the bounce
      { x: 2010, y: 430 }, { x: 2040, y: 430 }, { x: 2070, y: 430 }
    ]
  },
  {
    // L4 — TWIST 2: the MOVING PLATFORM. An early spring warms up, then the signature
    // climax (~84%) is a mover bridging a lava gap — ride it across (it reads as ground)
    // or hop the 120px gap; either lands on mud. One earlier lava hop with a wide runway.
    name: 'Magma Run', tile: 40, width: 2160, height: 540, groundY: 470, sky: 0x16060a, bgTint: 0xffb09a,
    spawn: { x: 60, y: 360 }, goal: 2100,
    ground: [
      [0, 480, 'stone'],
      [480, 720, 'mud'],
      [720, 840, 'stone'],        // 120px runway before hop #1
      [840, 960, 'lava'],         // lava hop -> lands on a long stone slab
      [960, 1440, 'stone'],       // carries the SPRING; wide safe slab
      [1440, 1680, 'mud'],
      [1680, 1740, 'stone'],      // mover approach runway
      [1740, 1860, 'lava'],       // climax (~84%): bridged by the MOVER -> lands mud
      [1860, 2160, 'mud']
    ],
    walls: [{ x: 340, tiles: 1, mat: 'stone' }],
    platforms: [{ x: 140, y: 350, w: 90, mat: 'stone' }],
    // second walker past the mover landing: compounds the climax (ride/hop the
    // lava, then a stomp) — the same late-peak shape that fixed L1's curve.
    enemies: [{ x: 1080, patrol: 40 }, { x: 1965, patrol: 24 }],
    springs: [{ x: 1320 }],        // on the stone slab (lands on stone/mud)
    movers: [{ x: 1800, y: 452, w: 120, axis: 'x', range: 20, speed: 50, mat: 'stone' }],
    // LAUNCHER — a geyser/bounce pad on the wide stone slab (960-1440), placed in
    // the clear grounded stretch BETWEEN the enemy (patrols ~1040-1120) and the
    // spring (1320). Run through it and get lofted (pc.launch); the arc lands back
    // on the same safe slab. Exhilaration/release FLAIR — adds height, never timing.
    contraptions: [{ type: 'launcher', x: 1200, vel: 820 }],
    coins: [
      { x: 185, y: 310 }, { x: 360, y: 320 },
      { x: 900, y: 350 },
      { x: 1320, y: 300 }, { x: 1320, y: 340 },   // coin column over the spring
      { x: 1530, y: 430 }, { x: 1560, y: 430 }, { x: 1590, y: 430 },
      { x: 1800, y: 360 },                         // coin riding the mover line
      { x: 2010, y: 430 }, { x: 2040, y: 430 }, { x: 2070, y: 430 }
    ]
  },
  {
    // L5 — MASTER. A medley recombining every verb: walls, a stomp, mud trudges, an ice
    // glide, a spring, three lava hops, and the MOVER as the grand climax (~84%). All
    // gaps land on mud/stone; the mover lands on mud; the ice ends on stone.
    name: 'The Core', tile: 40, width: 2400, height: 540, groundY: 470, sky: 0x1e0c16, bgTint: 0xe6b8d8,
    spawn: { x: 60, y: 360 }, goal: 2340,
    ground: [
      [0, 300, 'stone'],
      [300, 540, 'mud'],
      [540, 660, 'stone'],        // runway before hop #1
      [660, 780, 'lava'],         // hop #1 -> lands mud
      [780, 1080, 'mud'],
      [1080, 1200, 'stone'],      // runway before hop #2
      [1200, 1320, 'lava'],       // hop #2 -> lands mud
      [1320, 1620, 'mud'],
      [1620, 1860, 'stone'],      // slab carrying the SPRING
      [1860, 1980, 'ice'],        // glide -> ENDS on stone (no gap after)
      [1980, 2040, 'stone'],      // mover approach runway
      [2040, 2160, 'lava'],       // climax hop (~84%) bridged by the MOVER -> lands mud
      [2160, 2400, 'mud']
    ],
    walls: [{ x: 380, tiles: 1, mat: 'stone' }, { x: 1480, tiles: 1, mat: 'stone' }],
    platforms: [{ x: 140, y: 350, w: 90, mat: 'stone' }],
    enemies: [{ x: 920, patrol: 40 }, { x: 1420, patrol: 36 }],
    springs: [{ x: 1740 }],        // on the stone slab (lands on stone before the ice)
    movers: [{ x: 2100, y: 452, w: 120, axis: 'x', range: 20, speed: 50, mat: 'stone' }],
    coins: [
      { x: 185, y: 310 }, { x: 420, y: 430 },
      { x: 720, y: 350 },
      { x: 900, y: 430 }, { x: 930, y: 430 }, { x: 960, y: 430 },
      { x: 1260, y: 350 },
      { x: 1440, y: 430 },
      { x: 1740, y: 300 }, { x: 1740, y: 340 },   // coin column over the spring
      { x: 1920, y: 430 },
      { x: 2100, y: 360 },                         // coin on the mover line
      { x: 2250, y: 430 }, { x: 2280, y: 430 }, { x: 2310, y: 430 }
    ]
  }
];
