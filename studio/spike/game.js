/*
 * Studio spike — a minimal Phaser 4 platformer slice that proves the
 * AI-eval harness ports cleanly from the (Phaser 3) the-platformer lineage.
 *
 * It establishes three conventions that become the Studio SDK in Phase 1:
 *   1. window.__rec  — a deterministic fixed-1/60 stepper (byte-exact eval/video)
 *   2. window.__game — a semantic observability bridge (snapshot + control)
 *   3. a legible, hand-written autopilot (the 0-death gate driver)
 *
 * Renderer is selectable via ?r=webgl|canvas so the eval can prove headless
 * pixel readback on both pipelines.
 */
(function () {
  'use strict';

  // ---- world constants ----
  var W = 960, H = 540, TILE = 40;
  var GROUND_Y = 470;          // y of the ground's top surface
  var SPEED = 220, JUMP_V = -600, GRAV = 1300;
  var START = { x: 60, y: 360 };
  var GOAL_X = 905;
  var SEGMENTS = [[0, 380], [500, 960]];   // a 120px gap from 380..500
  var WALL = { x: 640, tiles: 2 };         // a 2-tile wall to hop, on solid ground

  // ---- mutable state ----
  var scene, player, platforms, goalImg;
  var input = { left: false, right: false, jump: false };
  var auto = false, jumpLatch = false;
  var deaths = 0, won = false, frame = 0;

  function makeTextures(s) {
    var g = s.add.graphics();
    g.fillStyle(0x3a5a40, 1).fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x588157, 1).fillRect(0, 0, TILE, 6);
    g.generateTexture('ground', TILE, TILE); g.clear();
    g.fillStyle(0x6b705c, 1).fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x8a8d7a, 1).fillRect(0, 0, TILE, 5);
    g.generateTexture('wall', TILE, TILE); g.clear();
    g.fillStyle(0xffd166, 1).fillRect(0, 0, 28, 36);
    g.fillStyle(0x222222, 1).fillRect(19, 7, 5, 5);
    g.generateTexture('hero', 28, 36); g.clear();
    g.fillStyle(0x06d6a0, 1).fillRect(0, 0, 16, 80);
    g.generateTexture('goal', 16, 80); g.clear();
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8); g.destroy();
  }

  function buildWorld(s) {
    platforms = s.physics.add.staticGroup();
    SEGMENTS.forEach(function (seg) {
      for (var x = seg[0]; x < seg[1]; x += TILE) {
        for (var y = GROUND_Y; y < H; y += TILE) {
          platforms.create(x + TILE / 2, y + TILE / 2, 'ground');
        }
      }
    });
    for (var i = 0; i < WALL.tiles; i++) {
      platforms.create(WALL.x + TILE / 2, GROUND_Y - TILE / 2 - i * TILE, 'wall');
    }
    goalImg = s.add.image(GOAL_X, GROUND_Y - 40, 'goal');
  }

  // a legible autopilot: run right; hop walls and gaps using a forward probe
  function drive(onGround) {
    var out = { left: false, right: true, jump: false };
    var probeX = player.x + 26, footY = player.y + 22, groundAhead = false;
    var kids = platforms.getChildren();
    for (var k = 0; k < kids.length; k++) {
      var c = kids[k]; if (!c || !c.body) continue;
      var b = c.body;
      if (probeX >= b.left - 2 && probeX <= b.right + 2 && b.top >= footY - 6 && b.top <= footY + TILE) {
        groundAhead = true; break;
      }
    }
    var blockedRight = player.body.blocked.right || player.body.touching.right;
    if (onGround && (!groundAhead || blockedRight)) out.jump = true;
    return out;
  }

  function respawn() {
    player.setVelocity(0, 0);
    player.setPosition(START.x, START.y);
    jumpLatch = false;
  }

  var Play = {
    key: 'Play',
    create: function () {
      scene = this;
      this.cameras.main.setBackgroundColor(0x1d2b53);
      makeTextures(this);
      buildWorld(this);

      player = this.physics.add.sprite(START.x, START.y, 'hero');
      this.physics.add.collider(player, platforms);

      // juice #1: ambient drifting particles (proves the Phaser 4 emitter renders)
      try {
        this.add.particles(0, 0, 'dot', {
          x: { min: 0, max: W }, y: -8, lifespan: 4500,
          speedY: { min: 18, max: 55 }, scale: { start: 0.7, end: 0 },
          alpha: { start: 0.45, end: 0 }, quantity: 1, frequency: 110, blendMode: 'ADD'
        });
      } catch (e) { /* emitter API guard */ }

      // juice #2: a pulsing goal tween
      this.tweens.add({ targets: goalImg, scaleX: 1.7, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });

      window.__ready = true;
    },
    update: function () {
      if (!player) return;
      frame++;
      var b = player.body;
      var onGround = b.blocked.down || b.touching.down;

      var mv = auto ? drive(onGround) : input;
      if (mv.left) { player.setVelocityX(-SPEED); player.setFlipX(true); }
      else if (mv.right) { player.setVelocityX(SPEED); player.setFlipX(false); }
      else { player.setVelocityX(0); }

      if (mv.jump && onGround && !jumpLatch) { player.setVelocityY(JUMP_V); jumpLatch = true; }
      if (!mv.jump) jumpLatch = false;

      if (!won && player.x >= GOAL_X - 8) won = true;
      if (player.y > H + 80) { deaths++; respawn(); }
    }
  };

  // ---- deterministic stepper: the byte-exact eval clock ----
  window.__rec = {
    on: false, t: 0, dt: 1000 / 60,
    begin: function () { if (this.on) return; window.game.loop.sleep(); this.on = true; this.t = 1000; },
    step: function (n) { n = n || 1; for (var i = 0; i < n; i++) { this.t += this.dt; window.game.step(this.t, this.dt); } },
    end: function () { if (!this.on) return; this.on = false; window.game.loop.wake(); }
  };

  // ---- observability bridge: semantic snapshot + programmatic control ----
  window.__game = {
    ready: function () { return !!window.__ready; },
    snapshot: function () {
      return {
        x: Math.round(player.x), y: Math.round(player.y),
        vx: Math.round(player.body.velocity.x), vy: Math.round(player.body.velocity.y),
        onGround: !!(player.body.blocked.down || player.body.touching.down),
        deaths: deaths, won: won, frame: frame, goalX: GOAL_X
      };
    },
    setInput: function (o) { input = Object.assign({ left: false, right: false, jump: false }, o || {}); },
    autopilot: function (on) { auto = !!on; input = { left: false, right: false, jump: false }; },
    reset: function () { deaths = 0; won = false; frame = 0; auto = false; jumpLatch = false; input = { left: false, right: false, jump: false }; respawn(); }
  };

  // synchronous eval helpers (run inside a single page.evaluate, no RAF interleave)
  window.__run = function (n) { window.__game.reset(); window.__game.autopilot(true); window.__rec.begin(); window.__rec.step(n); return window.__game.snapshot(); };
  window.__gate = function (maxF) {
    window.__game.reset(); window.__game.autopilot(true); window.__rec.begin();
    var s = window.__game.snapshot();
    while (!s.won && s.frame < maxF) { window.__rec.step(1); s = window.__game.snapshot(); }
    return s;
  };

  // ---- boot ----
  var config = {
    type: Phaser.AUTO, width: W, height: H, backgroundColor: '#1d2b53',
    seed: ['studio-spike'],
    render: { preserveDrawingBuffer: true, pixelArt: true },
    physics: { default: 'arcade', arcade: { gravity: { y: GRAV }, debug: false } },
    scene: [Play]
  };
  var r = new URLSearchParams(location.search).get('r');
  if (r === 'canvas') config.type = Phaser.CANVAS;
  else if (r === 'webgl') config.type = Phaser.WEBGL;

  window.game = new Phaser.Game(config);
})();
