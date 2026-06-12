/* Grovekeep — levels are data (the Studio Builder DSL). Five GLADES, each a
 * settlement scenario: start resources + income, a GOAL (population / stockpile
 * / a landmark), pre-placed forest decor, and the autopilot PLAN — a build order
 * that provably reaches the goal (the win-by-construction the lint checks:
 * the plan is affordable under base income and its effects satisfy the goal).
 *   { name, sky, start:{timber,food}, income:{timber,food}, startPop, popEvery,
 *     goal:{pop|timber|built}, decor:[{kind,g:[gx,gy]}], plan:[{build,g:[gx,gy]}] }
 * Grid is 12×7. Decor occupies cells; plans avoid them.
 */
window.LEVELS = [
  {
    // G1 — TEACH: food → shelter → rootlings join. A gentle dawn.
    name: 'Dawn Meadow', sky: 0x2a3a1c,
    start: { timber: 30, food: 10 }, income: { timber: 1.3, food: 0.6 }, startPop: 2, popEvery: 4,
    goal: { pop: 5 },
    decor: [
      { kind: 'pine', g: [0, 0] }, { kind: 'oak', g: [11, 0] }, { kind: 'pine', g: [11, 6] }, { kind: 'oak', g: [0, 6] }
    ],
    plan: [
      { build: 'garden', g: [4, 3] },
      { build: 'hut', g: [6, 3] },
      { build: 'hut', g: [7, 4] }
    ]
  },
  {
    // G2 — INDUSTRY: lumber camps; stockpile timber.
    name: 'Fern Hollow', sky: 0x1e3018,
    start: { timber: 24, food: 12 }, income: { timber: 1.6, food: 0.5 }, startPop: 3, popEvery: 4,
    goal: { timber: 120 },
    decor: [
      { kind: 'pine', g: [1, 1] }, { kind: 'pine', g: [2, 0] }, { kind: 'oak', g: [10, 1] }, { kind: 'pine', g: [10, 5] }
    ],
    plan: [
      { build: 'lumbercamp', g: [3, 3] },
      { build: 'lumbercamp', g: [8, 3] }
    ]
  },
  {
    // G3 — A LANDMARK: balance two resources to raise the Sun Shrine.
    name: 'Riverbend', sky: 0x1c3424,
    start: { timber: 30, food: 8 }, income: { timber: 1.4, food: 0.5 }, startPop: 3, popEvery: 4,
    goal: { built: 'shrine' },
    decor: [
      { kind: 'oak', g: [0, 3] }, { kind: 'pine', g: [1, 5] }, { kind: 'pine', g: [11, 2] }, { kind: 'oak', g: [10, 6] }
    ],
    plan: [
      { build: 'garden', g: [4, 4] },
      { build: 'lumbercamp', g: [7, 2] },
      { build: 'shrine', g: [6, 4] }
    ]
  },
  {
    // G4 — A VILLAGE: many mouths; gardens before huts.
    name: 'Mushroom Dell', sky: 0x241a30,
    start: { timber: 34, food: 12 }, income: { timber: 1.5, food: 0.5 }, startPop: 2, popEvery: 3.5,
    goal: { pop: 9 },
    decor: [
      { kind: 'pine', g: [0, 1] }, { kind: 'oak', g: [11, 1] }, { kind: 'pine', g: [11, 5] }, { kind: 'oak', g: [1, 6] }
    ],
    plan: [
      { build: 'garden', g: [3, 3] },
      { build: 'garden', g: [8, 3] },
      { build: 'hut', g: [4, 4] },
      { build: 'hut', g: [6, 4] },
      { build: 'campfire', g: [5, 3] },
      { build: 'hut', g: [7, 5] }
    ]
  },
  {
    // G5 — THE FINALE: raise the Great Oak Hall in the ancient heartwood.
    name: 'Ancient Heartwood', sky: 0x32260e,
    start: { timber: 36, food: 12 }, income: { timber: 1.7, food: 0.6 }, startPop: 4, popEvery: 4,
    goal: { built: 'hall' },
    decor: [
      { kind: 'oak', g: [0, 0] }, { kind: 'oak', g: [11, 0] }, { kind: 'pine', g: [0, 5] }, { kind: 'pine', g: [11, 6] }, { kind: 'oak', g: [5, 1] }
    ],
    plan: [
      { build: 'lumbercamp', g: [3, 3] },
      { build: 'garden', g: [8, 4] },
      { build: 'lumbercamp', g: [9, 2] },
      { build: 'hall', g: [5, 3] }
    ]
  }
];
