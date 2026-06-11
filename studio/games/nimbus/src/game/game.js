/*
 * Nimbus Climb — a sky-climbing platformer on the Studio SDK (Phaser 4),
 * VERTICAL archetype. The whole game is a Studio.Game.boot() config: levels are
 * data (levels.js), the look is theme tokens, and the only code here is the
 * sky flavor (a drifting layer of foreground cloud-wisps).
 */
(function () {
  'use strict';
  Studio.Game.boot({
    title: 'Nimbus Climb',
    slug: 'nimbus-climb',
    repo: 'agadabanka/nimbus-climb',
    tagline: "Ride the updrafts, dodge the storms — climb the sky to the Sun Bell.",
    controls: "← → move · SPACE jump · ride the wind  (joystick on touch)",
    archetype: 'vertical',
    gravity: 1300,
    seed: 'nimbus-climb',
    levels: window.LEVELS,
    theme: {
      sky: 0x8fb4e4, cssBg: '#8fb4e4', accent: 0xffe7a8,
      bgImage: 'assets/backdrop.jpg',
      bakeKit: { hero: 0xeaf2ff, enemy: 0x46527a, goal: 0xffd34d },
      particle: { key: 'glint', halo: 0xfff0c8, core: 0xffffff, ambientScale: 0.7 },
      kitFiles: {
        kit_cloud: 'assets/kit/kit_cloud.jpg', kit_mist: 'assets/kit/kit_mist.jpg',
        kit_crystal: 'assets/kit/kit_crystal.jpg', kit_storm: 'assets/kit/kit_storm.jpg',
        kit_coin: 'assets/kit/kit_coin.png', kit_spring: 'assets/kit/kit_spring.png', kit_goal: 'assets/kit/kit_goal.png',
        // per-level painted skies (issues #1/#2) — kitFiles doubles as the
        // generic image loader; each level declares its key via spec.bg and
        // the onLevelLoaded hook below swaps the backdrop.
        bg_lv1: 'assets/backdrop-1.jpg', bg_lv2: 'assets/backdrop-2.jpg', bg_lv3: 'assets/backdrop-3.jpg',
        bg_lv4: 'assets/backdrop-4.jpg', bg_lv5: 'assets/backdrop-5.jpg'
      },
      matTex: { cloud: 'kit_cloud', mist: 'kit_mist', crystal: 'kit_crystal', _default: 'kit_cloud', _fragile: 'kit_mist' },
      hazardTex: 'kit_storm', tileScale: 0.4,
      lip: { color: 0xfff4d8, alpha: 0.5, perMat: { crystal: { color: 0xcce6ff, alpha: 0.45 }, mist: { color: 0xd8e6ff, alpha: 0.3 } } },
      coinArt: { key: 'kit_coin', h: 26 }, springArt: { key: 'kit_spring', h: 48 }, goalArt: { key: 'kit_goal', h: 104 },
      hero: {
        sheet: 'assets/hero_sheet.png', fw: 354, fh: 354,
        anims: { run: [0, 5, 14], idle: 6, jump: 7, total: 8 },
        fallback: 'assets/hero.png', scale: 66, glow: 0xfff0c8
      },
      enemy: { img: 'assets/enemy.png', h: 48 }, enemyBurst: 0x9fb6e6,
      fragileTint: 0xdfe9f5, fragileArmTint: 0xb8c9e6, fragileBurst: 0xc9d6ee,
      updraftTint: 0xbfe8ff,
      grade: { brightness: 1.06, saturate: 0.06, hue: 4 }, vignette: 0.34,
      touch: { base: 0x24355a, baseStroke: 0xbfe8ff, thumb: 0x2a3556, thumbStroke: 0xfff0c8, btn: 0x24355a, btnA: 0.5, btnStroke: 0xbfe8ff, label: '#eaf2ff' },
      hud: { color: '#fff4e0', stroke: '#2a3556' }, stageWord: 'cloud', stagePrefix: 'C',
      music: { url: 'assets/music/sky.mp3', vol: 0.6, fallback: 'proc:cave' },
      // a distinct Lyria score per cloud (issue #5) — the SDK cross-fades on
      // level change via Studio.levelMusic; sky.mp3 stays the menu/fallback bed.
      musicByLevel: [
        'assets/music/level-1.mp3', 'assets/music/level-2.mp3', 'assets/music/level-3.mp3',
        'assets/music/level-4.mp3', 'assets/music/level-5.mp3'
      ],
      menu: { logo: 'assets/menu/logo.png', shots: 'assets/menu/level-{i}.jpg' },
      toasts: { level: 'CLOUD {i}  ·  {name}', win: 'THE SUN BELL RINGS' },
      vxHeadroom: 130
    },
    hooks: {
      // per-level painted sky (issues #1/#2): each level's spec.bg names a
      // backdrop texture (loaded via kitFiles); it draws OVER the shared
      // bg_main at depth -99 and lives in h.decor so loadLevel tears it down.
      // spec.bgTint casts the level's mood (golden dawn -> storm slate).
      // Plus the original drifting foreground cloud-wisps for depth.
      onLevelLoaded: function (scene, world, spec, h) {
        try {
          if (spec.bg && scene.textures.exists(spec.bg)) {
            var bg = scene.add.image(480, 270, spec.bg)
              .setScrollFactor(0).setDepth(-99).setDisplaySize(960, 540);
            if (spec.bgTint != null) bg.setTint(spec.bgTint);
            h.decor.push(bg);
          }
        } catch (e) {}
        try {
          var drift = scene.add.particles(0, 0, h.particle, {
            x: { min: 0, max: spec.width }, y: { min: 0, max: spec.height },
            lifespan: 5200, speedX: { min: 8, max: 26 }, speedY: { min: -6, max: 6 },
            scale: { start: 0.5, end: 0 }, alpha: { start: 0.18, end: 0 },
            quantity: 1, frequency: 240, blendMode: 'ADD'
          });
          drift.setDepth(-50); h.decor.push(drift);
        } catch (e) {}
      }
    }
  });
})();
