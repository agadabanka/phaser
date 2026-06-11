/*
 * Roadwar — a toon car lane-push RTS on the Studio SDK (Phaser 4), RTS archetype.
 * The whole game is a Studio.Game.boot() config: battlegrounds + economy are
 * data (levels.js), the look is theme tokens. Deterministic lane combat and the
 * win-by-construction autopilot (all-in on the rally lane) live in Studio.RTS.
 */
(function () {
  'use strict';
  Studio.Game.boot({
    title: 'Roadwar',
    slug: 'roadwar',
    repo: 'agadabanka/roadwar',
    tagline: 'Build your convoy, crush the warlord — a toon car RTS.',
    controls: 'click a lane · 1/2/3 build cars · take the fortress',
    archetype: 'rts',
    seed: 'roadwar',
    levels: window.LEVELS,
    theme: {
      sky: 0x1a160f, cssBg: '#1a160f', accent: 0xffcc44,
      backdrops: 'assets/ground-{i}.jpg',
      images: {
        car_scout: 'assets/car-scout.png', car_brawler: 'assets/car-brawler.png', car_gunner: 'assets/car-gunner.png',
        enemy_scout: 'assets/enemy-scout.png', enemy_brawler: 'assets/enemy-brawler.png', enemy_gunner: 'assets/enemy-gunner.png', enemy_warlord: 'assets/enemy-warlord.png',
        garage_art: 'assets/garage.png', fortress_art: 'assets/fortress.png', depot_art: 'assets/depot.png'
      },
      grade: { saturate: 0.16, brightness: 1.02 }, vignette: 0.4,
      shell: { base: 0x241a0c, border: '#ffcc44', text: '#ffe7a0', accent: '#ff9a3c' },
      hud: { color: '#ffe7a0', stroke: '#1a1208' }, stageWord: 'ground',
      music: { url: 'assets/music/anthem.mp3', vol: 0.55, fallback: 'proc:cave' },
      menu: { logo: 'assets/menu/logo.png' },
      toasts: { level: 'GROUND {i}  ·  {name}', win: "THE ROAD IS YOURS" }
    }
  });
})();
