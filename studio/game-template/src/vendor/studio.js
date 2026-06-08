/*
 * Studio SDK — an opinionated layer on top of Phaser 4 (phaser-private) that
 * makes the AI-game-studio conventions native, so every scaffolded game inherits:
 *
 *   Studio.harness   deterministic stepper + semantic observability (the eval backbone)
 *   Studio.Autopilot generic platformer driver (the 0-death gate)
 *   Studio.Level     data-driven level DSL  ->  built world
 *   Studio.Textures  procedural texture bakery (no external art needed)
 *   Studio.Juice     tweens / particles / Phaser-4 GPU filters (the "feel" surface)
 *   Studio.Audio     procedural WebAudio SFX + music hook
 *   Studio.Cam       follow camera w/ deadzone + bounds
 *   Studio.Materials look + footing + grounding (AI-safe surfaces)
 *
 * Load order in a game:  <script src="phaser.min.js"></script>
 *                        <script src="studio.js"></script>
 */
(function (root) {
  'use strict';
  var Studio = { version: '0.1.0' };

  // ---------------------------------------------------------------- Materials
  // Each surface declares its look + footing + machine-readable grounding,
  // so levels are AI-completable by construction.
  Studio.Materials = {
    table: {
      solid: { color: 0x3a5a40, top: 0x588157, friction: 1, deadly: false, ground: true },
      stone: { color: 0x6b705c, top: 0x8a8d7a, friction: 1, deadly: false, ground: true },
      ice: { color: 0x9fd3e0, top: 0xd6f1f7, friction: 0.05, deadly: false, ground: true },
      lava: { color: 0xd00000, top: 0xff5400, friction: 1, deadly: true, ground: false },
      mud: { color: 0x6f4518, top: 0x8a5a2b, friction: 2.2, deadly: false, ground: true }
    },
    get: function (name) { return this.table[name] || this.table.solid; }
  };

  // ---------- color helpers (hex int math) for the texture bakery ----------
  Studio._mix = function (a, b, t) {
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return ((Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t));
  };
  Studio._lighten = function (c, t) { return Studio._mix(c, 0xffffff, t); };
  Studio._darken = function (c, t) { return Studio._mix(c, 0x000000, t); };

  // ----------------------------------------------------------- TextureFactory
  // Procedural art: shaded, outlined sprites + gradient ground (no AI required).
  Studio.Textures = {
    bake: function (scene, key, w, h, draw) {
      if (scene.textures.exists(key)) scene.textures.remove(key);
      var g = scene.add.graphics(); draw(g, w, h); g.generateTexture(key, w, h); g.destroy(); return key;
    },
    // vertical gradient as horizontal bands — cross-renderer safe; stretches cleanly across a slab
    gradStrip: function (scene, key, top, bottom, h) {
      h = h || 64;
      this.bake(scene, key, 16, h, function (g) {
        var bands = 24, bh = Math.ceil(h / bands) + 1;
        for (var i = 0; i < bands; i++) { var t = i / (bands - 1); g.fillStyle(Studio._mix(top, bottom, t), 1).fillRect(0, Math.round(t * (h - bh)), 16, bh); }
      });
    },
    kit: function (scene, opt) {
      opt = opt || {}; var T = opt.tile || 40, M = Studio.Materials, self = this;
      Object.keys(M.table).forEach(function (name) {
        var m = M.get(name);
        self.gradStrip(scene, 'grad_' + name, Studio._lighten(m.top, 0.12), Studio._darken(m.color, 0.34));
      });
      var hero = opt.hero || 0xffd166, enemy = opt.enemy || 0xef476f, goal = opt.goal || 0x06d6a0;
      this.bake(scene, 'hero', 30, 38, function (g) {
        g.fillStyle(0x141414, 1).fillRoundedRect(0, 0, 30, 38, 8);
        g.fillStyle(hero, 1).fillRoundedRect(2, 2, 26, 34, 6);
        g.fillStyle(Studio._lighten(hero, 0.32), 1).fillRoundedRect(2, 2, 26, 13, 6);
        g.fillStyle(Studio._darken(hero, 0.22), 1).fillRect(2, 29, 26, 7);
        g.fillStyle(0xffffff, 1).fillCircle(11, 18, 4).fillCircle(20, 18, 4);
        g.fillStyle(0x141414, 1).fillCircle(12, 18, 2).fillCircle(21, 18, 2);
      });
      this.bake(scene, 'enemy', 32, 28, function (g) {
        g.fillStyle(0x141414, 1).fillRoundedRect(0, 0, 32, 26, 9);
        g.fillStyle(enemy, 1).fillRoundedRect(2, 2, 28, 22, 7);
        g.fillStyle(Studio._darken(enemy, 0.28), 1).fillRect(2, 15, 28, 9);
        g.fillStyle(0xffffff, 1).fillCircle(11, 12, 4).fillCircle(21, 12, 4);
        g.fillStyle(0x141414, 1).fillCircle(12, 13, 2).fillCircle(22, 13, 2);
        g.fillStyle(0x141414, 1).fillRect(7, 24, 6, 4).fillRect(19, 24, 6, 4);
      });
      this.bake(scene, 'coin', 20, 20, function (g) {
        g.fillStyle(0x9a6a00, 1).fillCircle(10, 10, 10);
        g.fillStyle(0xffd700, 1).fillCircle(10, 10, 8);
        g.fillStyle(0xfff3b0, 1).fillCircle(7, 7, 3);
      });
      this.bake(scene, 'goal', 18, 90, function (g) {
        g.fillStyle(Studio._darken(goal, 0.25), 1).fillRoundedRect(0, 0, 18, 90, 5);
        g.fillStyle(goal, 1).fillRoundedRect(2, 2, 14, 86, 4);
        g.fillStyle(Studio._lighten(goal, 0.35), 1).fillRect(3, 3, 4, 84);
      });
      this.bake(scene, 'dot', 8, 8, function (g) { g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4); });
      this.bake(scene, 'block', T, T, function (g) { g.fillStyle(0xffffff, 1).fillRect(0, 0, T, T); });
      // spring / bounce pad: a coiled base + a bright top plate (reads as "boing")
      var spring = opt.spring || 0xffd166;
      this.bake(scene, 'spring', T, 18, function (g) {
        g.fillStyle(0x141414, 1).fillRoundedRect(0, 0, T, 18, 4);
        g.fillStyle(Studio._darken(spring, 0.4), 1).fillRect(6, 8, T - 12, 8);   // coils
        for (var i = 0; i < 3; i++) g.fillStyle(Studio._darken(spring, 0.55), 1).fillRect(6, 9 + i * 3, T - 12, 1);
        g.fillStyle(spring, 1).fillRoundedRect(2, 0, T - 4, 8, 3);               // top plate
        g.fillStyle(Studio._lighten(spring, 0.4), 1).fillRect(4, 1, T - 8, 2);
      });
    }
  };

  // ----------------------------------------------------------------- Backdrop
  // Gradient sky (pinned to camera) + parallax silhouette layers — instant depth.
  Studio.Backdrop = function (scene, opt) {
    opt = opt || {};
    var W = scene.scale.width, H = scene.scale.height;
    Studio.Textures.gradStrip(scene, '_sky', opt.top != null ? opt.top : 0x24304f, opt.bottom != null ? opt.bottom : 0x0b1021, 160);
    scene.add.image(W / 2, H / 2, '_sky').setDisplaySize(W, H).setScrollFactor(0).setDepth(-100);
    var span = opt.worldWidth || (W * 2);
    (opt.layers || []).forEach(function (L, li) {
      var g = scene.add.graphics().setScrollFactor(L.scroll != null ? L.scroll : 0.3, 1).setDepth(-90 + li);
      g.fillStyle(L.color, L.alpha != null ? L.alpha : 1);
      var base = L.y != null ? L.y : H * 0.74, step = L.step || 150, amp = L.amp || 70, ph = li * 9 + 1;
      g.beginPath(); g.moveTo(-60, H + 30);
      for (var x = -60; x <= span + 60; x += step) { var y = base - (Math.sin(x * 0.011 + ph) * 0.5 + 0.5) * amp; g.lineTo(x, y); }
      g.lineTo(span + 60, H + 30); g.closePath(); g.fillPath();
    });
  };

  // ---------------------------------------------------------------- Platformer
  // A reusable, DETERMINISTIC movement controller carrying the proven jazz feel
  // (coyote time, jump buffer, variable jump, asymmetric gravity, run-accel/skid)
  // ported & scaled to the Studio 960x540 / 40px world. No Date.now/Math.random
  // touches motion — it is driven only by input + a fixed dt the caller supplies.
  //
  //   var pc = Studio.Platformer.create({ tune: {...} });
  //   // each frame, after computing onGround + foot friction:
  //   pc.update(player, { left, right, jump, down }, { onGround, footFriction, dt });
  //
  // The controller owns horizontal velocity (accel toward ±maxRun, skid on
  // reversal, friction when idle — all scaled by footFriction) and the jump arc
  // (variable height + asymmetric gravity via body.setGravityY relative to the
  // world's base gravity). It leaves collisions/overlaps to the game.
  Studio.Platformer = {
    // Ported from jazz/consts.js TUNE, scaled to 40px tiles & the ~1300 base
    // gravity this template runs at. Tuned so a full (held) jump clears ~3 tiles
    // up / ~4-5 tiles across, matching (and slightly exceeding) the proven
    // -600/1300 ember hop the 0-death gate was built around.
    DEFAULT_TUNE: {
      maxRun: 220,          // top run speed (px/s) — matches the proven gate horizontal reach
      runAccel: 1800,       // ground accel toward maxRun (reaches top in ~8 frames)
      airAccel: 1200,       // weaker steering in the air
      skidDecel: 2600,      // turnaround decel on reversal (~1.45x accel, SMB skid)
      groundFriction: 1500, // decel when no input is held (per second)
      jumpVel: 540,         // full-jump launch velocity (apex ~3 tiles w/ riseGravity)
      jumpCut: 0.35,        // release-while-rising cuts upward velocity to this fraction
      riseGravity: 1200,    // while holding jump + ascending (floaty climb)
      apexGravity: 1000,    // near the top of the arc (|vy| < apexThreshold) -> brief hang
      fallGravity: 1900,    // descending (heavier -> snappy fall, keeps air-time near the proven hop)
      apexThreshold: 60,    // |vy| under which apex-hang gravity applies (brief, so reach stays bounded)
      maxFall: 980,         // terminal fall speed clamp
      springVel: 920,       // bounce-pad launch (~6 tiles up, well above a normal jump)
      coyoteMs: 120,        // grace window to still jump just after leaving a ledge
      bufferMs: 140         // a jump pressed just before landing still fires on touch
    },
    create: function (opt) {
      opt = opt || {};
      var tune = Object.assign({}, Studio.Platformer.DEFAULT_TUNE, opt.tune || {});
      return {
        tune: tune,
        // per-controller state (NOT globals) so determinism holds across resets
        coyote: 0, buffer: 0, jumpHeld: false, springLatch: false, facing: 1,
        reset: function () { this.coyote = 0; this.buffer = 0; this.jumpHeld = false; this.springLatch = false; this.facing = 1; },
        // Launch the player upward at a fixed velocity (springs / bounce tiles).
        // Exempt from the variable-jump clamp until the player next lands.
        launch: function (player, vel) {
          player.body.velocity.y = -(vel != null ? vel : this.tune.springVel);
          player.body.blocked.down = player.body.touching.down = false;
          this.coyote = 0; this.buffer = 0; this.jumpHeld = true; this.springLatch = true;
        },
        update: function (player, input, ctx) {
          ctx = ctx || {};
          var t = this.tune, b = player.body;
          var dt = ctx.dt != null ? ctx.dt : (1 / 60);          // caller-managed FIXED dt (deterministic)
          var ms = dt * 1000;
          var onGround = !!ctx.onGround;
          var ff = ctx.footFriction != null ? ctx.footFriction : 1; // from Studio.Materials.<mat>.friction
          var left = !!input.left, right = !!input.right, jump = !!input.jump;

          // ---- horizontal: accel toward ±maxRun, skid on reversal, friction idle ----
          var vx = b.velocity.x;
          var accel = onGround ? t.runAccel : t.airAccel;
          if (onGround) accel *= ff;                            // grip scales with the surface (ice sluggish, mud snappy)
          if (left && !right) {
            this.facing = -1;
            // reversing direction at speed -> skid (stronger decel) before re-accelerating
            var aL = (vx > 0 ? t.skidDecel * (onGround ? ff : 1) : accel);
            vx -= aL * dt;
            if (vx < -t.maxRun) vx = -t.maxRun;
          } else if (right && !left) {
            this.facing = 1;
            var aR = (vx < 0 ? t.skidDecel * (onGround ? ff : 1) : accel);
            vx += aR * dt;
            if (vx > t.maxRun) vx = t.maxRun;
          } else if (onGround) {
            // no input: bleed speed by ground friction (scaled by footing)
            var dec = t.groundFriction * ff * dt;
            if (Math.abs(vx) <= dec) vx = 0; else vx -= Math.sign(vx) * dec;
          }
          b.velocity.x = vx;

          // ---- coyote time + jump buffer (forgiving, gate-safe windows) ----
          if (onGround) this.coyote = t.coyoteMs; else this.coyote -= ms;
          var pressed = jump && !this.jumpHeld;
          if (pressed) this.buffer = t.bufferMs; else this.buffer -= ms;
          this.jumpHeld = jump;

          // start a jump on a buffered press within the coyote window
          if (this.buffer > 0 && this.coyote > 0) {
            b.velocity.y = -t.jumpVel;
            this.buffer = 0; this.coyote = 0; this.springLatch = false;
          }

          // variable jump height: a SPRING/bounce launch is fixed-height (exempt
          // until landing); a normal jump cut to jumpCut% if released while rising.
          if (this.springLatch) {
            if (onGround && b.velocity.y >= 0) this.springLatch = false;
          } else if (!jump && b.velocity.y < -t.jumpVel * t.jumpCut) {
            b.velocity.y = -t.jumpVel * t.jumpCut;
          }

          // ---- asymmetric gravity: light rise (held), hang at apex, heavy fall ----
          // Applied as an OFFSET on top of the world's base gravity so the body's
          // own integrator stays the single source of vertical motion.
          var base = (b.world && b.world.gravity ? b.world.gravity.y : 0);
          var gNow = t.fallGravity;
          if (!onGround) {
            if (b.velocity.y < 0 && jump && !this.springLatch) gNow = t.riseGravity;
            if (Math.abs(b.velocity.y) < t.apexThreshold) gNow = t.apexGravity;
          }
          b.setGravityY(gNow - base);

          // clamp terminal fall
          if (b.velocity.y > t.maxFall) b.velocity.y = t.maxFall;

          if (player.setFlipX) player.setFlipX(this.facing < 0);
          return { vx: b.velocity.x, vy: b.velocity.y, facing: this.facing, onGround: onGround };
        }
      };
    }
  };

  // --------------------------------------------------------------- Level DSL
  // A level is data. build() returns { platforms, hazards, coins, enemies, spawn, goalX, springs, movers, tick }.
  Studio.Level = {
    build: function (scene, spec) {
      var T = spec.tile || 40, H = spec.height || 540;
      var platforms = scene.physics.add.staticGroup();
      var hazards = scene.physics.add.staticGroup();
      // ONE wide static body per slab — the player slides smoothly with no seams
      // to catch on (which would spoof blocked.right and break the autopilot).
      function slab(group, cx, cy, w, h, mat) {
        // one wide static body, textured with the material's vertical gradient
        // (bright lit top -> dark depth); no separate decor objects to leak on rebuild.
        var img = group.create(cx, cy, 'grad_' + (mat || 'solid')); img.setDisplaySize(w, h).refreshBody();
        img.mat = mat || 'solid';            // stash the material name so the game can read foot friction
        return img;
      }
      (spec.ground || []).forEach(function (seg) {
        var mat = seg[2] || 'solid', w = seg[1] - seg[0], h = H - spec.groundY;
        slab(Studio.Materials.get(mat).deadly ? hazards : platforms, seg[0] + w / 2, spec.groundY + h / 2, w, h, mat);
      });
      (spec.walls || []).forEach(function (w) {
        var ht = (w.tiles || 1) * T; slab(platforms, w.x + T / 2, spec.groundY - ht / 2, T, ht, w.mat || 'stone');
      });
      (spec.platforms || []).forEach(function (p) { slab(platforms, p.x + p.w / 2, p.y + T / 2, p.w, T, p.mat || 'solid'); });
      var coins = scene.physics.add.staticGroup();
      (spec.coins || []).forEach(function (c) { coins.create(c.x, c.y, 'coin'); });
      var enemies = scene.physics.add.group({ allowGravity: false, immovable: true });
      (spec.enemies || []).forEach(function (e) {
        var s = enemies.create(e.x, spec.groundY - 14, 'enemy'); s.patrol = e.patrol || 60; s.homeX = e.x; s.dir = 1;
      });

      // SPRINGS — bounce pads sitting on the ground line. A static body the game
      // overlaps to fling the player up (Studio.Platformer .launch). Run INTO at
      // speed, so no pixel-perfect landing is needed and it is NOT a step to hop.
      var springs = scene.physics.add.staticGroup();
      (spec.springs || []).forEach(function (s) {
        var img = springs.create(s.x, spec.groundY - 9, 'spring'); img.refreshBody();
        img.vel = s.vel || null;        // optional per-spring launch override (else controller default)
        img.cool = 0;                   // launch cooldown (frames), driven by world.tick
      });

      // MOVERS — kinematic platforms that patrol along an axis within ±range and
      // CARRY a rider. Dynamic body w/ no gravity + immovable, repositioned each
      // world.tick(dt) off an internal phase clock (deterministic: driven only by
      // the caller's fixed dt). The game reads .vx/.vy (per-tick delta) to carry.
      var moverGroup = scene.physics.add.group({ allowGravity: false, immovable: true });
      var movers = [];
      (spec.movers || []).forEach(function (m) {
        var w = m.w || (3 * T), h = m.h || Math.round(T * 0.5);
        var img = moverGroup.create(m.x, m.y, 'grad_' + (m.mat || 'stone'));
        img.setDisplaySize(w, h); img.body.setSize(w, h); img.body.setAllowGravity(false); img.body.setImmovable(true);
        img.mat = m.mat || 'stone';
        var rec = {
          spr: img, axis: m.axis || 'x', range: m.range || (2 * T), speed: m.speed || 60,
          homeX: m.x, homeY: m.y, phase: m.phase || 0, vx: 0, vy: 0, _prevX: m.x, _prevY: m.y
        };
        movers.push(rec);
      });

      // deterministic phase clock for movers — advanced by the caller's fixed dt
      var clock = 0;
      function tick(dt) {
        if (!movers.length) return;
        clock += (dt != null ? dt : (1 / 60));
        for (var i = 0; i < movers.length; i++) {
          var m = movers[i];
          // smooth ping-pong: a triangle wave over a full period (cover 2*range each way)
          var period = (4 * m.range) / m.speed;                 // seconds for a full back-and-forth
          var ph = ((clock / period) + m.phase) % 1; if (ph < 0) ph += 1;
          var tri = ph < 0.5 ? (ph * 2) : (2 - ph * 2);          // 0..1..0
          var off = (tri * 2 - 1) * m.range;                     // -range .. +range
          var nx = m.homeX + (m.axis === 'x' ? off : 0);
          var ny = m.homeY + (m.axis === 'y' ? off : 0);
          m.vx = nx - m._prevX; m.vy = ny - m._prevY;
          var sp = m.spr;
          sp.setPosition(nx, ny);
          sp.body.x = nx - sp.body.halfWidth; sp.body.y = ny - sp.body.halfHeight;
          m._prevX = nx; m._prevY = ny;
        }
      }

      return {
        platforms: platforms, hazards: hazards, coins: coins, enemies: enemies,
        springs: springs, movers: movers, moverGroup: moverGroup, tick: tick,
        spawn: spec.spawn || { x: 60, y: spec.groundY - 80 }, goalX: spec.goal != null ? spec.goal : (spec.width - 60)
      };
    }
  };

  // --------------------------------------------------------------- Autopilot
  // Generic platformer policy. Feed it a "sense" object each frame; it returns input.
  // sense = { onGround, groundAhead, blockedRight, enemyAhead, x, goalX, vy }
  //
  // Variable-jump aware: with Studio.Platformer, a one-frame jump press would be
  // read as an early release and cut to ~35% height. So the driver HOLDS jump
  // through the whole ascent — it decides to jump on the ground, then keeps the
  // button down while still rising (vy < 0) so the controller delivers the FULL
  // height needed to clear a wide gap / tall wall, releasing once it tops out so
  // the next ground contact registers as a fresh press. Springs (run-into) and
  // movers (carry) need no special input; the existing run-right policy rides them.
  Studio.Autopilot = {
    platformer: function (sense) {
      var out = { left: false, right: true, jump: false };
      var need = sense.onGround && (!sense.groundAhead || sense.blockedRight || sense.enemyAhead);
      if (need) out.jump = true;                                  // launch from the ground
      else if (!sense.onGround && (sense.vy != null) && sense.vy < -10) out.jump = true; // keep holding while rising -> full height
      return out;
    },
    // convenience: probe a static group for ground under a point
    groundAt: function (group, px, py, tile) {
      var kids = group.getChildren();
      for (var i = 0; i < kids.length; i++) {
        var b = kids[i] && kids[i].body; if (!b) continue;
        if (px >= b.left - 2 && px <= b.right + 2 && b.top >= py - 6 && b.top <= py + (tile || 40)) return true;
      }
      return false;
    }
  };

  // -------------------------------------------------------------------- Juice
  // The "feel" surface. GPU filters are WebGL-only -> every call is guarded.
  Studio.Juice = {
    shake: function (scene, dur, amt) { try { scene.cameras.main.shake(dur || 120, amt || 0.008); } catch (e) {} },
    flash: function (scene, dur, r, g, b) { try { scene.cameras.main.flash(dur || 120, r || 255, g || 255, b || 255); } catch (e) {} },
    hitStop: function (scene, ms) { try { var t = scene.time; scene.physics.world.pause(); t.delayedCall(ms || 60, function () { scene.physics.world.resume(); }); } catch (e) {} },
    squash: function (scene, obj, sx, sy, dur) {
      try { scene.tweens.add({ targets: obj, scaleX: sx || 1.25, scaleY: sy || 0.8, yoyo: true, duration: dur || 90, ease: 'Quad.out' }); } catch (e) {}
    },
    burst: function (scene, x, y, opt) {
      opt = opt || {};
      try {
        var em = scene.add.particles(x, y, opt.texture || 'dot', {
          speed: { min: opt.spMin || 60, max: opt.spMax || 180 }, angle: { min: 0, max: 360 },
          lifespan: opt.life || 500, scale: { start: opt.scale || 0.9, end: 0 }, quantity: opt.n || 12,
          blendMode: 'ADD', emitting: false, tint: opt.tint
        });
        em.explode(opt.n || 12); scene.time.delayedCall(opt.life || 500, function () { em.destroy(); });
        return em;
      } catch (e) {}
    },
    ambient: function (scene, w, opt) {
      opt = opt || {};
      try {
        return scene.add.particles(0, opt.y != null ? opt.y : -8, opt.texture || 'dot', {
          x: { min: 0, max: w }, lifespan: 5000, speedY: { min: 16, max: 50 },
          scale: { start: opt.scale || 0.7, end: 0 }, alpha: { start: 0.4, end: 0 }, quantity: 1, frequency: 120, blendMode: 'ADD'
        });
      } catch (e) {}
    },
    // GPU filters (WebGL only) — no-op on canvas
    glow: function (obj, color, outer) { try { if (!obj.enableFilters) return; obj.enableFilters(); obj.filters.internal.addGlow(color != null ? color : 0xffffff, outer || 4); } catch (e) {} },
    vignette: function (scene, strength) { try { var c = scene.cameras.main; if (!c.enableFilters) return; c.enableFilters(); c.filters.internal.addVignette(0.5, 0.5, 0.6, strength || 0.5); } catch (e) {} },
    grade: function (scene, fn) { try { var c = scene.cameras.main; if (!c.enableFilters) return; c.enableFilters(); var cm = c.filters.internal.addColorMatrix(); if (fn) fn(cm); return cm; } catch (e) {} }
  };

  // -------------------------------------------------------------------- Audio
  Studio.Audio = (function () {
    var ctx = null;
    function ac() { if (!ctx) { try { ctx = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) {} } return ctx; }
    function tone(freq, dur, type, vol) {
      var a = ac(); if (!a) return;
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || 'square'; o.frequency.value = freq; g.gain.value = vol || 0.08;
      o.connect(g); g.connect(a.destination);
      var t = a.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12)); o.stop(t + (dur || 0.12));
    }
    var SFX = {
      jump: function () { tone(420, 0.12, 'square'); }, coin: function () { tone(880, 0.08, 'triangle'); tone(1320, 0.08, 'triangle'); },
      stomp: function () { tone(160, 0.12, 'sawtooth'); }, hurt: function () { tone(120, 0.25, 'sawtooth', 0.12); },
      win: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 'triangle'); }, i * 110); }); }
    };
    return { sfx: function (n) { try { (SFX[n] || function () {})(); } catch (e) {} }, music: function (url, vol) { try { var au = new Audio(url); au.loop = true; au.volume = vol || 0.4; au.play(); return au; } catch (e) {} } };
  })();

  // ---------------------------------------------------------------------- Cam
  Studio.Cam = {
    follow: function (scene, target, opt) {
      opt = opt || {}; var c = scene.cameras.main;
      if (opt.bounds) c.setBounds(opt.bounds[0], opt.bounds[1], opt.bounds[2], opt.bounds[3]);
      c.startFollow(target, true, opt.lerp || 0.12, opt.lerp || 0.12);
      if (opt.deadzone) c.setDeadzone(opt.deadzone[0], opt.deadzone[1]);
      return c;
    }
  };

  // ------------------------------------------------------------------- Touch
  // On-screen analog joystick (bottom-left) + jump button (bottom-right) for
  // mobile. Returns a live { left, right, down, jump } state to merge into input.
  // Mirrors the jazz/starsweeper control feel. Multi-touch so stick + jump hold together.
  Studio.Touch = {
    create: function (scene, opt) {
      opt = opt || {};
      var W = scene.scale.width, H = scene.scale.height, DEPTH = 300;
      var isTouch = false; try { isTouch = !!(scene.sys.game.device.input.touch) || (typeof window !== 'undefined' && 'ontouchstart' in window); } catch (e) {}
      if (isTouch) scene.input.addPointer(3); // so the stick + jump button work together
      var st = { left: false, right: false, down: false, _up: false, _btn: false };
      Object.defineProperty(st, 'jump', { get: function () { return st._up || st._btn; } });
      Object.defineProperty(st, 'up', { get: function () { return st._up; } });
      var bx = 120, by = H - 86, R = 68;
      scene.add.circle(bx, by, R, 0x0f1528, 0.4).setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(3, 0xffffff, 0.22);
      var thumb = scene.add.circle(bx, by, 30, 0x2a3556, 0.9).setScrollFactor(0).setDepth(DEPTH + 1).setStrokeStyle(3, 0xffd34d, 0.85);
      var jx = W - 96, jy = H - 84;
      var jbtn = scene.add.circle(jx, jy, 54, 0x3a1420, 0.5).setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(3, 0xffae6b, 0.7).setInteractive();
      scene.add.text(jx, jy, 'JUMP', { fontFamily: 'monospace', fontSize: '13px', color: '#ffce9e' }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 1);
      jbtn.on('pointerdown', function () { st._btn = true; }); jbtn.on('pointerup', function () { st._btn = false; }); jbtn.on('pointerout', function () { st._btn = false; });
      var pid = null;
      function setFrom(px, py) { var dx = px - bx, dy = py - by, m = Math.hypot(dx, dy) || 1; if (m > R) { dx = dx / m * R; dy = dy / m * R; } thumb.setPosition(bx + dx, by + dy); var nx = dx / R, ny = dy / R; st.left = nx < -0.35; st.right = nx > 0.35; st._up = ny < -0.45; st.down = ny > 0.45; }
      function release() { pid = null; thumb.setPosition(bx, by); st.left = st.right = st._up = st.down = false; }
      scene.input.on('pointerdown', function (p) { if (pid != null || p.x > W * 0.5) return; pid = p.id; setFrom(p.x, p.y); }); // left half drives the stick
      scene.input.on('pointermove', function (p) { if (p.id === pid) setFrom(p.x, p.y); });
      scene.input.on('pointerup', function (p) { if (p.id === pid) release(); });
      return st;
    }
  };

  // ------------------------------------------------------------------ harness
  // Wires window.__rec (deterministic stepper) + window.__game (observability)
  // + window.__run / window.__gate, given game + hooks. This is the eval contract.
  Studio.harness = {
    install: function (game, hooks) {
      root.__rec = {
        on: false, t: 0, dt: 1000 / 60,
        begin: function () { if (this.on) return; game.loop.sleep(); this.on = true; this.t = 1000; },
        step: function (n) { n = n || 1; for (var i = 0; i < n; i++) { this.t += this.dt; game.step(this.t, this.dt); } },
        tick: function (n) { n = n || 1; for (var i = 0; i < n; i++) { this.t += this.dt; game.headlessStep(this.t, this.dt); } }, // physics only (no render) — fast gate
        end: function () { if (!this.on) return; this.on = false; game.loop.wake(); }
      };
      root.__game = {
        ready: function () { return !!root.__ready; },
        snapshot: hooks.snapshot,
        setInput: hooks.setInput || function () {},
        autopilot: hooks.autopilot || function () {},
        reset: hooks.reset || function () {}
      };
      root.__run = function (n) { root.__game.reset(); root.__game.autopilot(true); root.__rec.begin(); root.__rec.step(n); return root.__game.snapshot(); };
      root.__gate = function (maxF) {
        root.__game.reset(); root.__game.autopilot(true); root.__rec.begin();
        var s = root.__game.snapshot();
        while (!s.won && !s.dead && s.frame < maxF) { root.__rec.tick(1); s = root.__game.snapshot(); } // headless physics — gate needs no pixels
        return s;
      };
      root.__ready = true;
      return root.__game;
    }
  };

  // -------------------------------------------------------------------- Feel
  // A PURE, DETERMINISTIC fun-score predictor — the Studio port of jazz's
  // feelmodel.js. It predicts a per-window INTEREST curve straight from a
  // level spec's element placement (no pixels, no Date.now, no Math.random),
  // then runs the EXACT four-component math feel.mjs / the jazz model use:
  //
  //   FUN = 100 * (0.35*engagement + 0.15*dynamics + 0.25*arc + 0.25*flow)
  //
  // Inputs : ONE Studio Level spec ({ width, tile, groundY, ground:[[x1,x2,mat]],
  //          walls, platforms, coins, enemies, springs, movers, ... }).
  // Outputs: { fun, engagement, dynamics, arc, flow, peakPos, weakest, ... }.
  //
  // Adapted to the Studio DSL: positions are PIXELS (not tiles), and a GAP is a
  // DEADLY ground segment (lava) or a genuine uncovered hole in the floor — both
  // route to "jump it or die", exactly the jazz `gap` verb. Material changes
  // (stone->mud->ice...) are scored as variety beats. Additive: touches nothing.
  Studio.Feel = (function () {
    // per-element interest weights (mirrors jazz INTEREST, mapped to Studio verbs)
    var INTEREST = {
      ground: 1, ledge: 4, gap: 5, spring: 8, mover: 8, walker: 6,
      ice: 6, mud: 6, lava: 5, matchg: 4, coin: 2
    };
    var clamp = function (v, lo, hi) { lo = lo == null ? 0 : lo; hi = hi == null ? 1 : hi; return Math.max(lo, Math.min(hi, v)); };
    var mean = function (a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : 0; };
    function pearson(a, b) {
      var n = a.length, ma = mean(a), mb = mean(b), nu = 0, da = 0, db = 0;
      for (var i = 0; i < n; i++) { nu += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) * (a[i] - ma); db += (b[i] - mb) * (b[i] - mb); }
      return da && db ? nu / Math.sqrt(da * db) : 0;
    }
    function slope(y) {
      var n = y.length; if (n < 2) return 0;
      var mx = (n - 1) / 2, my = mean(y), nu = 0, de = 0;
      for (var i = 0; i < n; i++) { nu += (i - mx) * (y[i] - my); de += (i - mx) * (i - mx); }
      return de ? nu / de : 0;
    }
    // the ideal interest envelope: gentle rise + a peak near ~84% of the level
    var idealAt = function (t) { return 4 + 4 * t + 2.2 * Math.exp(-(((t - 0.84) / 0.11) * ((t - 0.84) / 0.11))); };

    // every "beat" in the level -> { x (px), type, interest }
    function collectBeats(spec) {
      var b = [], W = spec.width || 960, T = spec.tile || 40;
      // GAPS: deadly ground segments (lava) + genuine uncovered holes in the floor
      var segs = (spec.ground || []).slice().sort(function (p, q) { return p[0] - q[0]; });
      var prevMat = null, cursor = 0;
      segs.forEach(function (seg) {
        var x0 = seg[0], x1 = seg[1], mat = seg[2] || 'solid';
        var m = (Studio.Materials && Studio.Materials.get) ? Studio.Materials.get(mat) : null;
        var deadly = m ? !!m.deadly : (mat === 'lava');
        if (x0 > cursor + 2) b.push({ x: (cursor + x0) / 2, type: 'gap', interest: INTEREST.gap }); // a true hole
        if (deadly) b.push({ x: (x0 + x1) / 2, type: 'gap', interest: INTEREST.gap });             // lava-as-gap
        else if (mat === 'ice') b.push({ x: (x0 + x1) / 2, type: 'ice', interest: INTEREST.ice });
        else if (mat === 'mud') b.push({ x: (x0 + x1) / 2, type: 'mud', interest: INTEREST.mud });
        // MATERIAL CHANGE between adjacent walkable segments = a small variety beat
        if (prevMat != null && mat !== prevMat && !deadly) b.push({ x: x0, type: 'matchg', interest: INTEREST.matchg });
        prevMat = deadly ? prevMat : mat;
        cursor = Math.max(cursor, x1);
      });
      (spec.walls || []).forEach(function (w) { b.push({ x: w.x + T / 2, type: 'ledge', interest: INTEREST.ledge }); });
      (spec.platforms || []).forEach(function (p) { b.push({ x: p.x + (p.w || T) / 2, type: 'ledge', interest: INTEREST.ledge }); });
      (spec.enemies || []).forEach(function (e) { b.push({ x: e.x, type: 'walker', interest: INTEREST.walker }); });
      (spec.springs || []).forEach(function (s) { b.push({ x: s.x, type: 'spring', interest: INTEREST.spring }); });
      (spec.movers || []).forEach(function (m) { b.push({ x: m.x, type: 'mover', interest: INTEREST.mover }); });
      return b;
    }

    // predict the interest curve from placement alone (jazz novelty/fatigue/combo)
    function predict(spec, opt) {
      opt = opt || {};
      var W = spec.width || 960, T = spec.tile || 40;
      // ~6-tile windows, clamped to a sane count so short/long levels both behave
      var n = opt.nWin || Math.max(8, Math.min(40, Math.round(W / (6 * T))));
      var beats = collectBeats(spec);
      var win = [], i;
      for (i = 0; i < n; i++) win.push({ peak: 0, dom: null, count: 0, coins: 0 });
      var wi = function (x) { return Math.max(0, Math.min(n - 1, Math.floor((x / W) * n))); };
      beats.forEach(function (bt) { var w = win[wi(bt.x)]; w.count++; if (bt.interest > w.peak) { w.peak = bt.interest; w.dom = bt.type; } });
      (spec.coins || []).forEach(function (c) { win[wi(c.x)].coins++; });
      var seen = {}, prevDom = null;
      var curve = win.map(function (w) {
        var v = 2.4;                                              // bare ground is a touch dull
        if (w.peak > 0) v = 2.0 + w.peak * 0.72;                  // dominant beat sets the height
        if (w.count > 1) v += Math.min(1.2, (w.count - 1) * 0.4); // combos add interest
        v += w.coins >= 3 ? 0.8 : w.coins > 0 ? 0.3 : 0;          // a collectible beat
        if (w.dom && !seen[w.dom]) { seen[w.dom] = 1; v += 1.1; } // NOVELTY — first time we meet a verb
        else if (w.dom && w.dom === prevDom) v *= 0.84;           // FATIGUE — same verb twice running
        prevDom = w.dom || prevDom;
        return Math.max(0, Math.min(10, +v.toFixed(2)));
      });
      return { curve: curve, n: n, W: W };
    }

    // the EXACT feel.mjs / jazz component math, over a predicted curve
    function scoreCurve(curve, W, n) {
      var ideal = curve.map(function (_, i) { return idealAt(n > 1 ? i / (n - 1) : 0); });
      var engagement = clamp(mean(curve) / 8);
      var meanAbsDiff = curve.length > 1 ? mean(curve.slice(1).map(function (v, i) { return Math.abs(v - curve[i]); })) : 0;
      var dynamics = clamp(meanAbsDiff / 2.5);
      var arcCorr = (pearson(curve, ideal) + 1) / 2;
      var peakPos = curve.indexOf(Math.max.apply(Math, curve)) / Math.max(1, n - 1);
      var lateBonus = clamp(1 - Math.abs(peakPos - 0.84) / 0.45);
      var trend = clamp((slope(curve) + 0.1) / 0.4);
      var arc = 0.5 * arcCorr + 0.3 * lateBonus + 0.2 * trend;
      var longestFlat = 0, run = 0;
      for (var i = 1; i < curve.length; i++) { if (Math.abs(curve[i] - curve[i - 1]) <= 1 && curve[i] <= 5) { run++; longestFlat = Math.max(longestFlat, run); } else run = 0; }
      var deadIdx = []; for (i = 0; i < curve.length; i++) if (curve[i] < 3.4) deadIdx.push(i);
      var flow = clamp(1 - (deadIdx.length / n) * 1.5 - (longestFlat / n) * 1.0);
      var comps = { engagement: engagement, dynamics: dynamics, arc: arc, flow: flow };
      // weighted FUN
      var fun = +(100 * (0.35 * engagement + 0.15 * dynamics + 0.25 * arc + 0.25 * flow)).toFixed(1);
      // weakest component name (drives the feel-guided next step)
      var weakest = Object.keys(comps).reduce(function (lo, k) { return comps[k] < comps[lo] ? k : lo; }, 'engagement');
      var deadAir = deadIdx.map(function (i) { return Math.round(i * W / n) + '-' + Math.round((i + 1) * W / n); });
      return {
        fun: fun,
        engagement: +engagement.toFixed(2), dynamics: +dynamics.toFixed(2),
        arc: +arc.toFixed(2), flow: +flow.toFixed(2),
        peakPos: +peakPos.toFixed(2), weakest: weakest,
        deadAir: deadAir, curve: curve
      };
    }

    return {
      INTEREST: INTEREST,
      idealAt: idealAt,
      collectBeats: collectBeats,
      predict: predict,
      // PUBLIC: score ONE level spec -> { fun, engagement, dynamics, arc, flow, peakPos, weakest, ... }
      score: function (spec) {
        if (!spec) return { fun: 0, engagement: 0, dynamics: 0, arc: 0, flow: 0, peakPos: 0, weakest: 'engagement', curve: [] };
        var p = predict(spec);
        var s = scoreCurve(p.curve, p.W, p.n);
        s.name = spec.name || null;
        return s;
      }
    };
  })();

  root.Studio = Studio;
  if (typeof module !== 'undefined' && module.exports) module.exports = Studio;
})(typeof window !== 'undefined' ? window : globalThis);
