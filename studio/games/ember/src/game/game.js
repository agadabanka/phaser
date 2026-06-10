/*
 * Ember Depths — a lava-cave platformer on the Studio SDK (Phaser 4).
 *
 * RFC-001: the game is now a Studio.Game.boot() CONFIG — levels are data
 * (levels.js), the look is theme tokens, and the only code this file owns is
 * the molten-cave flavor (the signature ember updraft off the lava line).
 * Everything else (eval contract, autopilot, theming overlays, HUD, shell,
 * touch, music bed, win/death rules) is the SDK's single implementation.
 */
(function () {
  'use strict';
  Studio.Game.boot({
    title: 'Ember Depths',
    slug: 'ember-depths',
    tagline: "Hop the lava, ride the embers — descend the molten cave.",
    controls: "← → move · SPACE jump · stomp foes  (joystick on touch)",
    archetype: 'runner',
    gravity: 1300,
    seed: 'ember-depths',
    levels: window.LEVELS,
    theme: {
      sky: 0x140a08, cssBg: '#140a08', accent: 0xffd27a,
      bgImage: 'assets/backdrop.jpg',
      bakeKit: { hero: 0xffb24a, enemy: 0xff5a3c, goal: 0xffce5a },
      particle: { key: 'ember', halo: 0xff7a18, core: 0xffd27a, ambientScale: 0.7 },
      kitFiles: {
        kit_stone: 'assets/kit/kit_stone.jpg', kit_mud: 'assets/kit/kit_mud.jpg',
        kit_ice: 'assets/kit/kit_ice.jpg', kit_lava: 'assets/kit/kit_lava.jpg',
        kit_coin: 'assets/kit/kit_coin.png', kit_spring: 'assets/kit/kit_spring.png', kit_goal: 'assets/kit/kit_goal.png'
      },
      matTex: { stone: 'kit_stone', mud: 'kit_mud', ice: 'kit_ice', _default: 'kit_stone', _fragile: 'kit_stone' },
      hazardTex: 'kit_lava', tileScale: 0.35,
      lip: { color: 0xff9a3c, alpha: 0.5, perMat: { ice: { color: 0xbfe8ff, alpha: 0.35 } } },
      coinArt: { key: 'kit_coin', h: 26 }, springArt: { key: 'kit_spring', h: 46 }, goalArt: { key: 'kit_goal', h: 96 },
      hero: {
        sheet: 'assets/hero_sheet.png', fw: 288, fh: 338,
        anims: { run: [0, 5, 14], idle: 6, jump: 7, total: 8 },
        fallback: 'assets/hero.png', scale: 64, glow: 0xffc868
      },
      enemy: { img: 'assets/enemy.png', h: 50 }, enemyBurst: 0xff5a3c,
      fragileTint: 0xc8a888, fragileArmTint: 0x8a5a3c, fragileBurst: 0x8a5a2b,
      grade: { brightness: 0.9, saturate: 0.16, hue: -6 }, vignette: 0.62,
      touch: { base: 0x140a08, baseStroke: 0xffb24a, thumb: 0x3a1a0c, thumbStroke: 0xff7a18, btn: 0x2a120a, btnA: 0.55, btnStroke: 0xff9a3c, label: '#ffd9a0' },
      hud: { color: '#ffd9a0', stroke: '#2a120a' }, stageWord: 'depth', stagePrefix: 'D',
      music: { url: 'assets/music/cave.mp3', vol: 0.6, fallback: 'proc:cave' },
      toasts: { level: 'DEPTH {i}  ·  {name}', win: 'THE CORE — CLEARED' }
    },
    hooks: {
      // the signature cave look: a steady updraft of embers rising off the lava line
      onLevelLoaded: function (scene, world, spec, h) {
        try {
          var up = scene.add.particles(0, spec.groundY - 2, h.particle, {
            x: { min: 0, max: spec.width },
            lifespan: 2600, speedY: { min: -70, max: -28 }, speedX: { min: -10, max: 10 },
            scale: { start: 0.9, end: 0 }, alpha: { start: 0.55, end: 0 },
            quantity: 1, frequency: 90, blendMode: 'ADD'
          });
          h.decor.push(up);
        } catch (e) {}
      }
    }
  });
})();
