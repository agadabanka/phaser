/*
 * Starlance — a vertical space shooter on the Studio SDK (Phaser 4), SHOOTER
 * archetype. The whole game is a Studio.Game.boot() config: waves are data
 * (levels.js), the look is theme tokens. The deadly mechanic — the sweeping-gap
 * bullet curtain — and the deterministic 0-death autopilot live in Studio.Shooter.
 */
(function () {
  'use strict';
  Studio.Game.boot({
    title: 'Starlance',
    slug: 'starlance',
    repo: 'agadabanka/starlance',
    tagline: 'Climb the five veils of the nebula to the Hollow Star.',
    controls: '← → move · auto-fire  (joystick on touch)',
    archetype: 'shooter',
    seed: 'starlance',
    levels: window.LEVELS,
    theme: {
      sky: 0x05030f, cssBg: '#05030f', accent: 0x8af0ff,
      backdrops: 'assets/veil-{i}.jpg',
      ship: 'assets/ship.png', shipW: 46, shipH: 50, shipGlow: 0x8af0ff,
      images: {
        enemy_drone: 'assets/enemy-drone.png', enemy_dart: 'assets/enemy-dart.png',
        enemy_turret: 'assets/enemy-turret.png', boss_art: 'assets/boss.png', powerup: 'assets/powerup.png'
      },
      fireRate: 0.12,
      grade: { saturate: 0.12, brightness: 1.02 }, vignette: 0.4,
      touch: { base: 0x0a1430, baseStroke: 0x8af0ff, thumb: 0x14305a, thumbStroke: 0x8af0ff, btn: 0x1a0830, btnA: 0.5, btnStroke: 0xff6ad6, label: '#cdefff' },
      hud: { color: '#cdefff', stroke: '#0a0420' }, stageWord: 'veil', stagePrefix: 'V',
      music: { url: 'assets/music/drive.mp3', vol: 0.55, fallback: 'proc:cave' },
      menu: { logo: 'assets/menu/logo.png' },
      toasts: { level: 'VEIL {i}  ·  {name}', win: 'THE HOLLOW STAR — RECLAIMED' }
    }
  });
})();
