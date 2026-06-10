/*
 * Studio game-template — RFC-001: a game is DATA + a theme + (optionally) hooks.
 * All runtime glue (world build, autopilot/eval contract, HUD, shell, touch,
 * win/death rules) lives in Studio.Game.boot — vendored studio.js, one impl.
 */
(function () {
  'use strict';
  Studio.Game.boot({
    title: 'Studio Template',
    slug: 'template',
    tagline: "A Studio game.",
    controls: "← → move · SPACE jump",
    archetype: 'runner',
    gravity: 1300,
    seed: 'studio-template',
    levels: window.LEVELS,
    theme: {
      sky: 0x101018,
      bakeKit: { hero: 0x7ad6a0, enemy: 0xd66a7a, goal: 0xffd34d },
      particle: { key: 'spark', halo: 0x9ad6ff, core: 0xffffff },
      hud: { color: '#e7edf6', stroke: '#10141c' },
      toasts: { level: 'STAGE {i} · {name}', win: 'COURSE CLEAR' }
    }
  });
})();
