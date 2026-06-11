/*
 * Roadwar Iso — an ISOMETRIC car RTS on the Studio SDK (archetype 'isorts').
 * Reuses the deterministic economy + combat + win-by-construction of the top-down
 * RTS, on a freer continuous-front battlefield drawn in perspective iso. The whole
 * game is data + theme; the runtime is Studio.IsoRTS (built on Studio.Iso).
 */
(function () {
  'use strict';
  Studio.Game.boot({
    title: 'Roadwar Iso',
    slug: 'roadwar-iso',
    repo: 'agadabanka/roadwar-iso',
    tagline: 'Build your convoy, crush the warlord — now in isometric 2.5D.',
    controls: 'click the field to deploy · 1/2/3 pick a car · 4 refinery',
    archetype: 'isorts',
    seed: 'roadwar-iso',
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
      music: { url: 'assets/music/ground-1.mp3', vol: 0.55, fallback: 'proc:cave' },
      musicByLevel: [
        'assets/music/ground-1.mp3', 'assets/music/ground-2.mp3', 'assets/music/ground-3.mp3',
        'assets/music/ground-4.mp3', 'assets/music/ground-5.mp3'
      ],
      menu: { logo: 'assets/menu/logo.png' },
      toasts: { level: 'GROUND {i}  ·  {name}', win: 'THE ROAD IS YOURS' }
    }
  });
})();
