/*
 * Ember Depths — a lava-cave platformer on the Studio SDK (Phaser 4).
 *
 * Art Direction (molten cave):
 *   - warm, darkened ColorMatrix grade + vignette for cavern depth (Studio.Juice)
 *   - cave-stone + glowing-lava materials (Studio.Materials), warm hero/enemy palette
 *   - drifting orange EMBER ambient particles + an updraft of embers off the lava,
 *     and a glow on the hero
 * FX:
 *   - ember bursts on coin pickup and on stomp, camera shake on stomp/land,
 *     a warm flash on win — all via Studio.Juice, inert-until-fired (determinism safe).
 * Levels:
 *   - 2 authored levels (levels.js). Lava is a deadly GAP; the gap-jump autopilot clears
 *     it. The run chains level 1 -> level 2; the gate is GREEN only if BOTH are 0-death.
 *
 * Eval contract is intact: harness.install sets window.__ready; __run/__gate work;
 * wall detection uses body.blocked.right ONLY.
 */
(function () {
  'use strict';
  // Physics contract — MUST match levels.js geometry assumptions.
  var T = 40, SPEED = 220, JUMP_V = -600, GRAV = 1300;
  var scene, player, world, spawn, levelGoalX = 0;
  var input = { left: false, right: false, jump: false };
  var auto = false, jumpLatch = false;
  var deaths = 0, won = false, frame = 0, coins = 0, lastDeathX = 0, maxX = 0;
  var levelIndex = 0;                 // which LEVELS[] entry is live
  var colliders = [];                 // physics colliders/overlaps to tear down on rebuild
  var decor = [];                     // goal image + ambient emitters to destroy on rebuild
  var landGuard = false;             // edge-trigger for landing shake

  function sense(onGround) {
    var probeX = player.x + 26, footY = player.y + 22;
    var groundAhead = Studio.Autopilot.groundAt(world.platforms, probeX, footY, T);
    var blockedRight = player.body.blocked.right; // solid walls only (overlaps set touching.*)
    var enemyAhead = false;
    world.enemies.getChildren().forEach(function (e) {
      if (e.active && e.x > player.x && e.x - player.x < 64 && Math.abs(e.y - player.y) < 52) enemyAhead = true;
    });
    return { onGround: onGround, groundAhead: groundAhead, blockedRight: blockedRight, enemyAhead: enemyAhead, x: player.x, goalX: levelGoalX };
  }

  function snapshot() {
    return {
      x: Math.round(player.x), y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x), vy: Math.round(player.body.velocity.y),
      onGround: !!(player.body.blocked.down || player.body.touching.down),
      deaths: deaths, dead: deaths > 0, won: won, frame: frame, coins: coins, goalX: levelGoalX,
      level: levelIndex, lastDeathX: lastDeathX, maxX: Math.round(maxX)
    };
  }

  // An updraft of embers rising from the lava/floor line — the signature cave look.
  function emberUpdraft(spec) {
    try {
      return scene.add.particles(0, spec.groundY - 2, 'ember', {
        x: { min: 0, max: spec.width },
        lifespan: 2600, speedY: { min: -70, max: -28 }, speedX: { min: -10, max: 10 },
        scale: { start: 0.9, end: 0 }, alpha: { start: 0.55, end: 0 },
        quantity: 1, frequency: 90, blendMode: 'ADD'
      });
    } catch (e) {}
  }

  // Build (or rebuild) the live world from LEVELS[i] and (re)wire all physics callbacks.
  function loadLevel(i) {
    var spec = window.LEVELS[i];
    levelIndex = i;
    // tear down any previous world + decor + colliders (idempotent for determinism)
    colliders.forEach(function (c) { try { c.destroy(); } catch (e) {} }); colliders = [];
    decor.forEach(function (d) { try { d.destroy(); } catch (e) {} }); decor = [];
    if (world) {
      ['platforms', 'hazards', 'coins', 'enemies'].forEach(function (k) {
        try { world[k].clear(true, true); } catch (e) {}
        try { world[k].destroy(true); } catch (e) {}
      });
    }

    scene.cameras.main.setBackgroundColor(spec.sky || 0x140a08);
    world = Studio.Level.build(scene, spec);
    spawn = world.spawn; levelGoalX = world.goalX;

    // glowing exit gate
    decor.push(scene.add.image(levelGoalX, spec.groundY - 42, 'goal'));

    // re-point the camera at the (possibly wider) new world
    Studio.Cam.follow(scene, player, { bounds: [0, 0, spec.width, spec.height], deadzone: [260, 200] });
    scene.cameras.main.centerOn(spawn.x, spawn.y);

    // ambient embers: drifting motes (named SDK API) + a rising updraft off the lava
    var motes = Studio.Juice.ambient(scene, spec.width, { texture: 'ember', y: -8, scale: 0.7 });
    if (motes) decor.push(motes);
    var up = emberUpdraft(spec);
    if (up) decor.push(up);

    // (re)wire collisions against the freshly built groups
    colliders.push(scene.physics.add.collider(player, world.platforms));
    colliders.push(scene.physics.add.overlap(player, world.coins, function (p, c) {
      c.disableBody(true, true); coins++; Studio.Audio.sfx('coin');
      Studio.Juice.burst(scene, c.x, c.y, { texture: 'ember', n: 10, tint: 0xffcc33, life: 380, spMax: 160 });
      hud();
    }));
    colliders.push(scene.physics.add.overlap(player, world.hazards, function () { die(); }));
    colliders.push(scene.physics.add.overlap(player, world.enemies, function (p, e) {
      if (!e.active) return;
      if (p.body.velocity.y > 40 && p.y < e.y - 6) { // stomp from above
        e.disableBody(true, true); p.setVelocityY(-380); Studio.Audio.sfx('stomp');
        Studio.Juice.squash(scene, p); Studio.Juice.shake(scene, 90, 0.006);
        Studio.Juice.burst(scene, e.x, e.y, { texture: 'ember', n: 12, tint: 0xff5a3c, life: 420 });
      } // side contact is non-lethal (a design choice, mirrors the template)
    }));

    player.setVelocity(0, 0);
    player.setPosition(spawn.x, spawn.y);
  }

  function reset() {
    deaths = 0; won = false; frame = 0; coins = 0; auto = false; jumpLatch = false; landGuard = false;
    loadLevel(0);             // always restart the chain at level 1 (deterministic)
    hud();
  }
  function respawn() { player.setVelocity(0, 0); player.setPosition(spawn.x, spawn.y); jumpLatch = false; }
  function die() { deaths++; lastDeathX = Math.round(player.x); respawn(); }
  function hud() { if (scene._hud) scene._hud.setText('coins ' + coins + '   depth ' + (levelIndex + 1) + '/' + window.LEVELS.length); }

  var Play = {
    key: 'Play',
    create: function () {
      scene = this;
      Studio.Textures.kit(this, { tile: T, hero: 0xffb24a, enemy: 0xff5a3c, goal: 0x39d98a });
      // a warm ember particle (orange core, soft falloff) for ambient + bursts
      Studio.Textures.bake(this, 'ember', 10, 10, function (g) {
        g.fillStyle(0xff7a18, 1).fillCircle(5, 5, 5);
        g.fillStyle(0xffd27a, 1).fillCircle(5, 5, 2.4);
      });
      // molten-cave backdrop: warm gradient sky + parallax cavern silhouettes
      Studio.Backdrop(this, { top: 0x3a1410, bottom: 0x0e0606, worldWidth: 4200, layers: [
        { color: 0x231009, scroll: 0.2, amp: 120, step: 210, y: 360 },
        { color: 0x3a1812, scroll: 0.45, amp: 80, step: 130, y: 430 }
      ] });

      // player exists before loadLevel so colliders can bind to it
      player = this.physics.add.sprite(60, 360, 'hero');

      // ---- Art Direction: molten-cave grade + vignette (WebGL filters; canvas no-ops) ----
      // Warm push (more red, less blue) + slight darkening for a cavern mood.
      Studio.Juice.grade(this, function (cm) {
        try {
          cm.brightness(0.9);     // 1 = neutral; <1 darkens the cavern
          cm.saturate(0.16);      // 0 = neutral; >0 enriches the embers/lava
          cm.hue(-6);             // small warm rotation
        } catch (e) {
          try { cm.set([1.12, 0.02, 0.0, 0, -3, 0.04, 0.95, 0.0, 0, 0, 0.0, 0.0, 0.78, 0, 0, 0, 0, 0, 1, 0]); } catch (e2) {}
        }
      });
      Studio.Juice.vignette(this, 0.62);
      Studio.Juice.glow(player, 0xffb24a, 3);

      loadLevel(0);

      scene._hud = this.add.text(12, 10, '', { fontFamily: 'monospace', fontSize: '18px', color: '#ffd9a0' }).setScrollFactor(0).setDepth(100);
      hud();
      this.cursors = this.input.keyboard.createCursorKeys();

      Studio.harness.install(window.game, {
        snapshot: snapshot,
        setInput: function (o) { input = Object.assign({ left: false, right: false, jump: false }, o || {}); },
        autopilot: function (on) { auto = !!on; input = { left: false, right: false, jump: false }; },
        reset: reset
      });
      window.__sense = function () { var og = player.body.blocked.down || player.body.touching.down; var s = sense(og); s.decision = Studio.Autopilot.platformer(s); return s; };
    },
    update: function () {
      if (!player) return; frame++;
      if (player.x > maxX) maxX = player.x;
      var b = player.body, onGround = b.blocked.down || b.touching.down;

      // landing shake (edge-triggered: only when transitioning air -> ground)
      if (onGround && !landGuard) { landGuard = true; Studio.Juice.shake(scene, 60, 0.004); }
      if (!onGround) landGuard = false;

      var mv;
      if (auto) {
        var sn = sense(onGround); mv = Studio.Autopilot.platformer(sn);
        if (window.__trace) window.__trace.push({ f: frame, lvl: levelIndex, x: Math.round(player.x), g: onGround ? 1 : 0, gA: sn.groundAhead ? 1 : 0, bR: sn.blockedRight ? 1 : 0, eA: sn.enemyAhead ? 1 : 0, J: mv.jump ? 1 : 0 });
      } else mv = manual();

      if (mv.left) { player.setVelocityX(-SPEED); player.setFlipX(true); }
      else if (mv.right) { player.setVelocityX(SPEED); player.setFlipX(false); }
      else player.setVelocityX(0);
      if (mv.jump && onGround && !jumpLatch) { player.setVelocityY(JUMP_V); jumpLatch = true; Studio.Audio.sfx('jump'); }
      if (!mv.jump) jumpLatch = false;

      world.enemies.getChildren().forEach(function (e) {
        if (!e.active) return; e.x += e.dir * 0.6; if (Math.abs(e.x - e.homeX) > e.patrol) e.dir *= -1;
      });

      // reaching a level's exit: descend to the next depth, or WIN on the last.
      if (!won && player.x >= levelGoalX - 8) {
        if (levelIndex < window.LEVELS.length - 1) {
          Studio.Audio.sfx('win'); Studio.Juice.flash(scene, 140, 255, 150, 60);
          loadLevel(levelIndex + 1); jumpLatch = false; landGuard = false;
        } else {
          won = true; Studio.Audio.sfx('win'); Studio.Juice.flash(scene, 220, 255, 170, 70);
        }
      }
      if (player.y > scene.scale.height + 120) die();
    }
  };
  function manual() { var c = scene.cursors; if (!c) return input; return { left: c.left.isDown, right: c.right.isDown, jump: c.up.isDown || c.space.isDown }; }

  var config = {
    type: Phaser.AUTO, width: 960, height: 540, backgroundColor: '#140a08', seed: ['ember-depths'],
    render: { preserveDrawingBuffer: true, pixelArt: true },
    physics: { default: 'arcade', arcade: { gravity: { y: GRAV }, debug: false } },
    scene: [Play]
  };
  var r = new URLSearchParams(location.search).get('r');
  if (r === 'canvas') config.type = Phaser.CANVAS; else if (r === 'webgl') config.type = Phaser.WEBGL;
  window.game = new Phaser.Game(config);
})();
