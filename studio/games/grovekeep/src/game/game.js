/*
 * Grovekeep — an isometric pixel-art FOREST WORLD-BUILDER on the Studio SDK
 * (archetype 'builder'). Gather timber + berries, place structures on the glade
 * grid, and shelter the twenty rootlings. The whole game is data + theme; the
 * runtime is Studio.Builder (built on Studio.Iso + the Studio.UI kit).
 */
(function () {
  'use strict';
  var CHARS = [
    ['fern', 'Fern'], ['bram', 'Bram'], ['moss', 'Elder Moss'], ['pip', 'Pip'], ['wren', 'Wren'],
    ['sorrel', 'Sorrel'], ['alder', 'Alder'], ['hazel', 'Hazel'], ['rowan', 'Rowan'], ['ivy', 'Ivy'],
    ['reed', 'Reed'], ['cob', 'Cob'], ['tansy', 'Tansy'], ['bryn', 'Bryn'], ['nutkin', 'Nutkin'],
    ['bramble', 'Bramble'], ['flick', 'Flick'], ['sage', 'Sage'], ['puddle', 'Puddle'], ['glim', 'Glim']
  ];
  var BLDS = ['hut', 'hall', 'lumbercamp', 'garden', 'storehouse', 'well', 'campfire', 'shrine', 'pine', 'oak'];
  var images = {};
  CHARS.forEach(function (c) { images['char_' + c[0]] = 'assets/char-' + c[0] + '.png'; });
  BLDS.forEach(function (b) { images['bld_' + b] = 'assets/bld-' + b + '.png'; });

  Studio.Game.boot({
    title: 'Grovekeep',
    slug: 'grovekeep',
    repo: 'agadabanka/grovekeep',
    tagline: 'Grow a tiny forest village — gather, build, and shelter the rootlings.',
    controls: 'click a card · click a tile to place · 1-8 quick-select · ESC cancel',
    archetype: 'builder',
    seed: 'grovekeep',
    levels: window.LEVELS,
    theme: {
      sky: 0x16210f, cssBg: '#16210f',
      gridW: 12, gridH: 7, structH: 74, charH: 40, decorH: 86,
      backdrops: 'assets/glade-{i}.png',
      images: images,
      roster: CHARS.map(function (c) { return { key: 'char_' + c[0], name: c[1] }; }),
      palette: ['hut', 'lumbercamp', 'garden', 'well', 'storehouse', 'campfire', 'shrine', 'hall'],
      ui: { bg: 0x1c2616, border: 0x6fae4e, border2: 0x2e4420, text: '#e8f4d8', sub: '#a8c890', accent: 0xffd166 },
      vignette: 0.35,
      shell: { base: 0x1c2616, border: '#6fae4e', text: '#e8f4d8', accent: '#ffd166' },
      music: { url: 'assets/music/glade-1.mp3', vol: 0.5, fallback: 'proc:meadow' },
      musicByLevel: [
        'assets/music/glade-1.mp3', 'assets/music/glade-2.mp3', 'assets/music/glade-3.mp3',
        'assets/music/glade-4.mp3', 'assets/music/glade-5.mp3'
      ],
      menu: { logo: 'assets/menu/logo.png' },
      toasts: { level: 'GLADE {i}  ·  {name}', win: 'THE GROVE THRIVES' }
    }
  });
})();
