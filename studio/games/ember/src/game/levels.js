/* Ember Depths — levels are data (the Studio Level DSL). Level Design agent owns this file.
 *
 * THEME: a lava-cave platformer. LAVA is modelled as a GAP in the floor (no walkable
 * ground segment) that is FILLED with a DEADLY 'lava' slab. Because the Materials table
 * marks 'lava' as deadly + non-ground, Studio.Level routes it into the HAZARDS group, so:
 *   - the autopilot's groundAhead probe (which scans world.platforms only) sees NO ground
 *     over a lava pit  ->  it jumps the gap, exactly like an empty pit;
 *   - touching the lava (falling short) overlaps a hazard  ->  death.
 *
 * PHYSICS CONTRACT (must match game.js): SPEED=220, JUMP_V=-600, GRAV=1300.
 *   A full hop covers ~200px of air. The autopilot fires a FULL hop both for gaps and for
 *   walls (blocked.right), so a wall-hop sails ~200px before landing. GEOMETRY RULES that
 *   keep the 0-death gate green (mirrors the proven template spacing):
 *     - every lava gap <= ~140px wide,
 *     - every wall <= 2 tiles (80px) tall,
 *     - a wall must sit >= ~300px BEFORE the next gap (so its hop lands on stone with
 *       runway to re-detect and clear the gap), and >= ~200px AFTER the previous gap.
 */
window.LEVELS = [
  {
    // Level 1 uses the template's proven gap/wall/enemy spacing, reskinned as lava cave.
    name: 'Molten Shallows', tile: 40, width: 1920, height: 540, groundY: 470, sky: 0x140a08,
    spawn: { x: 60, y: 360 }, goal: 1860,
    //  stone 0-420 | lava 420-560 (140) | stone 560-1100 | lava 1100-1180 (80) | stone 1180-1920
    ground: [
      [0, 420, 'stone'],
      [420, 560, 'lava'],
      [560, 1100, 'stone'],
      [1100, 1180, 'lava'],
      [1180, 1920, 'stone']
    ],
    walls: [{ x: 760, tiles: 2, mat: 'stone' }],   // 200px after gap-end, 340px before next gap
    coins: [
      { x: 300, y: 440 }, { x: 360, y: 440 },
      { x: 640, y: 440 }, { x: 900, y: 440 },
      { x: 1300, y: 440 }, { x: 1400, y: 440 },
      { x: 1640, y: 360 }, { x: 1780, y: 440 }
    ],
    enemies: [{ x: 980, patrol: 50 }]               // between wall and the 1100 gap (template)
  },
  {
    // Level 2 — a deeper run; same spacing discipline, two lava pits + one cave pillar.
    name: 'The Caldera', tile: 40, width: 2040, height: 540, groundY: 470, sky: 0x140a08,
    spawn: { x: 60, y: 360 }, goal: 1980,
    //  stone 0-480 | lava 480-600 (120) | stone 600-1180 | lava 1180-1300 (120) | stone 1300-2040
    ground: [
      [0, 480, 'stone'],
      [480, 600, 'lava'],
      [600, 1180, 'stone'],
      [1180, 1300, 'lava'],
      [1300, 2040, 'stone']
    ],
    walls: [{ x: 820, tiles: 2, mat: 'stone' }],   // 220px after gap-end 600, 360px before gap 1180
    coins: [
      { x: 300, y: 440 }, { x: 380, y: 440 },
      { x: 680, y: 440 }, { x: 960, y: 440 },
      { x: 1420, y: 440 }, { x: 1620, y: 440 },
      { x: 1840, y: 360 }, { x: 1920, y: 440 }
    ],
    enemies: [{ x: 1040, patrol: 60 }]              // between wall 820 and gap 1180 (template shape)
  },
  {
    // Level 3 — "The Vents": showcases the new Studio.Platformer mechanics. Each is
    // placed so the EXISTING gap-jump / run-right autopilot clears it 0-death:
    //   * MUD zone (360-560): footFriction 2.2 -> snappier grip; the bot just runs over it.
    //   * SPRING (x=820) on a long flat stone run: launched ~6 tiles up, it drifts ~210px
    //       right and lands back on the SAME stone slab (no gap within the arc) -> safe.
    //   * MOVING PLATFORM over the lava gap 1180-1300 (120px, w=120, tiny range): it bridges
    //       the gap almost fully, so the bot either RIDES it across or (if it has drifted)
    //       JUMPS the <=140px gap — EITHER outcome lands on stone. groundAhead now also
    //       probes the mover group, so the bot reads it as walkable ground.
    //   * ICE zone (1640-1840): footFriction 0.05 -> glides; entered at full run speed off
    //       stone, it keeps ~maxRun across and steps onto solid stone (NO gap at the end).
    name: 'The Vents', tile: 40, width: 2240, height: 540, groundY: 470, sky: 0x120806,
    spawn: { x: 60, y: 360 }, goal: 2180,
    ground: [
      [0, 360, 'stone'],
      [360, 560, 'mud'],            // trudge zone (continuous, safe)
      [560, 1180, 'stone'],         // long flat run: the spring sits here & its arc lands here
      [1180, 1300, 'lava'],         // GAP bridged by a mover (ride-or-jump, both safe)
      [1300, 1640, 'stone'],        // mover landing + runway
      [1640, 1840, 'ice'],          // glide zone (continuous, solid stone after it)
      [1840, 2240, 'stone']         // final approach to the goal
    ],
    springs: [{ x: 820 }],          // bounce pad on the long stone slab
    movers: [{ x: 1240, y: 452, w: 120, axis: 'x', range: 24, speed: 50, mat: 'stone' }],
    coins: [
      { x: 300, y: 440 }, { x: 460, y: 440 },
      { x: 820, y: 300 }, { x: 820, y: 360 },   // a coin ladder above the spring (reward for the launch)
      { x: 1240, y: 360 }, { x: 1500, y: 440 },
      { x: 1740, y: 440 }, { x: 2040, y: 440 }
    ],
    enemies: [{ x: 980, patrol: 50 }]            // on the flat stone, before the mover gap
  }
];
