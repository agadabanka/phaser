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
 *   Studio.Shell     playtest shell (pause / notes->/api/notes / restart / mute)
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
      mud: { color: 0x6f4518, top: 0x8a5a2b, friction: 2.2, deadly: false, ground: true },
      // sky materials (vertical archetype): cloud = walkable cumulus, mist = soft
      // low-grip vapor, storm = the deadly charged thunderhead (lava-of-the-sky).
      cloud: { color: 0xdfe9f5, top: 0xfafdff, friction: 1, deadly: false, ground: true },
      mist: { color: 0xb8c9e6, top: 0xe6f0fb, friction: 0.55, deadly: false, ground: true },
      storm: { color: 0x2c3550, top: 0x46527a, friction: 1, deadly: true, ground: false }
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

      // -------- CONTRAPTION ART (themed via the palette; baked procedurally) --------
      // A contraption's texture key is namespaced 'cx_<type>' so games can override.
      // Colors pull from the level's stone material so they read as "machined rock".
      var rockM = Studio.Materials.get('stone');
      var cxBeam = opt.contraption || Studio._lighten(rockM.top, 0.05);   // base structural tone
      var cxBolt = Studio._darken(cxBeam, 0.5);

      // SEESAW — a long tilting plank with a center pivot wedge (drawn flat; the
      // game rotates the art). Reads as a balance beam.
      var seesawW = (opt.seesawW || 5 * T);
      this.bake(scene, 'cx_seesaw', seesawW, 16, function (g) {
        g.fillStyle(0x141414, 1).fillRoundedRect(0, 0, seesawW, 16, 5);
        g.fillStyle(cxBeam, 1).fillRoundedRect(2, 2, seesawW - 4, 12, 4);          // plank face
        g.fillStyle(Studio._lighten(cxBeam, 0.3), 1).fillRect(3, 3, seesawW - 6, 3); // lit top edge
        g.fillStyle(Studio._darken(cxBeam, 0.3), 1).fillRect(3, 11, seesawW - 6, 2); // shaded underside
        // end caps + a few rivets so the plank reads as machined
        for (var i = 1; i < 5; i++) { var rx = i * (seesawW / 5); g.fillStyle(cxBolt, 1).fillCircle(rx, 8, 2); }
      });
      this.bake(scene, 'cx_pivot', 26, 22, function (g) {                          // the fulcrum wedge
        g.fillStyle(0x141414, 1).fillTriangle(0, 22, 13, 0, 26, 22);
        g.fillStyle(Studio._darken(cxBeam, 0.2), 1).fillTriangle(2, 21, 13, 3, 24, 21);
        g.fillStyle(cxBolt, 1).fillCircle(13, 12, 3);
      });

      // LAUNCHER — a geyser/vent nozzle: a flared metal base + a bright plume mouth.
      // Themed warm (uses the spring accent) so it reads as "release/exhilaration".
      this.bake(scene, 'cx_launcher', T, 22, function (g) {
        g.fillStyle(0x141414, 1).fillRoundedRect(0, 6, T, 16, 4);                  // nozzle body
        g.fillStyle(Studio._darken(spring, 0.35), 1).fillRect(4, 10, T - 8, 10);
        g.fillStyle(spring, 1).fillRoundedRect(2, 4, T - 4, 8, 3);                 // flared mouth
        g.fillStyle(Studio._lighten(spring, 0.5), 1).fillRect(6, 0, T - 12, 6);    // bright plume core
        g.fillStyle(Studio._lighten(spring, 0.3), 1).fillRect(4, 5, T - 8, 2);
      });

      // CRUMBLE — a cracked, fragile ledge. A second 'cx_crumble_x' frame shows it
      // fracturing (the game swaps to it once contact starts the collapse timer).
      var crumbleW = (opt.crumbleW || 3 * T);
      this.bake(scene, 'cx_crumble', crumbleW, T, function (g) {
        g.fillStyle(0x141414, 1).fillRect(0, 0, crumbleW, T);
        g.fillStyle(Studio._darken(cxBeam, 0.1), 1).fillRect(2, 2, crumbleW - 4, T - 4);
        g.fillStyle(Studio._lighten(cxBeam, 0.22), 1).fillRect(2, 2, crumbleW - 4, 4); // lit top
        // a few hairline cracks
        g.lineStyle(2, Studio._darken(cxBeam, 0.55), 1);
        g.beginPath(); g.moveTo(crumbleW * 0.3, 2); g.lineTo(crumbleW * 0.36, T - 4); g.strokePath();
        g.beginPath(); g.moveTo(crumbleW * 0.66, 2); g.lineTo(crumbleW * 0.6, T - 4); g.strokePath();
      });
      this.bake(scene, 'cx_crumble_x', crumbleW, T, function (g) {                 // fracturing frame
        g.fillStyle(0x141414, 1).fillRect(0, 0, crumbleW, T);
        g.fillStyle(Studio._darken(cxBeam, 0.28), 1).fillRect(2, 2, crumbleW - 4, T - 4);
        g.lineStyle(3, Studio._darken(cxBeam, 0.6), 1);
        for (var c = 1; c < 5; c++) { var cx = c * (crumbleW / 5); g.beginPath(); g.moveTo(cx, 2); g.lineTo(cx + 6, T - 4); g.strokePath(); }
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

  // ------------------------------------------------------------- Contraptions
  // A REGISTRY/dictionary of KINEMATIC contraptions — themed, deterministic
  // machines that layer "feeling" over a level WITHOUT ever becoming a forced
  // precision wall. Each entry is:
  //
  //   { feeling, lens, weight, build(scene, spec, world) }
  //
  //   feeling  human-readable emotional payload (balance, exhilaration, dread…)
  //   lens     the design lens it serves (Challenge / Sensation / Tension / …),
  //            so Studio.Feel + docs can group beats by intent
  //   weight   the INTEREST weight a beat of this type contributes to Studio.Feel
  //            (mirrors INTEREST.spring/mover so the fun model "sees" contraptions)
  //   build()  -> a contraption RECORD the Level + game drive generically:
  //              { type, spr, x, y,
  //                tick(dt, ctx),                 advance motion off a phase clock
  //                interact(player, ctx),         per-frame player interaction
  //                reset() }                      restore state on level reset
  //
  // DETERMINISM CONTRACT (identical to movers): a contraption's motion is a PURE
  // function of an internal phase clock advanced ONLY by world.tick(dt) with the
  // caller's FIXED dt. No Matter.js, no Math.random / Date.now touches motion.
  // Resets re-seed the clock to 0 so every gate run is bit-identical.
  //
  // AUTOPILOT-SAFETY CONTRACT ("spice over a safe path"): every contraption is
  // FLAIR over ground the plain run/jump traversal already clears. The 0-death
  // driver (run right, hop gaps/walls) must finish the level whether or not it
  // engages the contraption. Each build() below documents how it stays safe.
  Studio.Contraptions = (function () {
    var TWO_PI = Math.PI * 2;

    var REGISTRY = {
      // --------------------------------------------------------------- seesaw
      // A plank that TILTS on a sine (deterministic phase clock). A rider standing
      // on it gets a small horizontal velocity NUDGE in the downhill direction —
      // balance/tension/control. The plank sits FLAT-on-average on a continuous
      // walkable slab, so the autopilot just runs across it; the nudge is bounded
      // (|nudge| <= nudgeMax, default small) and never reverses a rightward runner,
      // so it can't stall the gate. Pure flair on safe ground.
      seesaw: {
        feeling: 'balance / tension / control',
        lens: 'Challenge',
        weight: 7,
        build: function (scene, spec, world) {
          var T = spec.tile || 40;
          var w = spec.w || (5 * T), artH = spec.h || 16;
          var gy = spec.groundY || (spec.y != null ? spec.y : 0);
          var amp = spec.tilt != null ? spec.tilt : 0.16;          // peak tilt (radians, ~9deg)
          var period = spec.period || 2.2;                          // seconds per full tilt cycle
          var phase0 = spec.phase || 0;
          var nudgeMax = spec.nudge != null ? spec.nudge : 70;      // px/s of downhill carry at full tilt
          // DETERMINISM + AUTOPILOT-SAFE design: the collision body is a STATIC strip
          // whose TOP sits FLUSH with the floor line (groundY) — so the plank is NOT a
          // step/wall (a rightward runner glides straight across at ground level: no
          // blocked.right, no hop) AND, being STATIC + axis-aligned + NEVER rotated, it
          // adds no floating-point jitter to the physics step (a dynamic, rotated body
          // sitting on the floor does). The tilt is a SEPARATE art image (`_art`) that
          // rotates for the visual; the physics sprite stays invisible & flat. The
          // rider "feeling" is a bounded CARRY (applied post-controller by the game,
          // like a mover) downhill — small, never reverses a runner, gate-safe.
          var bodyH = 10;
          var topY = spec.top != null ? spec.top : gy;             // flush with the floor by default
          var y = topY + bodyH / 2;
          var spr = scene.physics.add.staticImage(spec.x, y, 'cx_seesaw');
          spr.setDisplaySize(w, bodyH); spr.refreshBody();         // thin flat collision strip
          spr.setVisible(false);                                   // body is invisible; art carries the look
          spr.setDepth(spec.depth || 3);
          spr.mat = spec.mat || 'stone';
          // the visible, tilting plank + its pivot wedge (pure visuals — no physics)
          var art = scene.add.image(spec.x, topY, 'cx_seesaw').setDisplaySize(w, artH).setDepth(spec.depth || 3);
          var pivot = scene.add.image(spec.x, topY + 9, 'cx_pivot').setDepth((spec.depth || 3) - 1);
          var clock = 0, angle = 0, carry = 0, nudges = 0;
          return {
            type: 'seesaw', spr: spr, x: spec.x, y: y, _extra: [art, pivot],
            // the game reads .carry (px to add to the rider's x this frame) post-controller
            carry: 0,
            state: function () { return { angle: +angle.toFixed(3), carry: +carry.toFixed(2), nudges: nudges }; },
            tick: function (dt) {
              clock += (dt != null ? dt : (1 / 60));
              angle = Math.sin((clock / period) * TWO_PI + phase0 * TWO_PI) * amp;
              art.setRotation(angle);                               // tilt the VISUAL only (body never rotates)
              carry = Math.sin(angle) * nudgeMax * (dt != null ? dt : (1 / 60)); // downhill px this frame
              this.carry = carry;
            },
            interact: function (player, ctx) {
              // bounded downhill CARRY while standing on the plank — applied to POSITION
              // after the controller (so it survives pc.update, exactly like a mover
              // carry) and never overrides the run. Deterministic: carry is a pure fn
              // of the phase clock.
              var b = player.body, pb = spr.body;
              var onTop = b.bottom <= pb.top + 10 && b.bottom >= pb.top - 12
                && b.right > pb.left + 2 && b.left < pb.right - 2 && b.velocity.y >= -30;
              if (!onTop) { this._riding = false; return; }
              this._riding = true; nudges++;
              player.x += carry;                                    // gentle downhill drift (position, post-tick)
            },
            reset: function () { clock = 0; angle = 0; carry = 0; this.carry = 0; this._riding = false; art.setRotation(0); }
          };
        }
      },

      // ------------------------------------------------------------- launcher
      // A geyser / bounce pad that BOOSTS the player upward via pc.launch — pure
      // exhilaration / release. Two trigger modes, both autopilot-safe:
      //   - 'contact' (default): launches on overlap (like a spring) with a short
      //     cooldown — run into it, get flung up. No timing required.
      //   - 'cycle' : the geyser also auto-fires on its phase clock IF the player
      //     is resting on/near the mouth, so even a stationary bot gets lofted.
      // It sits on a continuous slab so the arc lands back on ground; it only ADDS
      // height/route and NEVER forces a precise landing, so the gate is unaffected.
      launcher: {
        feeling: 'exhilaration / release',
        lens: 'Sensation',
        weight: 9,
        build: function (scene, spec, world) {
          var T = spec.tile || 40;
          var gy = spec.groundY || 0;
          var y = spec.y != null ? spec.y : (gy - 11);
          var vel = spec.vel || 920;                                // launch velocity (~spring height)
          var mode = spec.mode || 'contact';
          var period = spec.period || 1.4;                          // cycle-fire period (seconds)
          var spr = scene.physics.add.staticImage(spec.x, y, 'cx_launcher');
          spr.refreshBody(); spr.setDepth(spec.depth || 3);
          var clock = 0, cool = 0, fired = 0;
          function fire(player, pc) {
            if (cool > 0) return false;
            if (player.body.velocity.y < -120) return false;        // already rocketing up
            cool = 14; fired++;                                     // one launch per contact window
            if (pc && pc.launch) pc.launch(player, vel);
            else { player.body.velocity.y = -vel; }                 // fallback if no controller
            if (spr._onFire) spr._onFire(spr);
            return true;
          }
          var rec = {
            type: 'launcher', spr: spr, x: spec.x, y: y, fire: fire,
            state: function () { return { fired: fired, cool: cool }; },
            tick: function (dt) {
              clock += (dt != null ? dt : (1 / 60));
              if (cool > 0) cool--;
            },
            interact: function (player, ctx) {
              var pc = ctx && ctx.pc, b = player.body, pb = spr.body;
              // overlap with the mouth (a touch above the nozzle)
              var over = b.right > pb.left && b.left < pb.right
                && b.bottom > pb.top - 6 && b.top < pb.bottom + 4;
              if (mode === 'cycle') {
                // auto-geyser: when the phase says "erupt" and the player is over it
                var ph = (clock / period) % 1;
                if (over && ph < 0.06) fire(player, pc);
              }
              if (over) fire(player, pc);                           // contact always fires (cooldown-gated)
            },
            reset: function () { clock = 0; cool = 0; fired = 0; }
          };
          return rec;
        }
      },

      // -------------------------------------------------------------- crumble
      // A ledge that DISABLES a few frames after first contact — urgency / dread —
      // then is RESTORED on level reset. AUTOPILOT-SAFE by placement: it is laid
      // OVER continuous safe ground (it is a thin riser the player runs across, not
      // a bridge over a pit). When it collapses the player simply drops onto the
      // solid floor below and keeps running, so a 0-death run never depends on it.
      // The collapse delay (frames) is generous so a runner clears it well before
      // it goes. Deterministic: the timer is frame-counted off world.tick(dt).
      crumble: {
        feeling: 'urgency / dread',
        lens: 'Tension',
        weight: 7,
        build: function (scene, spec, world) {
          var T = spec.tile || 40;
          var w = spec.w || (3 * T), h = spec.h || T;
          var gy = spec.groundY || 0;
          // sits as a thin riser whose TOP is a little above the floor line, so the
          // player runs onto it then drops to safe ground when it crumbles.
          var top = spec.top != null ? spec.top : (gy - Math.round(T * 0.5));
          var y = top + h / 2;
          var delay = spec.delay != null ? spec.delay : 26;        // frames after first touch before it falls
          var spr = scene.physics.add.staticImage(spec.x, y, 'cx_crumble');
          spr.setDisplaySize(w, h); spr.refreshBody(); spr.setDepth(spec.depth || 3);
          spr.mat = spec.mat || 'stone';
          var armed = false, timer = 0, gone = false;
          function disable() {
            gone = true; armed = false;
            spr.disableBody(true, true);
            if (spr._onFall) spr._onFall(spr);
          }
          return {
            type: 'crumble', spr: spr, x: spec.x, y: y,
            state: function () { return { armed: armed, gone: gone, timer: timer }; },
            tick: function (dt) {
              if (armed && !gone) { timer--; if (timer <= 0) disable(); }
            },
            interact: function (player, ctx) {
              if (gone || armed) return;
              var b = player.body, pb = spr.body;
              var onTop = b.bottom <= pb.top + 10 && b.bottom >= pb.top - 12
                && b.right > pb.left + 2 && b.left < pb.right - 2 && b.velocity.y >= -30;
              if (onTop) { armed = true; timer = delay; if (spr._onArm) spr._onArm(spr); } // start the collapse
            },
            reset: function () {
              armed = false; gone = false; timer = 0;
              if (!spr.active) { spr.enableBody(true, spec.x, y, true, true); } // restore at its home x/y
              spr.setTexture('cx_crumble'); spr.setDisplaySize(w, h); spr.refreshBody();
            }
          };
        }
      }
    };

    // ---------------------------------------------------------------- updraft
    // A vertical WIND COLUMN (the sky game's signature verb). While the player is
    // inside the column they accelerate upward toward a capped rise speed — a
    // float, not a fling, so steering stays in the player's hands the whole ride.
    // DETERMINISM: the field is CONSTANT (no clock in the force math); the only
    // motion change is a pure function of position + the caller's fixed dt.
    // AUTOPILOT-SAFE: the vertical driver just steers to the column's center and
    // rides; the column always tops out beside/above a walkable platform.
    REGISTRY.updraft = {
      feeling: 'lift / wonder / weightlessness',
      lens: 'Sensation',
      weight: 8,
      build: function (scene, spec) {
        var x = spec.x, w = spec.w || 120, y0 = spec.y0, y1 = spec.y1;   // column top/bottom (y0 < y1)
        var lift = spec.lift != null ? spec.lift : 2600;                  // upward accel px/s^2 (beats fallGravity)
        var maxRise = spec.maxRise != null ? spec.maxRise : 250;          // capped float speed
        var active = false;
        var spr = scene.add.rectangle(x, (y0 + y1) / 2, w, y1 - y0, 0xffffff, 0).setDepth(0); // invisible anchor (decor/teardown path)
        spr.setVisible(false);
        function contains(p) { return p.x > x - w / 2 && p.x < x + w / 2 && p.y > y0 && p.y < y1; }
        return {
          type: 'updraft', spr: spr, x: x, y: (y0 + y1) / 2, w: w, y0: y0, y1: y1,
          contains: function (p) { return contains(p); },
          state: function () { return { active: active }; },
          tick: function () {},
          interact: function (player, ctx) {
            var inside = contains(player);
            if (inside) {
              var b = player.body, dt = (ctx && ctx.dt != null) ? ctx.dt : (1 / 60);
              b.velocity.y -= lift * dt;
              if (b.velocity.y < -maxRise) b.velocity.y = -maxRise;
              if (!active && spr._onEnter) spr._onEnter(spr);
            }
            active = inside;
          },
          reset: function () { active = false; }
        };
      }
    };

    // ------------------------------------------------------------------- gust
    // A horizontal WIND GUST zone that blows on a deterministic phase clock
    // (period/duty, like the movers' triangle wave): timing/tension — cross when
    // it rests, or fight it with the stick. Push is capped so it can shove but
    // never pin a runner at full speed.
    REGISTRY.gust = {
      feeling: 'timing / tension / lean-into-it',
      lens: 'Challenge',
      weight: 7,
      build: function (scene, spec) {
        var x = spec.x, y = spec.y, w = spec.w || 240, h = spec.h || 140;
        var dir = spec.dir === -1 ? -1 : 1;
        var period = spec.period || 3.2, duty = spec.duty != null ? spec.duty : 0.45;
        var push = spec.push != null ? spec.push : 900;                   // px/s^2 while blowing
        var vxCap = spec.vxCap != null ? spec.vxCap : 300;
        var clock = spec.phase ? spec.phase * period : 0, active = false;
        var spr = scene.add.rectangle(x, y, w, h, 0xffffff, 0).setDepth(0);
        spr.setVisible(false);
        function contains(p) { return p.x > x - w / 2 && p.x < x + w / 2 && p.y > y - h / 2 && p.y < y + h / 2; }
        return {
          type: 'gust', spr: spr, x: x, y: y, w: w, h: h, dir: dir,
          contains: function (p) { return contains(p); },
          state: function () { return { active: active, clock: +clock.toFixed(3) }; },
          tick: function (dt) {
            clock += (dt != null ? dt : 1 / 60);
            var was = active;
            active = ((clock / period) % 1) < duty;
            if (active && !was && spr._onBlow) spr._onBlow(spr);
          },
          interact: function (player, ctx) {
            if (!active || !contains(player)) return;
            var b = player.body, dt = (ctx && ctx.dt != null) ? ctx.dt : (1 / 60);
            b.velocity.x += dir * push * dt;
            if (b.velocity.x > vxCap) b.velocity.x = vxCap;
            if (b.velocity.x < -vxCap) b.velocity.x = -vxCap;
          },
          reset: function () { clock = spec.phase ? spec.phase * period : 0; active = false; }
        };
      }
    };

    // PUBLIC: the dictionary is iterable + queryable by Studio.Feel / docs.
    // Studio.Contraptions.types  -> ['seesaw','launcher','crumble', …]
    // Studio.Contraptions.get(t) -> the registry entry (with build())
    // Studio.Contraptions.meta(t)-> { feeling, lens, weight } (no build fn)
    REGISTRY.types = Object.keys(REGISTRY).filter(function (k) { return REGISTRY[k] && REGISTRY[k].build; });
    REGISTRY.has = function (t) { return !!(REGISTRY[t] && REGISTRY[t].build); };
    REGISTRY.get = function (t) { return REGISTRY[t]; };
    REGISTRY.meta = function (t) {
      var e = REGISTRY[t]; if (!e) return null;
      return { feeling: e.feeling, lens: e.lens, weight: e.weight };
    };
    // build a contraption record from a spec ({type, x, ...}) against a world/level
    REGISTRY.build = function (scene, spec, world, levelSpec) {
      var e = REGISTRY[spec && spec.type];
      if (!e || !e.build) return null;
      // pass groundY/tile defaults down so contraption specs can be terse
      var merged = Object.assign({ tile: levelSpec && levelSpec.tile, groundY: levelSpec && levelSpec.groundY }, spec);
      var rec = e.build(scene, merged, world);
      if (rec) { rec.feeling = e.feeling; rec.lens = e.lens; rec.weight = e.weight; }
      return rec;
    };
    return REGISTRY;
  })();

  // --------------------------------------------------------------- Level DSL
  // A level is data. build() returns { platforms, hazards, coins, enemies, spawn, goalX, springs, movers, contraptions, tick }.
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
      (spec.platforms || []).forEach(function (p) {
        var pm = Studio.Materials.get(p.mat || 'solid');
        slab(pm.deadly ? hazards : platforms, p.x + p.w / 2, p.y + T / 2, p.w, T, p.mat || 'solid');
      });
      var coins = scene.physics.add.staticGroup();
      (spec.coins || []).forEach(function (c) { coins.create(c.x, c.y, 'coin'); });
      var enemies = scene.physics.add.group({ allowGravity: false, immovable: true });
      (spec.enemies || []).forEach(function (e) {
        // vertical levels give enemies an explicit y (patrolling a platform line)
        var s = enemies.create(e.x, e.y != null ? e.y : spec.groundY - 14, 'enemy'); s.patrol = e.patrol || 60; s.homeX = e.x; s.dir = 1;
      });

      // SPRINGS — bounce pads sitting on the ground line. A static body the game
      // overlaps to fling the player up (Studio.Platformer .launch). Run INTO at
      // speed, so no pixel-perfect landing is needed and it is NOT a step to hop.
      var springs = scene.physics.add.staticGroup();
      (spec.springs || []).forEach(function (s) {
        var img = springs.create(s.x, s.y != null ? s.y : spec.groundY - 9, 'spring'); img.refreshBody();
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

      // CONTRAPTIONS — kinematic themed machines from Studio.Contraptions. Each
      // spec ({type, x, ...}) is built through the registry into a record carrying
      // its own phase clock; the records are advanced inside world.tick(dt) below
      // (deterministic, exactly like movers) and reset via world.resetContraptions().
      var contraptions = [];
      (spec.contraptions || []).forEach(function (cs) {
        var rec = Studio.Contraptions.build(scene, cs, { platforms: platforms, hazards: hazards }, spec);
        if (rec) contraptions.push(rec);
      });
      // sugar: spec.updrafts / spec.gusts are contraption shorthands (the vertical
      // archetype's signature verbs) — routed through the same registry/clock.
      (spec.updrafts || []).forEach(function (u) {
        var rec = Studio.Contraptions.build(scene, Object.assign({ type: 'updraft' }, u), { platforms: platforms, hazards: hazards }, spec);
        if (rec) contraptions.push(rec);
      });
      (spec.gusts || []).forEach(function (g) {
        var rec = Studio.Contraptions.build(scene, Object.assign({ type: 'gust' }, g), { platforms: platforms, hazards: hazards }, spec);
        if (rec) contraptions.push(rec);
      });

      // deterministic phase clock for movers — advanced by the caller's fixed dt
      var clock = 0;
      function tick(dt) {
        // advance contraptions every tick (their motion is a pure fn of their clock)
        for (var c = 0; c < contraptions.length; c++) { if (contraptions[c].tick) contraptions[c].tick(dt); }
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
        contraptions: contraptions,
        // generic per-frame interaction pass — the game calls this once a frame with
        // the player + {dt, pc} so each contraption can carry/launch/collapse via the
        // registry (no per-type wiring needed in the game).
        contraptionsInteract: function (player, ctx) {
          for (var i = 0; i < contraptions.length; i++) { if (contraptions[i].interact) contraptions[i].interact(player, ctx); }
        },
        // restore all contraptions to their armed/full state (called on level reset
        // BEFORE the deterministic gate run, so crumble ledges come back, clocks reseed)
        resetContraptions: function () {
          for (var i = 0; i < contraptions.length; i++) { if (contraptions[i].reset) contraptions[i].reset(); }
        },
        spawn: spec.spawn || { x: 60, y: spec.groundY - 80 },
        goalX: spec.goal != null ? spec.goal : (spec.width - 60),
        // vertical levels climb to a goal near the top instead of running right
        goalY: spec.goalY != null ? spec.goalY : null
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
    // VERTICAL policy (climb games): chase an ordered waypoint chain upward.
    // sense = { x, y, onGround, vy, target:{x,y}, inUpdraft }
    // - steer toward the target's x;
    // - inside an updraft: just ride (steer only — the column does the lifting);
    // - on the ground, roughly under a target that sits above: full hop
    //   (held through the ascent, same variable-jump-aware hold as the runner).
    vertical: function (sense) {
      var out = { left: false, right: false, jump: false };
      if (sense.inUpdraft) {
        // RIDE the column: hold its center (keep the lift) until risen to within
        // ~80px of the exit's height, THEN steer out onto the (wide) exit ledge.
        // The column extends above the exit so there's lift in reserve while the
        // player drifts the offset.
        var holdX = (sense.updraftX != null && sense.y > sense.target.y + 80) ? sense.updraftX : sense.target.x;
        var dh = holdX - sense.x;
        if (dh < -6) out.left = true; else if (dh > 6) out.right = true;
        return out;
      }
      var dx = sense.target.x - sense.x;
      if (dx < -8) out.left = true; else if (dx > 8) out.right = true;
      var above = sense.target.y < sense.y - 12;
      if (sense.onGround && above && Math.abs(dx) < 150) out.jump = true;
      else if (!sense.onGround && sense.vy != null && sense.vy < -10) out.jump = true;
      // GUST TIMING: don't launch INTO an active crosswind — wait on the ground
      // for the lull (the gust's duty cycle), then hop cleanly. This is the verb's
      // intended feel AND keeps the deterministic gate progressing (it would
      // otherwise retry at the same blowing phase forever).
      if (out.jump && sense.onGround && sense.gustActive) out.jump = false;
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
          x: { min: 0, max: w }, lifespan: opt.lifespan || 5000, speedY: { min: opt.vyMin != null ? opt.vyMin : 16, max: opt.vyMax || 50 }, speedX: opt.drift ? { min: -opt.drift, max: opt.drift } : 0,
          scale: { start: opt.scale || 0.7, end: 0 }, alpha: { start: opt.alpha || 0.4, end: 0 }, quantity: 1, frequency: opt.frequency || 120, blendMode: 'ADD', tint: opt.tint
        });
      } catch (e) {}
    },
    // a layered EXPLOSION: a bright core flash-ring + flung sparks + slow smoke,
    // with optional shake/flash. The go-to "something died/blew up" effect.
    explode: function (scene, x, y, opt) {
      opt = opt || {}; var n = opt.n || 16, tint = opt.tint != null ? opt.tint : 0xffa53c;
      this.ring(scene, x, y, { tint: opt.ringTint != null ? opt.ringTint : 0xfff0a0, r: opt.r || 46, life: 260 });
      this.burst(scene, x, y, { texture: opt.texture || 'spark', n: n, tint: tint, life: opt.life || 460, spMax: opt.spMax || 220 });
      this.burst(scene, x, y, { texture: opt.smoke || opt.texture || 'spark', n: Math.max(4, n / 2), tint: opt.smokeTint != null ? opt.smokeTint : 0x4a4036, life: (opt.life || 460) * 1.6, spMax: 70, scale: 1.4 });
      if (opt.shake) this.shake(scene, opt.shake, opt.shakeAmt || 0.01);
      if (opt.flash) this.flash(scene, 120, 255, 200, 120);
    },
    // an expanding SHOCKWAVE ring (a stroked circle that grows + fades).
    ring: function (scene, x, y, opt) {
      opt = opt || {};
      try {
        var g = scene.add.circle(x, y, 6, 0, 0).setStrokeStyle(opt.width || 3, opt.tint != null ? opt.tint : 0xffffff, 1).setDepth(opt.depth || 30);
        scene.tweens.add({ targets: g, radius: opt.r || 40, alpha: 0, duration: opt.life || 280, ease: 'Cubic.out', onComplete: function () { try { g.destroy(); } catch (e) {} } });
        return g;
      } catch (e) {}
    },
    // a brief directional MUZZLE FLASH at a gun's tip.
    muzzle: function (scene, x, y, opt) {
      opt = opt || {};
      try {
        var f = scene.add.image(x, y, opt.texture || 'spark').setTint(opt.tint != null ? opt.tint : 0xfff2a0).setScale(opt.scale || 1.3).setDepth(opt.depth || 12).setBlendMode('ADD');
        scene.tweens.add({ targets: f, scale: 0, alpha: 0, duration: opt.life || 110, onComplete: function () { try { f.destroy(); } catch (e) {} } });
        return f;
      } catch (e) {}
    },
    // floating COMBAT TEXT (damage numbers, "+scrap") — rises and fades.
    popText: function (scene, x, y, txt, opt) {
      opt = opt || {};
      try {
        var t = scene.add.text(x, y, String(txt), { fontFamily: opt.font || 'Georgia, serif', fontSize: (opt.size || 14) + 'px', color: opt.color || '#ffe7a0', stroke: '#1a1208', strokeThickness: 3 }).setOrigin(0.5).setDepth(opt.depth || 40);
        scene.tweens.add({ targets: t, y: y - (opt.rise || 26), alpha: 0, duration: opt.life || 700, ease: 'Quad.out', onComplete: function () { try { t.destroy(); } catch (e) {} } });
        return t;
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
    // PROCEDURAL music bed — Studio.Audio.music('proc:<mood>') synthesizes a quiet
    // looping ambience (two slow detuned drones through a lowpass, breathing via an
    // LFO, plus a sparse seeded pentatonic pluck) instead of streaming a file.
    // Call it from a USER-GESTURE handler (autoplay policy); it never touches game
    // state, so the deterministic gate is unaffected. Returns { stop() }.
    var MOODS = { cave: { root: 55, fifth: 82.41, cutoff: 420, pluck: [220, 261.63, 293.66, 329.63, 392] } };
    function bed(mood, vol) {
      var a = ac(); if (!a) return null;
      var m = MOODS[mood] || MOODS.cave, master = a.createGain(), lp = a.createBiquadFilter();
      master.gain.value = (vol || 0.3) * 0.5; lp.type = 'lowpass'; lp.frequency.value = m.cutoff;
      lp.connect(master); master.connect(a.destination);
      var stops = [];
      [m.root, m.root * 1.005, m.fifth].forEach(function (f, i) {
        var o = a.createOscillator(), g = a.createGain();
        o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f; g.gain.value = i === 2 ? 0.18 : 0.3;
        var lfo = a.createOscillator(), lg = a.createGain();
        lfo.frequency.value = 0.06 + i * 0.021; lg.gain.value = 0.12;     // slow breathing
        lfo.connect(lg); lg.connect(g.gain);
        o.connect(g); g.connect(lp); o.start(); lfo.start();
        stops.push(o, lfo);
      });
      var step = 0, timer = setInterval(function () {                      // sparse seeded pluck
        step++; if ((step * 2654435761 >>> 0) % 7 > 1) return;
        var n = m.pluck[(step * 40503 >>> 0) % m.pluck.length];
        var o = a.createOscillator(), g = a.createGain();
        o.type = 'sine'; o.frequency.value = n; g.gain.value = 0.05;
        o.connect(g); g.connect(lp);
        var t = a.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); o.stop(t + 1.4);
      }, 1800);
      var baseGain = master.gain.value;
      return {
        stop: function () { try { clearInterval(timer); stops.forEach(function (o) { o.stop(); }); master.disconnect(); } catch (e) {} },
        mute: function (m) { try { master.gain.value = m ? 0 : baseGain; } catch (e) {} }
      };
    }
    // mute plumbing: every bed (proc handle or <audio>) registers here so the
    // Shell's mute / pause controls reach playback without owning the handles.
    var muted = false, beds = [];
    function applyMute(h, m) {
      try {
        if (!h) return;
        if (h.mute) h.mute(m);                      // proc bed handle
        else if ('muted' in h) h.muted = m;         // HTMLAudioElement
      } catch (e) {}
    }
    var musicBed = null, musicUrl = null;
    function startBedHandle(url, vol) {
      var h;
      if (typeof url === 'string' && url.indexOf('proc:') === 0) h = bed(url.slice(5), vol);
      else { h = new Audio(url); h.loop = true; h.volume = vol || 0.4; h.play(); }
      if (h) { beds.push(h); applyMute(h, muted); }
      return h;
    }
    return {
      sfx: function (n) { if (muted) return; try { (SFX[n] || function () {})(); } catch (e) {} },
      music: function (url, vol) {
        try { var h = startBedHandle(url, vol); if (h) { musicBed = h; musicUrl = url; } return h; } catch (e) {}
      },
      // PER-LEVEL MUSIC — swap the looping track (fade the old out, the new in).
      // Cosmetic only (never in a snapshot), so it can't affect determinism.
      switchMusic: function (url, vol) {
        try {
          if (!url || url === musicUrl) return musicBed;
          var old = musicBed, tv = vol != null ? vol : 0.5;
          var nu = startBedHandle(url, 0); if (!nu) return musicBed;
          musicBed = nu; musicUrl = url;
          var step = 0, steps = 16;
          var id = setInterval(function () {
            step++; var k = step / steps;
            try { if (nu.volume != null) nu.volume = Math.min(tv, tv * k); } catch (e) {}
            try { if (old && old.volume != null) old.volume = Math.max(0, (old._v0 || 0.5) * (1 - k)); } catch (e) {}
            if (step >= steps) { clearInterval(id); try { if (old && old.pause) old.pause(); } catch (e) {} var i = beds.indexOf(old); if (i >= 0) beds.splice(i, 1); }
          }, 45);
          return nu;
        } catch (e) {}
      },
      currentMusic: function () { return musicUrl; },
      setMuted: function (m) { muted = !!m; beds.forEach(function (h) { applyMute(h, muted); }); },
      isMuted: function () { return muted; }
    };
  })();

  // PER-LEVEL MUSIC resolver — the one place every archetype asks "what track for
  // level i?". Precedence: the level's own `music` → theme `musicByLevel[i]` →
  // the single theme `music.url`. So a game gets a distinct score per level by
  // declaring either levels[i].music or theme.musicByLevel (else it loops one bed).
  Studio.levelMusic = function (TH, LEVELS, i) {
    var s = (LEVELS && LEVELS[i]) || {};
    var t = s.music || (TH.musicByLevel && TH.musicByLevel[i]) || (TH.music && TH.music.url) || null;
    return typeof t === 'string' ? t : (t && t.url) || null;
  };

  // ---------------------------------------------------------------------- Iso
  // A reusable perspective-ISO PROJECTOR — the building block behind every
  // isometric game (not just the RTS). Configure the screen anchors once, then
  // project (lx∈[-1,1] across, t∈[0,1] depth: 0 far/top, 1 near/bottom) → a screen
  // point with a perspective SCALE and a DEPTH for sorting (near draws over far).
  // `lxAt` inverts a click back to lx; `place` positions+scales+depth-sorts a sprite.
  Studio.Iso = {
    projector: function (o) {
      o = o || {};
      var farY = o.farY != null ? o.farY : 120, nearY = o.nearY != null ? o.nearY : 470, cx = o.cx != null ? o.cx : 480;
      var farHalf = o.farHalf || 150, nearHalf = o.nearHalf || 330, farSc = o.farScale || 0.52, nearSc = o.nearScale || 1.04, dBase = o.depthBase || 10, dSpan = o.depthSpan || 120;
      return {
        at: function (lx, t) { var hw = farHalf + t * (nearHalf - farHalf); return { sx: cx + lx * hw, sy: farY + t * (nearY - farY), sc: farSc + t * (nearSc - farSc), depth: dBase + t * dSpan }; },
        lxAt: function (px) { return Math.max(-1, Math.min(1, (px - cx) / nearHalf)); },
        place: function (spr, lx, t, baseScale) { var p = this.at(lx, t); spr.setPosition(p.sx, p.sy); spr.setScale((baseScale || 1) * p.sc); spr.setDepth(p.depth); return p; }
      };
    }
  };

  // SYSTEMATIC enemy pressure — the engine's tension knob (mirrors tools/eval/
  // pressure.mjs verbatim; the 0-death gate keeps the mirror honest). A level's
  // `difficulty` (0..1) deterministically expands its schedule with FLANK waves
  // (off-rally units that bypass the centre deathball and pressure the HQ → garage
  // damage = tension, and a flank-aware strategy beats a centre-only one = depth).
  Studio.rtsPressure = function (spec, mode) {
    var base = (spec.schedule || []).map(function (e) { var o = {}; for (var k in e) o[k] = e[k]; return o; });
    var d = spec.difficulty || 0;
    if (d > 0) {
      var span = base.reduce(function (m, e) { return Math.max(m, e.t); }, 20), n = Math.round(d * 12);
      for (var k = 0; k < n; k++) {
        var t = +(6 + (span - 4) * (k / Math.max(1, n - 1))).toFixed(2), left = k % 2 === 0, heavy = d > 0.45 && k % 3 !== 0;
        var e = { t: t, type: heavy ? 'brawler' : 'scout', flank: true };
        if (mode === 'lane') e.lane = left ? 0 : 2; else e.lx = left ? -0.62 : 0.62;
        base.push(e);
      }
      base.sort(function (a, b) { return a.t - b.t; });
    }
    return base;
  };

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
      // opt.theme lets a game match the touch UI to its art direction (additive;
      // defaults are the original neutral palette).
      var th = Object.assign({
        base: 0x0f1528, baseA: 0.4, baseStroke: 0xffffff,
        thumb: 0x2a3556, thumbStroke: 0xffd34d,
        btn: 0x3a1420, btnA: 0.5, btnStroke: 0xffae6b, label: '#ffce9e'
      }, opt.theme || {});
      var bx = 120, by = H - 86, R = 68;
      var ring = scene.add.circle(bx, by, R, th.base, th.baseA).setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(3, th.baseStroke, 0.22);
      var thumb = scene.add.circle(bx, by, 30, th.thumb, 0.9).setScrollFactor(0).setDepth(DEPTH + 1).setStrokeStyle(3, th.thumbStroke, 0.85);
      var jx = W - 96, jy = H - 84;
      var jbtn = scene.add.circle(jx, jy, 54, th.btn, th.btnA).setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(3, th.btnStroke, 0.7).setInteractive();
      // opt.button: false hides the action button (auto-fire shooters have no jump);
      // a string relabels it ('FIRE', 'BOOST', …). Default stays 'JUMP'.
      var jlbl = scene.add.text(jx, jy, typeof opt.button === 'string' ? opt.button : 'JUMP', { fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '13px', color: th.label }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 1);
      // touch UI only ON TOUCH DEVICES (opt.always forces it): a desktop/keyboard
      // player should never stare at a joystick they can't use.
      if (!isTouch && !opt.always) [ring, thumb, jbtn, jlbl].forEach(function (e) { e.setVisible(false); });
      if (opt.button === false) { jbtn.setVisible(false); jlbl.setVisible(false); jbtn.disableInteractive(); }
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

  // -------------------------------------------------------------------- Save
  // Per-game progress in localStorage (parity with jazz/starsweeper: unlocked
  // levels + best coins/time survive a refresh). EVAL-SAFE: the harness path
  // never reads or writes it (boot()'s reset() always starts level 0 and only
  // MANUAL play records progress), so the deterministic gate can't be affected
  // by stale browser state. All calls guarded — headless/incognito no-op.
  Studio.Save = {
    _key: function (slug) { return 'studio:' + slug; },
    load: function (slug) {
      try { return JSON.parse(localStorage.getItem(this._key(slug))) || { unlocked: 1, best: {} }; }
      catch (e) { return { unlocked: 1, best: {} }; }
    },
    // record a level clear: unlock the next level, keep best coins (max) + time (min)
    levelClear: function (slug, levelIndex, stats) {
      try {
        var s = this.load(slug);
        s.unlocked = Math.max(s.unlocked || 1, levelIndex + 2);
        var b = s.best[levelIndex] || {};
        if (stats && stats.coins != null) b.coins = Math.max(b.coins || 0, stats.coins);
        if (stats && stats.timeMs != null) b.timeMs = b.timeMs != null ? Math.min(b.timeMs, stats.timeMs) : stats.timeMs;
        s.best[levelIndex] = b;
        localStorage.setItem(this._key(slug), JSON.stringify(s));
        return s;
      } catch (e) { return null; }
    }
  };

  // ----------------------------------------------------------------------- UI
  // The engine's UI KIT — canvas-native (scales with the game, no DOM), pixel-
  // friendly chunky styling, themed by tokens. Born for the world-builder's
  // build-palette/resource HUD and reusable by every archetype:
  //   panel  · a bordered backdrop block        button · hover/press/disabled
  //   card   · icon+label+cost, selectable      bar    · icon + animated counter
  //   tooltip· singleton hover hint
  // All objects are plain Phaser nodes in a container — destroy() cleans up.
  Studio.UI = {
    theme: function (t) {
      return Object.assign({ bg: 0x1c2616, bgA: 0.92, border: 0x6fae4e, border2: 0x2e4420, text: '#e8f4d8', sub: '#a8c890', accent: 0xffd166, bad: 0xd64a4a, font: 'Georgia, "Times New Roman", serif' }, t || {});
    },
    panel: function (scene, x, y, w, h, opt) {
      opt = opt || {}; var th = this.theme(opt.theme);
      var c = scene.add.container(x, y).setDepth(opt.depth != null ? opt.depth : 300);
      var sh = scene.add.rectangle(3, 4, w, h, 0x000000, 0.35).setOrigin(0);            // chunky drop shadow
      var bgR = scene.add.rectangle(0, 0, w, h, th.bg, opt.alpha != null ? opt.alpha : th.bgA).setOrigin(0).setStrokeStyle(2, th.border, 1);
      var inner = scene.add.rectangle(3, 3, w - 6, h - 6, 0x000000, 0).setOrigin(0).setStrokeStyle(1, th.border2, 1);
      c.add([sh, bgR, inner]);
      if (opt.title) c.add(scene.add.text(10, 7, opt.title, { fontFamily: th.font, fontSize: '14px', color: th.text, fontStyle: 'bold' }));
      c._bg = bgR; c._w = w; c._h = h; return c;
    },
    button: function (scene, x, y, w, h, label, opt) {
      opt = opt || {}; var th = this.theme(opt.theme);
      var c = scene.add.container(x, y).setDepth(opt.depth != null ? opt.depth : 301);
      var bgR = scene.add.rectangle(0, 0, w, h, opt.primary ? th.accent : th.bg, 1).setOrigin(0).setStrokeStyle(2, opt.primary ? 0xffffff : th.border, 1);
      var tx = scene.add.text(w / 2, h / 2, label, { fontFamily: th.font, fontSize: (opt.size || 13) + 'px', color: opt.primary ? '#332200' : th.text }).setOrigin(0.5);
      c.add([bgR, tx]); c._bg = bgR; c._tx = tx;
      bgR.setInteractive({ useHandCursor: true });
      bgR.on('pointerover', function () { if (!c._disabled) bgR.setFillStyle(opt.primary ? 0xffe49a : 0x2a3a20, 1); });
      bgR.on('pointerout', function () { bgR.setFillStyle(opt.primary ? th.accent : th.bg, 1); c.setScale(1); });
      bgR.on('pointerdown', function () { if (!c._disabled) c.setScale(0.97); });
      bgR.on('pointerup', function () { c.setScale(1); if (!c._disabled && opt.onClick) opt.onClick(); });
      c.setDisabled = function (d) { c._disabled = d; c.setAlpha(d ? 0.45 : 1); };
      return c;
    },
    // a BUILD CARD: icon + name + cost; select() highlights; setAffordable() greys.
    card: function (scene, x, y, opt) {
      opt = opt || {}; var th = this.theme(opt.theme), w = opt.w || 86, h = opt.h || 96;
      var c = scene.add.container(x, y).setDepth(opt.depth != null ? opt.depth : 301);
      var bgR = scene.add.rectangle(0, 0, w, h, th.bg, 0.94).setOrigin(0).setStrokeStyle(2, th.border, 1);
      c.add(bgR);
      var icon = null;
      if (opt.icon && scene.textures.exists(opt.icon)) {
        icon = scene.add.image(w / 2, 34, opt.icon);
        var k = Math.min(56 / icon.width, 44 / icon.height); icon.setScale(k);
        c.add(icon);
      }
      var name = scene.add.text(w / 2, 62, opt.label || '?', { fontFamily: th.font, fontSize: '11px', color: th.text, align: 'center', wordWrap: { width: w - 8 } }).setOrigin(0.5, 0);
      var cost = scene.add.text(w / 2, h - 14, opt.cost || '', { fontFamily: th.font, fontSize: '11px', color: th.sub }).setOrigin(0.5);
      c.add([name, cost]);
      bgR.setInteractive({ useHandCursor: true });
      bgR.on('pointerover', function () { if (!c._off) bgR.setStrokeStyle(2, th.accent, 1); if (opt.onHover) opt.onHover(true, c); });
      bgR.on('pointerout', function () { if (!c._sel) bgR.setStrokeStyle(2, th.border, 1); if (opt.onHover) opt.onHover(false, c); });
      bgR.on('pointerup', function () { if (!c._off && opt.onClick) opt.onClick(c); });
      c.select = function (on) { c._sel = on; bgR.setStrokeStyle(on ? 3 : 2, on ? th.accent : th.border, 1); bgR.setFillStyle(on ? 0x2a3a20 : th.bg, 0.94); c.y = y - (on ? 6 : 0); };
      c.setAffordable = function (ok) { c._off = !ok; c.setAlpha(ok ? 1 : 0.45); };
      c._bg = bgR; return c;
    },
    // a RESOURCE BAR item: icon + label + an animated count (tweens to the target).
    bar: function (scene, x, y, opt) {
      opt = opt || {}; var th = this.theme(opt.theme);
      var c = scene.add.container(x, y).setDepth(opt.depth != null ? opt.depth : 302);
      var bgR = scene.add.rectangle(0, 0, opt.w || 118, 30, th.bg, 0.9).setOrigin(0).setStrokeStyle(2, th.border, 1);
      c.add(bgR);
      var ixOff = 16;
      if (opt.icon && scene.textures.exists(opt.icon)) { var ic = scene.add.image(16, 15, opt.icon); ic.setScale(Math.min(22 / ic.width, 22 / ic.height)); c.add(ic); ixOff = 30; }
      else if (opt.emoji) { c.add(scene.add.text(8, 6, opt.emoji, { fontSize: '16px' })); ixOff = 30; }
      var tx = scene.add.text(ixOff, 15, '0', { fontFamily: th.font, fontSize: '14px', color: th.text, fontStyle: 'bold' }).setOrigin(0, 0.5);
      var lb = opt.label ? scene.add.text((opt.w || 118) - 8, 15, opt.label, { fontFamily: th.font, fontSize: '10px', color: th.sub }).setOrigin(1, 0.5) : null;
      if (lb) c.add(lb);
      c.add(tx); c._shown = 0; c._target = 0;
      c.set = function (v, suffix) {
        c._target = v;
        scene.tweens.addCounter({ from: c._shown, to: v, duration: 260, onUpdate: function (tw) { c._shown = tw.getValue(); tx.setText(Math.round(c._shown) + (suffix || '')); }, onComplete: function () { c._shown = v; } });
      };
      c.flash = function (bad) { scene.tweens.add({ targets: c, scale: 1.08, yoyo: true, duration: 90 }); bgR.setStrokeStyle(2, bad ? th.bad : th.accent, 1); scene.time.delayedCall(300, function () { bgR.setStrokeStyle(2, th.border, 1); }); };
      return c;
    },
    // singleton tooltip that follows the pointer.
    tooltip: function (scene, opt) {
      var th = this.theme(opt && opt.theme);
      var c = scene.add.container(0, 0).setDepth(500).setVisible(false);
      var bgR = scene.add.rectangle(0, 0, 10, 10, 0x10160c, 0.96).setOrigin(0).setStrokeStyle(1, th.border, 1);
      var tx = scene.add.text(6, 4, '', { fontFamily: th.font, fontSize: '11px', color: th.text, wordWrap: { width: 190 } });
      c.add([bgR, tx]);
      scene.input.on('pointermove', function (p) { if (c.visible) c.setPosition(Math.min(p.x + 12, scene.scale.width - bgR.width - 4), Math.min(p.y + 14, scene.scale.height - bgR.height - 4)); });
      return {
        show: function (text, p) { tx.setText(text); bgR.setSize(tx.width + 12, tx.height + 8); if (p) c.setPosition(p.x + 12, p.y + 14); c.setVisible(true); },
        hide: function () { c.setVisible(false); },
        destroy: function () { try { c.destroy(); } catch (e) {} }
      };
    }
  };

  // ------------------------------------------------------------------- Shell
  // The PLAYTEST SHELL — the hub-convention front end every Studio game host
  // already serves an API for (server.js: /api/notes, /api/meta). A DOM overlay
  // (not canvas) so it works while the scene is paused and never touches the
  // render pipeline:
  //   ⏸ pause/resume the scene (music auto-ducks)   ↻ restart (game callback)
  //   📝 note-taking: pauses, opens a panel, POSTs {text + game context} to
  //      /api/notes and lists the latest notes back        🔊 mute toggle
  // Everything is INERT until clicked — the eval harness never clicks, so the
  // deterministic gate is unaffected.
  Studio.Shell = {
    create: function (scene, opt) {
      opt = opt || {};
      if (typeof document === 'undefined') return null;
      var th = Object.assign({ bg: 'rgba(20,13,8,0.82)', border: '#ffb24a', text: '#ffd9a0', accent: '#ff9a3c' }, opt.theme || {});
      var FONT = 'Georgia, "Times New Roman", serif';
      var key = scene.scene.key, mgr = scene.sys.game.scene;
      var paused = false, userMuted = false, panelOpen = false, pausedByPanel = false;

      // corner links (deepfin convention): DIARY / REPO / ENGINE, top-left
      if (opt.links && opt.links.length) {
        var corner = document.createElement('div');
        corner.id = 'studio-links';
        corner.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));z-index:1000;display:flex;flex-direction:column;gap:2px;font-family:' + FONT + ';font-size:11px;opacity:.85;';
        opt.links.forEach(function (l) {
          var a = document.createElement('a');
          a.textContent = l.label; a.href = l.href; a.target = '_blank'; a.rel = 'noopener';
          a.style.cssText = 'color:' + th.text + ';text-decoration:none;text-shadow:0 1px 3px #000;';
          a.onmouseover = function () { a.style.textDecoration = 'underline'; };
          a.onmouseout = function () { a.style.textDecoration = 'none'; };
          corner.appendChild(a);
        });
        document.body.appendChild(corner);
      }

      var root_ = document.createElement('div');
      root_.id = 'studio-shell';
      root_.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));z-index:1000;display:flex;gap:8px;font-family:' + FONT + ';';
      document.body.appendChild(root_);

      function btn(label, title) {
        var b = document.createElement('button');
        b.textContent = label; b.title = title;
        b.style.cssText = 'width:40px;height:40px;border-radius:10px;border:1px solid ' + th.border + ';background:' + th.bg + ';color:' + th.text + ';font-size:18px;line-height:1;cursor:pointer;padding:0;touch-action:manipulation;';
        root_.appendChild(b); return b;
      }
      var bPause = btn('⏸', 'pause / resume');
      var bNotes = btn('📝', 'playtest notes');
      var bRestart = btn('↻', 'restart');
      var bMute = btn('🔊', 'mute / unmute');

      var veil = document.createElement('div');   // PAUSED veil
      veil.textContent = 'PAUSED';
      veil.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:998;background:rgba(10,5,3,0.45);color:' + th.text + ';font-family:' + FONT + ';font-size:42px;letter-spacing:6px;text-shadow:0 2px 8px #000;pointer-events:none;';
      document.body.appendChild(veil);

      function setPaused(p) {
        if (p === paused) return;
        paused = p;
        try { p ? mgr.pause(key) : mgr.resume(key); } catch (e) {}
        try { Studio.Audio.setMuted(p || userMuted); } catch (e) {}
        bPause.textContent = p ? '▶' : '⏸';
        veil.style.display = (p && !panelOpen) ? 'flex' : 'none';
        if (opt.onPause) try { opt.onPause(p); } catch (e) {}
      }
      bPause.onclick = function () { setPaused(!paused); };
      bRestart.onclick = function () { setPaused(false); closePanel(); if (opt.onRestart) try { opt.onRestart(); } catch (e) {} };
      bMute.onclick = function () { userMuted = !userMuted; try { Studio.Audio.setMuted(userMuted || paused); } catch (e) {} bMute.textContent = userMuted ? '🔇' : '🔊'; };

      // ---- notes panel (open = auto-pause + keyboard released to the textarea) ----
      var panel = document.createElement('div');
      panel.style.cssText = 'position:fixed;top:calc(56px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));z-index:999;width:min(320px,calc(100vw - 24px));background:' + th.bg + ';border:1px solid ' + th.border + ';border-radius:12px;padding:10px;display:none;color:' + th.text + ';font-family:' + FONT + ';backdrop-filter:blur(3px);';
      panel.innerHTML =
        '<div style="font-size:14px;margin-bottom:6px;">📝 Playtest notes <span data-ctx style="opacity:.7;font-size:12px;"></span></div>' +
        '<textarea data-text rows="3" placeholder="what did you feel / find?" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,.35);border:1px solid ' + th.border + ';border-radius:8px;color:' + th.text + ';font-family:' + FONT + ';font-size:14px;padding:6px;"></textarea>' +
        '<div style="display:flex;gap:8px;margin-top:6px;align-items:center;">' +
        '<button data-save style="flex:0 0 auto;border:1px solid ' + th.border + ';background:' + th.accent + ';color:#221007;border-radius:8px;padding:6px 14px;font-family:' + FONT + ';font-size:14px;cursor:pointer;">Save note</button>' +
        '<span data-status style="font-size:12px;opacity:.8;"></span></div>' +
        '<div data-list style="margin-top:8px;font-size:12px;line-height:1.5;max-height:130px;overflow:auto;"></div>';
      document.body.appendChild(panel);
      var ta = panel.querySelector('[data-text]'), status = panel.querySelector('[data-status]'),
          list = panel.querySelector('[data-list]'), ctxEl = panel.querySelector('[data-ctx]');

      // ---- tap-to-annotate: freeze, capture the canvas, mark the tapped spot ----
      // The screenshot (with a dot drawn where the player tapped) rides along with
      // the note → the server uploads it to the repo and embeds it in the issue.
      var pendingShot = null, pendingTap = null, dotEl = null;
      function captureShot(tapNorm) {
        try {
          var cv = scene.sys.game.canvas;
          var snap = document.createElement('canvas'); snap.width = cv.width; snap.height = cv.height;
          var g2 = snap.getContext('2d'); g2.drawImage(cv, 0, 0);
          if (tapNorm) {
            var px = tapNorm.x * snap.width, py = tapNorm.y * snap.height;
            g2.lineWidth = 6; g2.strokeStyle = '#ffffff'; g2.beginPath(); g2.arc(px, py, 20, 0, Math.PI * 2); g2.stroke();
            g2.lineWidth = 3.5; g2.strokeStyle = '#ff3b30'; g2.beginPath(); g2.arc(px, py, 20, 0, Math.PI * 2); g2.stroke();
            g2.fillStyle = '#ff3b30'; g2.beginPath(); g2.arc(px, py, 5, 0, Math.PI * 2); g2.fill();
          }
          return snap.toDataURL('image/jpeg', 0.78);
        } catch (e) { return null; }
      }
      function showDot(clientX, clientY) {
        clearDot();
        dotEl = document.createElement('div');
        dotEl.style.cssText = 'position:fixed;left:' + (clientX - 14) + 'px;top:' + (clientY - 14) + 'px;width:28px;height:28px;border-radius:50%;border:3px solid #ff3b30;box-shadow:0 0 0 3px #fff,0 0 14px rgba(255,59,48,.8);z-index:998;pointer-events:none;';
        var core = document.createElement('div');
        core.style.cssText = 'position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#ff3b30;';
        dotEl.appendChild(core); document.body.appendChild(dotEl);
      }
      function clearDot() { if (dotEl) { try { dotEl.remove(); } catch (e) {} dotEl = null; } }
      var marker = document.createElement('div');  // the "tap the spot" layer
      marker.style.cssText = 'position:fixed;inset:0;z-index:997;display:none;cursor:crosshair;';
      var hint = document.createElement('div');
      hint.innerHTML = '📍 tap where the issue is &nbsp;<button data-skip style="border:1px solid ' + th.border + ';background:' + th.bg + ';color:' + th.text + ';border-radius:8px;padding:4px 12px;font-family:' + FONT + ';font-size:13px;cursor:pointer;">skip — just write</button>';
      hint.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom,0px));background:' + th.bg + ';border:1px solid ' + th.border + ';border-radius:12px;padding:8px 14px;color:' + th.text + ';font-family:' + FONT + ';font-size:14px;z-index:1001;display:none;backdrop-filter:blur(3px);';
      document.body.appendChild(marker); document.body.appendChild(hint);
      var marking = false;
      function startMark() {
        marking = true; pausedByPanel = !paused; setPaused(true); veil.style.display = 'none';
        marker.style.display = 'block'; hint.style.display = 'block';
      }
      function endMark() { marking = false; marker.style.display = 'none'; hint.style.display = 'none'; }
      marker.onclick = function (e) {
        var cv = scene.sys.game.canvas, r = cv.getBoundingClientRect();
        var nx = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
        var ny = Math.max(0, Math.min(1, (e.clientY - r.top) / Math.max(1, r.height)));
        pendingTap = { x: +nx.toFixed(4), y: +ny.toFixed(4) };
        pendingShot = captureShot(pendingTap);
        showDot(e.clientX, e.clientY);
        endMark(); openPanel(true);
      };
      hint.querySelector('[data-skip]').onclick = function () { pendingTap = null; pendingShot = captureShot(null); endMark(); openPanel(true); };

      function refreshList() {
        fetch('/api/notes').then(function (r) { return r.json(); }).then(function (ns) {
          var last = (ns || []).slice(-4).reverse();
          list.innerHTML = last.length
            ? last.map(function (n) { return '<div style="border-top:1px dashed rgba(255,178,74,.3);padding-top:4px;margin-top:4px;">' + String(n.text || '').replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }) + ' <span style="opacity:.55">— ' + (n.where || '') + '</span></div>'; }).join('')
            : '<em style="opacity:.6">no notes yet — first one sets the bar</em>';
        }).catch(function () { list.innerHTML = '<em style="opacity:.6">notes API offline (static host)</em>'; });
      }
      var savedCaps = null;
      function openPanel(fromMark) {
        panelOpen = true;
        if (!fromMark) { pausedByPanel = !paused; setPaused(true); }
        veil.style.display = 'none';
        var c = opt.context ? opt.context() : {};
        ctxEl.textContent = (c.where ? '· ' + c.where : '') + (pendingShot ? (pendingTap ? ' · 📍 spot marked' : ' · 📸 screenshot attached') : '');
        panel.style.display = 'block'; refreshList();
        // type freely: disable the plugin AND release Phaser's key CAPTURES —
        // captured codes (Space, arrows from createCursorKeys) are preventDefault'd
        // at the manager level even with the plugin off, which ate spaces/arrows
        // in the textarea.
        try {
          var kb = scene.input.keyboard;
          kb.enabled = false;
          savedCaps = kb.getCaptures ? kb.getCaptures().slice() : null;
          if (kb.clearCaptures) kb.clearCaptures();
        } catch (e) {}
        setTimeout(function () { ta.focus(); }, 0);
      }
      function closePanel() {
        if (marking) endMark();
        if (!panelOpen) { clearDot(); pendingShot = pendingTap = null; if (pausedByPanel) setPaused(false); return; }
        panelOpen = false; panel.style.display = 'none';
        clearDot(); pendingShot = pendingTap = null;
        try {
          var kb = scene.input.keyboard;
          kb.enabled = true;
          if (savedCaps && savedCaps.length && kb.addCapture) kb.addCapture(savedCaps);
          savedCaps = null;
        } catch (e) {}
        if (pausedByPanel) setPaused(false); else veil.style.display = paused ? 'flex' : 'none';
      }
      // 📝 → freeze + "tap the spot" → dot → composer (the dot + screenshot ride
      // with the note). Clicking 📝 again anywhere in the flow cancels/closes.
      bNotes.onclick = function () { (panelOpen || marking) ? closePanel() : startMark(); };
      panel.querySelector('[data-save]').onclick = function () {
        var text = (ta.value || '').trim();
        if (!text) { status.textContent = 'write something first'; return; }
        var c = opt.context ? opt.context() : {};
        status.textContent = pendingShot ? 'saving (+screenshot)…' : 'saving…';
        var payload = Object.assign({ text: text, ts: new Date().toISOString() }, c);
        if (pendingShot) { payload.shot = pendingShot; if (pendingTap) payload.tap = pendingTap; }
        fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) { if (!r.ok) throw 0; return r.json(); })
          .then(function (j) { status.textContent = j && j.issue ? 'saved ✓ → ' + j.issue : 'saved ✓'; ta.value = ''; pendingShot = pendingTap = null; clearDot(); refreshList(); })
          .catch(function () { status.textContent = 'save failed — notes API offline?'; });
      };

      var api = { setPaused: setPaused, isPaused: function () { return paused; }, openNotes: openPanel, closeNotes: closePanel,
        destroy: function () { [root_, panel, veil].forEach(function (e) { try { e.remove(); } catch (x) {} }); } };
      return api;
    }
  };

  // -------------------------------------------------------------------- Game
  // RFC-001 §1 — the DECLARATIVE GAME RUNTIME. Everything that used to be ~500
  // lines of per-game glue (world build + theming overlays + follower art + HUD +
  // toasts + shell/music/touch wiring + autopilot sense/snapshot + harness install
  // + win/death rules) lives HERE once, parameterized by a theme. A game is now:
  //
  //   Studio.Game.boot({ title, archetype: 'runner'|'vertical', levels: window.LEVELS,
  //                      theme: {...tokens...}, hooks: {...the truly game-specific 10%...} });
  //
  // The eval contract (window.__game/__sense/__cx, harness, 0-death autopilot) has
  // exactly ONE implementation now — it can never drift per game again.
  Studio.Game = {
    boot: function (cfg) {
      cfg = cfg || {};
      if (cfg.archetype === 'shooter') return Studio.Shooter.boot(cfg);   // a different game loop entirely
      if (cfg.archetype === 'rts') return Studio.RTS.boot(cfg);
      if (cfg.archetype === 'isorts') return Studio.IsoRTS.boot(cfg);     // isometric continuous-front RTS
      if (cfg.archetype === 'builder') return Studio.Builder.boot(cfg);   // isometric world-builder (Studio.UI showcase)
      var TH = cfg.theme || {};
      var HOOKS = cfg.hooks || {};
      var VERT = cfg.archetype === 'vertical';
      var GRAV = cfg.gravity != null ? cfg.gravity : 1300;
      var LEVELS = cfg.levels || root.LEVELS || [];
      var title = cfg.title || 'Studio Game';

      var scene, player, world, spawn, pc = null, heroArt = null, bgImg = null;
      var levelGoalX = 0, levelGoalY = 0, levelIndex = 0, wpIndex = 0;
      var input = { left: false, right: false, jump: false, down: false };
      var auto = false, deaths = 0, won = false, frame = 0, coins = 0, lastDeathX = 0, maxX = 0;
      var colliders = [], decor = [], landGuard = false, touchState = null, bedOn = false;
      // menu/flow state (parity with jazz/starsweeper shells). EVAL-SAFE: the
      // harness's reset() forces mode='play' and tears down any menu layer, so
      // the deterministic gate never sees a menu. Humans get title → play →
      // level-card → win; progress persists via Studio.Save (manual play only).
      var mode = cfg.skipMenu ? 'play' : 'menu';   // 'menu' | 'play' | 'card' | 'win'
      var menuLayer = null, levelStartFrame = 0, coinsAtLevelStart = 0;
      var save = Studio.Save.load(cfg.slug || title);

      function tex(key, fb) { return key && scene.textures.exists(key) ? key : fb; }
      var MATTEX = TH.matTex || null;            // per-material overlay map (null => bare gradients, template look)
      var TILE_SCALE = TH.tileScale != null ? TH.tileScale : 0.35;
      var PART = (TH.particle && TH.particle.key) || 'spark';

      // ---------------------------------------------------------------- sense
      function senseRunner(onGround) {
        var probeX = player.x + 26, footY = player.y + 22, T = (LEVELS[levelIndex] || {}).tile || 40;
        var groundAhead = Studio.Autopilot.groundAt(world.platforms, probeX, footY, T)
          || Studio.Autopilot.groundAt(world.moverGroup, probeX, footY, T);
        var blockedRight = player.body.blocked.right;
        var enemyAhead = false;
        world.enemies.getChildren().forEach(function (e) {
          if (e.active && e.x > player.x && e.x - player.x < 64 && Math.abs(e.y - player.y) < 52) enemyAhead = true;
        });
        return { onGround: onGround, groundAhead: groundAhead, blockedRight: blockedRight, enemyAhead: enemyAhead, x: player.x, goalX: levelGoalX, vy: player.body.velocity.y };
      }
      function senseVertical(onGround) {
        var L = LEVELS[levelIndex] || {}, chain = L.chain || [];
        while (wpIndex < chain.length - 1) {
          var t = chain[wpIndex];
          if (Math.abs(player.x - t.x) < 46 && player.y <= t.y + 14) wpIndex++; else break;
        }
        var target = chain[Math.min(wpIndex, Math.max(0, chain.length - 1))] || { x: player.x, y: player.y };
        var inUp = false, upX = null, gustOn = false;
        (world.contraptions || []).forEach(function (c) {
          if (c.type === 'updraft' && c.contains && c.contains(player)) { inUp = true; upX = c.x; }
          if (c.type === 'gust' && c.contains && c.contains(player) && c.state && c.state().active) gustOn = true;
        });
        return { x: player.x, y: player.y, onGround: onGround, vy: player.body.velocity.y, target: target, inUpdraft: inUp, updraftX: upX, gustActive: gustOn, goalX: levelGoalX, wp: wpIndex };
      }
      function decide(sn) { return VERT ? Studio.Autopilot.vertical(sn) : Studio.Autopilot.platformer(sn); }

      function footFrictionUnder() {
        var px = player.x, py = player.body.bottom + 4, best = 1;
        var groups = [world.platforms, world.moverGroup];
        for (var gi = 0; gi < groups.length; gi++) {
          var kids = groups[gi].getChildren();
          for (var i = 0; i < kids.length; i++) {
            var s = kids[i], bdy = s && s.body; if (!bdy) continue;
            if (px >= bdy.left - 2 && px <= bdy.right + 2 && py >= bdy.top - 8 && py <= bdy.top + 14) {
              return Studio.Materials.get(s.mat || 'solid').friction;
            }
          }
        }
        return best;
      }

      function snapshot() {
        return {
          x: Math.round(player.x), y: Math.round(player.y),
          vx: Math.round(player.body.velocity.x), vy: Math.round(player.body.velocity.y),
          onGround: !!(player.body.blocked.down || player.body.touching.down),
          deaths: deaths, dead: deaths > 0, won: won, frame: frame, coins: coins,
          goalX: levelGoalX, goalY: VERT ? levelGoalY : undefined,
          level: levelIndex, lastDeathX: lastDeathX, maxX: Math.round(maxX), wp: VERT ? wpIndex : undefined
        };
      }

      function toast(txt) {
        if (!txt || mode !== 'play') return;        // no toasts under menus (boot/card)
        var t = scene.add.text(480, 208, txt, {
          fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '30px', color: TH.hud && TH.hud.color || '#ffd9a0',
          stroke: TH.hud && TH.hud.stroke || '#1a1a22', strokeThickness: 6, align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(120).setAlpha(0);
        scene.tweens.add({ targets: t, alpha: 1, y: 196, duration: 420, ease: 'Sine.easeOut', yoyo: true, hold: 1100, onComplete: function () { try { t.destroy(); } catch (e) {} } });
        decor.push(t);
      }
      function fmt(s, i, name) { return String(s || '').replace('{i}', i + 1).replace('{n}', LEVELS.length).replace('{name}', name || ''); }

      // --------------------------------------------------------------- menus
      // Canvas-native, themed from TH, driven by tap OR keyboard. Every layer
      // lives in one container so teardown is a single destroy.
      var INK = function () { return TH.hud && TH.hud.color || '#ffd9a0'; };
      var STROKE = function () { return TH.hud && TH.hud.stroke || '#1a1a22'; };
      function clearMenu() { if (menuLayer) { try { menuLayer.destroy(true); } catch (e) {} menuLayer = null; } }
      function mtext(c, x, y, str, size, interactive) {
        var t = scene.add.text(x, y, str, {
          fontFamily: 'Georgia, "Times New Roman", serif', fontSize: size + 'px',
          color: INK(), stroke: STROKE(), strokeThickness: Math.max(3, Math.round(size / 7)), align: 'center'
        }).setOrigin(0.5);
        if (interactive) { t.setInteractive({ useHandCursor: true }); t.on('pointerover', function () { t.setScale(1.07); }); t.on('pointerout', function () { t.setScale(1); }); }
        c.add(t); return t;
      }
      function menuScrim(c, alpha) {
        var r = scene.add.rectangle(480, 270, 960, 540, TH.sky != null ? TH.sky : 0x101018, alpha != null ? alpha : 0.55);
        c.add(r); return r;
      }
      function newLayer() {
        clearMenu();
        // anchored at the camera's CURRENT scroll (world is paused while a menu is
        // up, so it's static) — NOT scrollFactor(0): interactive children inside a
        // scroll-factor-0 container hit-test at world coords, so pointer clicks
        // would miss whenever the camera is scrolled.
        var cam = scene.cameras.main;
        menuLayer = scene.add.container(cam.scrollX, cam.scrollY).setDepth(400);
        return menuLayer;
      }
      function pauseWorld(p) { try { p ? scene.physics.world.pause() : scene.physics.world.resume(); } catch (e) {} }

      // The MENU — deepfin-bar layout: full-bleed painted backdrop, the hero
      // LARGE on the left, the wordmark + tagline top-right, a ZONE RAIL of
      // per-level thumbnail cards (number chip, name, best stats, lock), and a
      // bottom action bar. All asset-driven (TH.menu = { logo, shots }) with
      // graceful text/tint fallbacks, so the template needs zero new assets.
      var menuSel = 0;
      function showTitle() { showMenu(); }
      function showLevels() { showMenu(); }
      function showMenu() {
        mode = 'menu'; pauseWorld(true);
        var c = newLayer();
        var unlocked = Math.max(1, save.unlocked || 1);
        menuSel = Math.min(unlocked - 1, LEVELS.length - 1);
        // full-bleed backdrop (opaque — the menu is its own stage, not a scrim)
        if (scene.textures.exists('bg_main')) c.add(scene.add.image(480, 270, 'bg_main').setDisplaySize(960, 540));
        else menuScrim(c, 1);
        c.add(scene.add.rectangle(480, 522, 960, 64, 0x000000, 0.38));            // bottom bar
        c.add(scene.add.rectangle(806, 250, 308, 470, 0x000000, 0.28));           // zone rail backing
        // HERO — big, breathing
        var heroKey = scene.textures.exists('hero_sheet') ? 'hero_sheet' : (scene.textures.exists('hero_art') ? 'hero_art' : null);
        if (heroKey) {
          var h = heroKey === 'hero_sheet' ? scene.add.sprite(0, 0, 'hero_sheet', (TH.hero && TH.hero.anims && TH.hero.anims.idle) || 0) : scene.add.image(0, 0, 'hero_art');
          h.setPosition(285, 330); h.setScale(250 / h.height);
          scene.tweens.add({ targets: h, y: 318, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          c.add(h);
        }
        // WORDMARK + tagline (image logo if the game generated one, else type)
        if (TH.menu && TH.menu.logo && scene.textures.exists('menu_logo')) {
          var lg = scene.add.image(0, 0, 'menu_logo');
          lg.setScale(Math.min(440 / lg.width, 150 / lg.height, 1));   // fit a 440x150 lockup box
          lg.setPosition(300, 30 + lg.displayHeight / 2);
          c.add(lg);
          if (cfg.tagline) mtext(c, 300, 30 + lg.displayHeight + 18, cfg.tagline.toUpperCase(), 11).setAlpha(0.92);
        } else {
          mtext(c, 310, 80, title.toUpperCase(), 46);
          if (cfg.tagline) mtext(c, 310, 124, cfg.tagline.toUpperCase(), 12).setAlpha(0.92);
        }
        // ZONE RAIL — one card per level
        var railX = 806, cardW = 280, cardH = 74, gapY = 88, y0 = 250 - ((LEVELS.length - 1) * gapY) / 2;
        var selBox = scene.add.rectangle(railX, y0, cardW + 10, cardH + 10).setStrokeStyle(3, TH.accent != null ? TH.accent : 0xffd34d, 1).setFillStyle(0, 0);
        c.add(selBox);
        function selectCard(i) { menuSel = i; selBox.setPosition(railX, y0 + i * gapY); }
        LEVELS.forEach(function (L, i) {
          var cy = y0 + i * gapY, open = i < unlocked;
          var shotKey = 'menu_lv' + i;
          var card;
          if (TH.menu && TH.menu.shots && scene.textures.exists(shotKey)) {
            card = scene.add.image(railX, cy, shotKey); card.setDisplaySize(cardW, cardH);
          } else {
            card = scene.add.rectangle(railX, cy, cardW, cardH, L.sky != null ? L.sky : 0x223044, 1);
          }
          if (!open) card.setAlpha(0.35); else { card.setInteractive({ useHandCursor: true }); card.on('pointerover', function () { selectCard(i); }); card.on('pointerdown', function () { startGame(i); }); }
          c.add(card);
          // number chip
          c.add(scene.add.rectangle(railX - cardW / 2 + 16, cy - cardH / 2 + 14, 24, 22, 0x000000, 0.55));
          mtext(c, railX - cardW / 2 + 16, cy - cardH / 2 + 14, open ? String(i + 1) : '🔒', 14);
          // name plate + best
          var b = save.best[i];
          mtext(c, railX, cy + cardH / 2 - 12, (L.name || ('LEVEL ' + (i + 1))).toUpperCase(), 13);
          if (b && (b.coins != null || b.timeMs != null)) mtext(c, railX + cardW / 2 - 8, cy - cardH / 2 + 13, (b.coins != null ? '¢' + b.coins : '') + (b.timeMs != null ? ' ' + (b.timeMs / 1000).toFixed(1) + 's' : ''), 10).setOrigin(1, 0.5).setAlpha(0.9);
        });
        selectCard(menuSel);
        // bottom action bar
        mtext(c, 480, 506, '▶  CLICK A ' + (TH.stageWord || 'stage').toUpperCase() + '   ·   OR PRESS SPACE TO PLAY', 15);
        mtext(c, 480, 528, cfg.controls || '← → move · SPACE jump', 11).setAlpha(0.75);
        // sound toggle, bottom-left
        var muted = Studio.Audio.isMuted && Studio.Audio.isMuted();
        var mu = mtext(c, 70, 506, muted ? '🔇 SOUND' : '🔊 SOUND', 12, true);
        mu.on('pointerdown', function () {
          var m = !(Studio.Audio.isMuted && Studio.Audio.isMuted());
          Studio.Audio.setMuted(m); mu.setText(m ? '🔇 SOUND' : '🔊 SOUND');
        });
        // keyboard: arrows pick a zone, SPACE/ENTER plays the selection
        var onKey = function (ev) {
          if (mode !== 'menu') return;
          if (ev.key === 'ArrowDown') selectCard(Math.min(unlocked - 1, menuSel + 1));
          else if (ev.key === 'ArrowUp') selectCard(Math.max(0, menuSel - 1));
          else if (ev.key === 'Enter' || ev.key === ' ') { scene.input.keyboard.off('keydown', onKey); startGame(menuSel); }
        };
        scene.input.keyboard.on('keydown', onKey);
      }
      function startGame(i) {
        clearMenu(); mode = 'play'; pauseWorld(false);
        deaths = 0; won = false; coins = 0; landGuard = false;
        if (pc) pc.reset();
        loadLevel(i); hud();
      }
      function showCard(clearedIndex, stats) {
        mode = 'card'; pauseWorld(true);
        var c = newLayer();
        menuScrim(c, 0.5);
        var L = LEVELS[clearedIndex] || {};
        mtext(c, 480, 170, fmt(TH.toasts && TH.toasts.level || 'STAGE {i} · {name}', clearedIndex, L.name) + '  —  CLEAR!', 26);
        var best = save.best[clearedIndex] || {};
        mtext(c, 480, 240, 'coins ' + stats.coins + (stats.coinsTotal ? ' / ' + stats.coinsTotal : '') + '    ·    ' + (stats.timeMs / 1000).toFixed(1) + 's' + (best.timeMs != null ? '   (best ' + (best.timeMs / 1000).toFixed(1) + 's)' : ''), 18);
        var next = mtext(c, 480, 330, '▶  ' + (TH.stageWord || 'stage').toUpperCase() + ' ' + (clearedIndex + 2), 24, true);
        var go = function () { if (mode !== 'card') return; startGame(clearedIndex + 1); };
        next.on('pointerdown', go);
        scene.input.keyboard.once('keydown-ENTER', go);
        scene.input.keyboard.once('keydown-SPACE', go);
        scene.time.delayedCall(2600, go);                 // auto-advance (manual play only)
      }
      function showWin(stats) {
        mode = 'win'; pauseWorld(true);
        var c = newLayer();
        menuScrim(c, 0.6);
        mtext(c, 480, 160, TH.toasts && TH.toasts.win || 'CLEARED!', 36);
        mtext(c, 480, 225, 'total coins ' + stats.coins + '    ·    ' + (stats.timeMs / 1000).toFixed(1) + 's', 18);
        var re = mtext(c, 480, 310, '↻  PLAY AGAIN', 22, true);
        re.on('pointerdown', function () { startGame(0); });
        var mn = mtext(c, 480, 360, 'MENU', 16, true);
        mn.on('pointerdown', function () { showTitle(); });
      }

      // ------------------------------------------------------------ loadLevel
      function loadLevel(i) {
        var spec = LEVELS[i];
        levelIndex = i; wpIndex = 0;
        colliders.forEach(function (c) { try { c.destroy(); } catch (e) {} }); colliders = [];
        decor.forEach(function (d) { try { d.destroy(); } catch (e) {} }); decor = [];
        if (world) {
          ['platforms', 'hazards', 'coins', 'enemies', 'springs'].forEach(function (k) {
            try { world[k].clear(true, true); } catch (e) {}
            try { world[k].destroy(true); } catch (e) {}
          });
          try { world.moverGroup.clear(true, true); world.moverGroup.destroy(true); } catch (e) {}
        }

        scene.cameras.main.setBackgroundColor(spec.sky || TH.sky || 0x101018);
        if (bgImg) bgImg.setTint(spec.bgTint || 0xffffff);
        world = Studio.Level.build(scene, spec);
        spawn = world.spawn; levelGoalX = world.goalX;
        var chain = spec.chain || [];
        var top = chain.length ? chain[chain.length - 1] : null;
        levelGoalY = world.goalY != null ? world.goalY : (top ? top.y : 0);
        if (VERT && top) levelGoalX = top.x;

        // themed overlays (only when the theme declares a material map)
        if (MATTEX) {
          world.platforms.getChildren().forEach(function (s) {
            s.setVisible(false);
            var key = tex(MATTEX[s.mat] || MATTEX._default, null);
            var hsh = ((s.x * 2654435761) >>> 0);
            if (key) {
              var ts = scene.add.tileSprite(s.x, s.y, s.displayWidth, s.displayHeight, key).setDepth(1);
              ts.setTileScale(TILE_SCALE); ts.setTilePosition(hsh % 512, (hsh >> 9) % 512);
              ts.setTint([0xffffff, 0xf6ece2, 0xefe0d2][hsh % 3]); decor.push(ts);
            } else s.setVisible(true);
            var lipDef = (TH.lip && TH.lip.perMat && TH.lip.perMat[s.mat]) || TH.lip;
            if (lipDef && key) {
              var lip = scene.add.rectangle(s.x, s.y - s.displayHeight / 2 + 2, s.displayWidth, 3, lipDef.color != null ? lipDef.color : 0xffffff, lipDef.alpha != null ? lipDef.alpha : 0.4).setDepth(2);
              try { lip.setBlendMode(Phaser.BlendModes.ADD); } catch (e) {}
              decor.push(lip);
            }
          });
          world.hazards.getChildren().forEach(function (s) {
            s.setVisible(false);
            var key = tex(TH.hazardTex, null);
            if (key) { var ts = scene.add.tileSprite(s.x, s.y, s.displayWidth, s.displayHeight, key).setDepth(1); ts.setTileScale(TILE_SCALE); decor.push(ts); }
            else s.setVisible(true);
          });
        }
        if (VERT) world.enemies.getChildren().forEach(function (e) { if (e.body) e.body.enable = false; });
        // enemy follower art
        if (TH.enemy && TH.enemy.img) {
          world.enemies.getChildren().forEach(function (e) {
            e.setVisible(false);
            var art = scene.add.image(e.x, e.y, 'enemy_art').setDepth(5); art.setScale((TH.enemy.h || 50) / art.height);
            e._art = art; decor.push(art);
          });
        }
        // themed coins (bob is art-only)
        var coinKey = tex(TH.coinArt && TH.coinArt.key, null);
        if (coinKey) {
          world.coins.getChildren().forEach(function (c) {
            c.setVisible(false);
            var art = scene.add.image(c.x, c.y, coinKey).setDepth(4); art.setScale((TH.coinArt.h || 26) / art.height);
            scene.tweens.add({ targets: art, y: c.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            c._art = art; decor.push(art);
          });
        }
        // goal gate
        var goalKey = tex(TH.goalArt && TH.goalArt.key, 'goal');
        var gy = VERT ? levelGoalY : (spec.groundY - 42);
        var goalImg = scene.add.image(levelGoalX, gy, goalKey).setDepth(4);
        if (goalKey !== 'goal') { goalImg.setScale((TH.goalArt.h || 96) / goalImg.height); goalImg.setY(gy + (VERT ? -goalImg.displayHeight / 2 + 6 : (spec.groundY - goalImg.displayHeight / 2) - gy)); }
        Studio.Juice.glow(goalImg, TH.accent || 0xffd27a, 3); decor.push(goalImg);

        Studio.Cam.follow(scene, player, { bounds: [0, 0, spec.width, spec.height], deadzone: VERT ? [220, 130] : [260, 200] });
        scene.cameras.main.centerOn(spawn.x, spawn.y);

        // ambient drift + theme hook
        var motes = Studio.Juice.ambient(scene, spec.width, { texture: PART, y: -8, scale: TH.particle && TH.particle.ambientScale || 0.7 });
        if (motes) decor.push(motes);
        if (HOOKS.onLevelLoaded) try { HOOKS.onLevelLoaded(scene, world, spec, { decor: decor, particle: PART }); } catch (e) {}

        // collisions + interactions (identical contracts to the proven Ember build)
        colliders.push(scene.physics.add.collider(player, world.platforms));
        colliders.push(scene.physics.add.overlap(player, world.coins, function (p, c) {
          c.disableBody(true, true); if (c._art) c._art.setVisible(false); coins++; Studio.Audio.sfx('coin');
          Studio.Juice.burst(scene, c.x, c.y, { texture: PART, n: 10, tint: TH.accent || 0xffcc33, life: 380, spMax: 160 });
          hud();
          if (HOOKS.onCoin) try { HOOKS.onCoin(scene, c); } catch (e) {}
        }));
        colliders.push(scene.physics.add.overlap(player, world.hazards, function () { die(); }));
        if (!VERT) colliders.push(scene.physics.add.overlap(player, world.enemies, function (p, e) {
          if (!e.active) return;
          if (p.body.velocity.y > 40 && p.y < e.y - 6) {
            e.disableBody(true, true); if (e._art) e._art.setVisible(false); pc.launch(p, 380); Studio.Audio.sfx('stomp');
            Studio.Juice.squash(scene, p); Studio.Juice.shake(scene, 90, 0.006);
            Studio.Juice.burst(scene, e.x, e.y, { texture: PART, n: 12, tint: TH.enemyBurst || 0xff5a3c, life: 420 });
            if (HOOKS.onStomp) try { HOOKS.onStomp(scene, p, e); } catch (e2) {}
          }
        }));
        var springKey = tex(TH.springArt && TH.springArt.key, 'spring');
        world.springs.getChildren().forEach(function (s) {
          s.setDepth(3);
          var art = scene.add.image(s.x, s.y, springKey).setDepth(8);
          if (springKey !== 'spring') { art.setScale((TH.springArt.h || 46) / art.height); art.setY(s.body ? s.body.bottom - art.displayHeight / 2 : s.y); }
          decor.push(art); s._art = art;
        });
        colliders.push(scene.physics.add.overlap(player, world.springs, function (p, s) {
          if (p.body.velocity.y < -120 || s.cool > 0) return;
          s.cool = 12; pc.launch(p, s.vel);
          Studio.Audio.sfx('jump'); Studio.Juice.squash(scene, p, 0.8, 1.2);
          Studio.Juice.burst(scene, p.x, p.body.bottom, { texture: PART, n: 8, tint: TH.accent || 0xffd166, life: 320 });
        }));
        if (world.moverGroup) colliders.push(scene.physics.add.collider(player, world.moverGroup));
        world.movers.forEach(function (m) {
          var mKey = tex(MATTEX && (MATTEX[m.spr.mat] || MATTEX._default), null);
          if (mKey) {
            var art = scene.add.tileSprite(m.spr.x, m.spr.y, m.spr.displayWidth, m.spr.displayHeight, mKey).setDepth(2);
            art.setTileScale(TILE_SCALE); decor.push(art); m._art = art; m.spr.setVisible(false);
          }
        });

        // contraptions: themed FX defaults + per-type hooks; updraft/gust get zone visuals
        world.contraptions.forEach(function (cx) {
          var s = cx.spr;
          decor.push(s); (cx._extra || []).forEach(function (e) { decor.push(e); });
          if (cx.type === 'crumble') {
            colliders.push(scene.physics.add.collider(player, s));
            s.setVisible(false);
            var ct = scene.add.tileSprite(s.x, s.y, s.displayWidth, s.displayHeight, tex(MATTEX && (MATTEX._fragile || MATTEX._default), 'cx_crumble')).setDepth(3);
            ct.setTileScale(0.3); ct.setTint(TH.fragileTint || 0xc8a888);
            cx._tile = ct; decor.push(ct);
            s._onArm = function () { ct.setTint(TH.fragileArmTint || 0x8a5a3c); Studio.Juice.shake(scene, 80, 0.005); };
            s._onFall = function (sp) {
              ct.setVisible(false); Studio.Audio.sfx('hurt'); Studio.Juice.shake(scene, 120, 0.008);
              Studio.Juice.burst(scene, sp.x, sp.y, { texture: PART, n: 16, tint: TH.fragileBurst || 0x8a5a2b, life: 520, spMax: 180 });
            };
          } else if (cx.type === 'launcher') {
            s._onFire = function (sp) {
              Studio.Audio.sfx('jump'); Studio.Juice.squash(scene, player, 0.8, 1.25);
              Studio.Juice.burst(scene, sp.x, sp.y - 8, { texture: PART, n: 14, tint: TH.accent || 0xffd166, life: 460, spMax: 220 });
            };
          } else if (cx.type === 'updraft') {
            // the visible wind: a faint column + a steady stream of rising motes
            var col = scene.add.rectangle(cx.x, (cx.y0 + cx.y1) / 2, cx.w, cx.y1 - cx.y0, TH.updraftTint || 0xbfe8ff, 0.07).setDepth(1);
            try { col.setBlendMode(Phaser.BlendModes.ADD); } catch (e) {}
            decor.push(col);
            try {
              var em = scene.add.particles(cx.x, cx.y1, PART, {
                x: { min: -cx.w / 2 + 8, max: cx.w / 2 - 8 },
                lifespan: Math.min(2400, (cx.y1 - cx.y0) * 6), speedY: { min: -200, max: -120 }, speedX: { min: -8, max: 8 },
                scale: { start: 0.7, end: 0 }, alpha: { start: 0.5, end: 0 }, quantity: 1, frequency: 70, blendMode: 'ADD'
              });
              em.setDepth(2); decor.push(em);
            } catch (e) {}
          } else if (cx.type === 'gust') {
            try {
              var gem = scene.add.particles(cx.x - cx.dir * cx.w / 2, cx.y, PART, {
                y: { min: -cx.h / 2 + 10, max: cx.h / 2 - 10 },
                lifespan: 600, speedX: { min: cx.dir * 260, max: cx.dir * 380 }, speedY: { min: -6, max: 6 },
                scale: { start: 0.5, end: 0 }, alpha: { start: 0.45, end: 0 }, quantity: 1, frequency: 50, blendMode: 'ADD'
              });
              gem.setDepth(2); decor.push(gem); cx._em = gem; gem.emitting = false;
            } catch (e) {}
          }
          if (HOOKS.contraptionFX && HOOKS.contraptionFX[cx.type]) try { HOOKS.contraptionFX[cx.type](cx, scene, { decor: decor, particle: PART }); } catch (e) {}
          if (cx.type !== 'updraft' && cx.type !== 'gust') Studio.Juice.glow(s, TH.accent || 0xffb24a, 2);
        });

        player.setVelocity(0, 0);
        player.setPosition(spawn.x, spawn.y);
        levelStartFrame = frame; coinsAtLevelStart = coins;
        if (bedOn) Studio.Audio.switchMusic(Studio.levelMusic(TH, LEVELS, i), TH.music && TH.music.vol != null ? TH.music.vol : 0.55); // per-stage score
        toast(fmt(TH.toasts && TH.toasts.level || 'STAGE {i} · {name}', i, spec.name));
      }

      function hud() { if (scene._hud) scene._hud.setText('coins ' + coins + '   ' + (TH.stageWord || 'stage') + ' ' + (levelIndex + 1) + '/' + LEVELS.length); }
      function reset() {
        clearMenu(); mode = 'play'; pauseWorld(false);   // the eval path never sees a menu
        deaths = 0; won = false; frame = 0; coins = 0; auto = false; landGuard = false;
        if (pc) pc.reset();
        loadLevel(0); hud();
      }
      function respawn() {
        player.setVelocity(0, 0); player.setPosition(spawn.x, spawn.y);
        wpIndex = 0;
        if (pc) pc.reset();
        if (world && world.resetContraptions) world.resetContraptions();
        (world && world.contraptions || []).forEach(function (cx) { if (cx._tile) { cx._tile.setVisible(true); cx._tile.setTint(TH.fragileTint || 0xc8a888); } });
      }
      function die() { deaths++; lastDeathX = Math.round(player.x); respawn(); }

      // ----------------------------------------------------------------- scene
      var Play = {
        key: 'Play',
        preload: function () {
          if (TH.bgImage) this.load.image('bg_main', TH.bgImage);
          if (TH.hero && TH.hero.fallback) this.load.image('hero_art', TH.hero.fallback);
          if (TH.hero && TH.hero.sheet) this.load.spritesheet('hero_sheet', TH.hero.sheet, { frameWidth: TH.hero.fw, frameHeight: TH.hero.fh });
          if (TH.enemy && TH.enemy.img) this.load.image('enemy_art', TH.enemy.img);
          var kit = TH.kitFiles || {};
          for (var k in kit) this.load.image(k, kit[k]);
          // menu assets (declared-only — no speculative loads, no 404 noise)
          if (TH.menu && TH.menu.logo) this.load.image('menu_logo', TH.menu.logo);
          if (TH.menu && TH.menu.shots) for (var li = 0; li < LEVELS.length; li++) this.load.image('menu_lv' + li, TH.menu.shots.replace('{i}', li));
        },
        create: function () {
          scene = this;
          Studio.Textures.kit(this, Object.assign({ tile: (LEVELS[0] || {}).tile || 40 }, TH.bakeKit || {}));
          var pdef = TH.particle || {};
          Studio.Textures.bake(this, PART, 10, 10, pdef.draw || function (g) {
            g.fillStyle(pdef.halo != null ? pdef.halo : 0xff7a18, 1).fillCircle(5, 5, 5);
            g.fillStyle(pdef.core != null ? pdef.core : 0xffd27a, 1).fillCircle(5, 5, 2.4);
          });
          if (TH.bgImage) bgImg = this.add.image(480, 270, 'bg_main').setScrollFactor(0).setDepth(-100).setDisplaySize(960, 540);

          player = this.physics.add.sprite(60, 360, 'hero');
          player.setVisible(false);
          pc = Studio.Platformer.create({ tune: TH.tune || null });
          player.setMaxVelocity(pc.tune.maxRun + (TH.vxHeadroom || 90), pc.tune.maxFall);

          var sheetOK = TH.hero && TH.hero.sheet && this.textures.exists('hero_sheet') && this.textures.get('hero_sheet').frameTotal > ((TH.hero.anims && TH.hero.anims.total) || 8);
          if (sheetOK) {
            var A = this.anims, an = TH.hero.anims;
            if (!A.exists('hero_run')) A.create({ key: 'hero_run', frames: A.generateFrameNumbers('hero_sheet', { start: an.run[0], end: an.run[1] }), frameRate: an.run[2] || 14, repeat: -1 });
            if (!A.exists('hero_idle')) A.create({ key: 'hero_idle', frames: [{ key: 'hero_sheet', frame: an.idle }], frameRate: 1, repeat: -1 });
            if (!A.exists('hero_jump')) A.create({ key: 'hero_jump', frames: [{ key: 'hero_sheet', frame: an.jump }], frameRate: 1, repeat: -1 });
            heroArt = this.add.sprite(player.x, player.y, 'hero_sheet', an.idle).setDepth(6);
            heroArt.play('hero_idle');
          } else if (TH.hero && TH.hero.fallback) {
            heroArt = this.add.image(player.x, player.y, 'hero_art').setDepth(6);
          } else {
            player.setVisible(true);                     // bare template look
          }
          if (heroArt) heroArt.setScale((TH.hero.scale || 64) / heroArt.height);

          if (TH.grade) Studio.Juice.grade(this, function (cm) {
            try { cm.brightness(TH.grade.brightness != null ? TH.grade.brightness : 1); cm.saturate(TH.grade.saturate || 0); cm.hue(TH.grade.hue || 0); } catch (e) {}
          });
          if (TH.vignette) Studio.Juice.vignette(this, TH.vignette);
          if (heroArt && TH.hero.glow) Studio.Juice.glow(heroArt, TH.hero.glow, 5);

          loadLevel(0);

          scene._hud = this.add.text(16, 12, '', {
            fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '18px', color: TH.hud && TH.hud.color || '#ffd9a0',
            stroke: TH.hud && TH.hud.stroke || '#1a1a22', strokeThickness: 5
          }).setScrollFactor(0).setDepth(100);
          hud();
          this.cursors = this.input.keyboard.createCursorKeys();
          touchState = Studio.Touch.create(this, { theme: TH.touch || null });

          var startBed = function () {
            if (bedOn || !TH.music) return; bedOn = true;
            var au = Studio.Audio.music(Studio.levelMusic(TH, LEVELS, levelIndex) || TH.music.url, TH.music.vol != null ? TH.music.vol : 0.55);
            if (au && au.addEventListener && TH.music.fallback) au.addEventListener('error', function () { Studio.Audio.music(TH.music.fallback, 0.3); });
            else if (!au && TH.music.fallback) Studio.Audio.music(TH.music.fallback, 0.3);
          };
          this.input.once('pointerdown', startBed);
          if (this.input.keyboard) this.input.keyboard.once('keydown', startBed);

          Studio.Shell.create(this, {
            theme: TH.shell || null,
            links: (function () {
              var L = [{ label: '📖 DIARY', href: '/diary.html' }];
              if (cfg.repo) { L.push({ label: '🐙 REPO', href: 'https://github.com/' + cfg.repo }); L.push({ label: '🐛 NOTES → ISSUES', href: 'https://github.com/' + cfg.repo + '/issues' }); }
              if (cfg.engineUrl) L.push({ label: '⚙️ ENGINE', href: cfg.engineUrl });
              return L;
            })(),
            context: function () {
              var L = LEVELS[levelIndex] || {};
              var base = {
                where: (TH.stagePrefix || 'S') + (levelIndex + 1) + ' ' + (L.name || '') + ' @' + Math.round(player.x) + (VERT ? ',' + Math.round(player.y) : ''),
                level: levelIndex + 1, levelName: L.name || '', x: Math.round(player.x), y: Math.round(player.y),
                coins: coins, deaths: deaths, won: won, game: cfg.slug || title.toLowerCase().replace(/\s+/g, '-')
              };
              if (HOOKS.context) try { Object.assign(base, HOOKS.context()); } catch (e) {}
              return base;
            },
            onRestart: function () { reset(); }
          });

          Studio.harness.install(root.game, {
            snapshot: snapshot,
            setInput: function (o) { input = Object.assign({ left: false, right: false, jump: false, down: false }, o || {}); },
            autopilot: function (on) { auto = !!on; input = { left: false, right: false, jump: false, down: false }; },
            reset: reset
          });
          root.__game.gotoLevel = function (i) { clearMenu(); mode = 'play'; pauseWorld(false); loadLevel(i); };
          root.__sense = function () {
            var og = player.body.blocked.down || player.body.touching.down;
            var s = VERT ? senseVertical(og) : senseRunner(og);
            s.decision = decide(s);
            return s;
          };
          root.__cx = function () {
            return (world.contraptions || []).map(function (c) {
              return { type: c.type, lens: c.lens, x: Math.round(c.spr ? c.spr.x : c.x), active: !!(c.spr ? c.spr.active : true), state: c.state ? c.state() : null };
            });
          };

          if (!cfg.skipMenu) showTitle();   // humans: title first (harness reset() bypasses)
        },
        update: function (time, delta) {
          if (!player) return;
          if (mode !== 'play') return;                     // a menu/card owns the screen
          frame++;
          var climb = VERT ? ((LEVELS[levelIndex] || {}).height || 0) - player.y : player.x;
          if (climb > maxX) maxX = climb;
          var b = player.body, onGround = b.blocked.down || b.touching.down;
          var dt = Math.min((delta || (1000 / 60)) / 1000, 1 / 30);

          if (onGround && !landGuard) { landGuard = true; Studio.Juice.shake(scene, 60, 0.004); }
          if (!onGround) landGuard = false;

          world.tick(dt);
          world.springs.getChildren().forEach(function (s) { if (s.cool > 0) s.cool--; });
          world.contraptionsInteract(player, { dt: dt, pc: pc });
          // gust emitters mirror their phase clock (visual only)
          (world.contraptions || []).forEach(function (cx) { if (cx.type === 'gust' && cx._em) cx._em.emitting = !!cx.state().active; });

          var mv;
          if (won) mv = { left: false, right: false, jump: false, down: false };
          else if (auto) { var sn = VERT ? senseVertical(onGround) : senseRunner(onGround); mv = decide(sn); }
          else mv = manual();

          var ff = footFrictionUnder();
          pc.update(player, mv, { onGround: onGround, footFriction: ff, dt: dt });

          world.movers.forEach(function (m) {
            var mb = m.spr.body;
            var onTop = player.body.bottom <= mb.top + 9 && player.body.bottom >= mb.top - 12
              && player.body.right > mb.left + 2 && player.body.left < mb.right - 2 && player.body.velocity.y >= -30;
            if (onTop) { player.x += m.vx; player.y += m.vy; }
            if (m._art) m._art.setPosition(m.spr.x, m.spr.y);
          });

          if (heroArt) {
            heroArt.setPosition(player.x, player.y - 3); heroArt.setFlipX(player.flipX);
            if (heroArt.play) {
              var want = !onGround ? 'hero_jump' : (Math.abs(b.velocity.x) > 20 ? 'hero_run' : 'hero_idle');
              var cur = heroArt.anims && heroArt.anims.currentAnim;
              if (!cur || cur.key !== want) heroArt.play(want, true);
            }
          }
          world.enemies.getChildren().forEach(function (e) {
            if (!e.active) return; e.x += e.dir * 0.6; if (Math.abs(e.x - e.homeX) > e.patrol) e.dir *= -1;
            if (e._art) { e._art.setPosition(e.x, e.y); e._art.setFlipX(e.dir > 0); }
          });

          // WIN: runner reaches goal x; climber reaches the gate at the top
          var reached = VERT
            ? (Math.abs(player.x - levelGoalX) < 56 && player.y < levelGoalY + 30)
            : (player.x >= levelGoalX - 8);
          if (!won && reached) {
            var lastLevel = levelIndex >= LEVELS.length - 1;
            var stats = {
              coins: coins - coinsAtLevelStart, coinsTotal: ((LEVELS[levelIndex] || {}).coins || []).length,
              timeMs: Math.round(((frame - levelStartFrame) / 60) * 1000)
            };
            if (!lastLevel) {
              Studio.Audio.sfx('win'); Studio.Juice.flash(scene, 140, 255, 150, 60);
              if (!auto) {            // human flow: persist progress + interstitial card
                save = Studio.Save.levelClear(cfg.slug || title, levelIndex, stats) || save;
                showCard(levelIndex, stats);
              } else {                // eval flow: instant advance (unchanged)
                loadLevel(levelIndex + 1); if (pc) pc.reset(); landGuard = false;
              }
            } else {
              won = true; Studio.Audio.sfx('win'); Studio.Juice.flash(scene, 220, 255, 170, 70);
              if (!auto) {
                save = Studio.Save.levelClear(cfg.slug || title, levelIndex, stats) || save;
                showWin({ coins: coins, timeMs: stats.timeMs });
              } else toast(TH.toasts && TH.toasts.win || 'CLEARED');
            }
          }
          if (player.y > ((LEVELS[levelIndex] || {}).height || scene.scale.height) + 120) die();
        }
      };
      function manual() {
        var c = scene.cursors, t = touchState || {};
        return { left: (c && c.left.isDown) || t.left, right: (c && c.right.isDown) || t.right, jump: (c && (c.up.isDown || c.space.isDown)) || t.jump, down: (c && c.down.isDown) || t.down };
      }

      var config = {
        type: Phaser.AUTO, backgroundColor: TH.cssBg || '#101018', seed: [cfg.seed || title],
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 960, height: 540 },
        render: { preserveDrawingBuffer: true, pixelArt: !!TH.pixelArt },
        physics: { default: 'arcade', arcade: { gravity: { y: GRAV }, debug: false } },
        scene: [Play]
      };
      var r = new URLSearchParams(location.search).get('r');
      if (r === 'canvas') config.type = Phaser.CANVAS; else if (r === 'webgl') config.type = Phaser.WEBGL;
      root.game = new Phaser.Game(config);
      return root.game;
    }
  };

  // ------------------------------------------------------------------ Shooter
  // A VERTICAL SPACE-SHOOTER archetype. A different game loop from the platformer
  // (no gravity, no platforms) but it REUSES the shared chrome — Shell, Save,
  // Audio, Touch, harness, Textures — so menu/pause/notes/music/eval all behave
  // the same. Levels are WAVES (data). The signature, deterministic, 0-death-by-
  // construction mechanic is the SWEEPING-GAP BULLET CURTAIN:
  //
  //   curtain bullets rain down in columns EXCEPT a safe gap whose centre weaves
  //   x = midX + amp*sin(2π·clock/period). The ship's max speed ≫ the gap's sweep
  //   speed, and (sweepSpeed · bulletFallTime) < gapW/2 − shipHalf, so the LIVE
  //   gap-centre is always a safe column the autopilot can sit in. Formation
  //   enemies (drones/darts/turrets) fly the upper field as score targets and do
  //   NOT fire or descend into the ship band, so the curtain is the only deadly
  //   thing. The boss fires a denser (still-survivable) curtain and dies to the
  //   ship's constant auto-fire in fixed time. → the gate run rides the gap,
  //   auto-fires, survives every wave, kills the boss, wins, 0 deaths.
  Studio.Shooter = {
    boot: function (cfg) {
      var TH = cfg.theme || {}, HOOKS = cfg.hooks || {};
      var LEVELS = cfg.levels || root.LEVELS || [];
      var title = cfg.title || 'Studio Shooter', slug = cfg.slug || 'shooter';
      var W = 960, H = 540;
      var SHIP_Y = 470, SHIP_SPEED = 360, SHIP_HALF = 16;
      var FONT = 'Georgia, "Times New Roman", serif';
      var save = Studio.Save.load(slug);

      var scene, ship, bullets, ebullets, enemies, boss = null, stars = [];
      var input = { left: false, right: false }, auto = false;
      var mode = cfg.skipMenu ? 'play' : 'menu', menuLayer = null;
      var levelIndex = 0, clock = 0, frame = 0, waveIdx = 0, waveT = 0;
      var hp = 3, deaths = 0, won = false, score = 0, levelStartFrame = 0, bossHpMax = 0;
      var fireCd = 0, bedOn = false, touch = null;
      // POWERUPS (deterministic): pickups drop on the level clock; catching one arms
      // a timed fire mode — 'spread' (3-way) · 'rapid' (faster) · 'swarm' (2 wingmen
      // that fire with you). Pure player-side buffs: survivability is unchanged, so
      // the gate's win-by-construction holds (the boss just dies faster).
      var pups = [], pupIdx = 0, power = null, powerT = 0, wingmen = [];
      var PUP_KINDS = ['spread', 'rapid', 'swarm'];

      var spec = function () { return LEVELS[levelIndex] || {}; };
      var curtain = function () { return spec().curtain || { amp: 180, period: 14, gapW: 200, bulletSpeed: 520, fireInterval: 9, columns: 11 }; };
      function gapCenter(t) { var c = curtain(); return W / 2 + c.amp * Math.sin((2 * Math.PI * t) / c.period); }

      // ----- deterministic snapshot (the eval contract) -----
      function snapshot() {
        return {
          x: Math.round(ship ? ship.x : 0), y: Math.round(ship ? ship.y : 0),
          vx: 0, vy: 0, hp: hp, deaths: deaths, dead: deaths > 0, won: won,
          frame: frame, coins: score, score: score, level: levelIndex, wave: waveIdx,
          bossHp: boss ? Math.max(0, Math.round(boss.hp)) : null, maxX: 0
        };
      }

      // ----- the bullet curtain (deterministic; fired in bursts on the clock) -----
      var lastBurst = -1;
      // revive a pooled arcade object CORRECTLY: enableBody re-enables a body that
      // disableBody() turned off — setActive/setVisible+reset does NOT, which left
      // pool-recycled enemies as unhittable ghosts ("bullets go through ships").
      function revive(go, x, y) { go.enableBody(true, x, y, true, true); return go; }
      function fireCurtain(dense) {
        var c = curtain(), gx = gapCenter(clock), half = c.gapW / 2;  // invariant gap width (survivability bound)
        var n = c.columns || 11, step = W / (n - 1);
        for (var i = 0; i < n; i++) {
          var bx = i * step;
          if (Math.abs(bx - gx) < half) continue;          // leave the safe gap
          var b = ebullets.get(bx, -16, 'ebullet');
          if (!b) continue;
          revive(b, bx, -16);
          b.setVelocity(0, c.bulletSpeed); b._spawn = clock;
        }
      }

      // ----- enemy formations (score targets; never fire, never enter ship band) -----
      function spawnFormation(f) {
        var cnt = f.count || 5, baseX = f.x != null ? f.x : 480, gap = f.gap || 70;
        for (var i = 0; i < cnt; i++) {
          var ex = baseX + (i - (cnt - 1) / 2) * gap;
          var e = enemies.get(ex, -40 - i * 30, f.tex || 'enemy_drone');
          if (!e) continue;
          revive(e, ex, -40 - i * 30);
          if (f.tex && e.setTexture) e.setTexture(scene.textures.exists(f.tex) ? f.tex : 'enemy_fallback');
          e.hp = f.hp || 2; e.homeX = ex; e.kind = f.tex || 'enemy_drone';
          e.t0 = clock; e.path = f.path || 'sweep'; e.amp = f.amp || 120; e.holdY = f.holdY || 150;
          e.setDisplaySize(f.size || 46, f.size || 46);   // f.size: big cruisers, small darts (variety)
        }
      }
      function moveEnemy(e) {
        var t = clock - e.t0;
        // enter to holdY, then move on the formation's path; y is clamped so a
        // formation never enters the ship band (the survivability contract).
        var y = Math.min(e.holdY, -40 + t * 90);
        var x = e.homeX;
        if (e.path === 'sweep') x = e.homeX + e.amp * Math.sin(t * 1.1);
        else if (e.path === 'orbit') { x = e.homeX + e.amp * Math.sin(t * 1.4); y = Math.min(e.holdY + Math.cos(t * 1.4) * 26, SHIP_Y - 150); }
        else if (e.path === 'dive') { var dv = Math.max(0, t - 2.2); y = Math.min(e.holdY + dv * 46, SHIP_Y - 150); x = e.homeX + e.amp * 0.5 * Math.sin(t * 2.2); }
        e.x = x; e.y = y;
        if (e.body) { e.body.x = x - e.body.halfWidth; e.body.y = y - e.body.halfHeight; }
      }

      // ----- level / wave flow -----
      function loadLevel(i) {
        levelIndex = i; clock = 0; waveIdx = 0; waveT = 0; lastBurst = -1; boss = null;
        bullets.clear(true, true); ebullets.clear(true, true); enemies.clear(true, true);
        pups.forEach(function (p) { try { p.destroy(); } catch (e) {} }); pups = []; pupIdx = 0; clearPower();
        var s = spec();
        if (bgImg) { bgImg.setTexture(scene.textures.exists('bg_' + i) ? 'bg_' + i : 'bg_0'); }
        if (s.boss) { /* boss spawns when the boss wave starts */ }
        levelStartFrame = frame;
        if (bedOn) Studio.Audio.switchMusic(Studio.levelMusic(TH, LEVELS, i), TH.music && TH.music.vol != null ? TH.music.vol : 0.55); // per-veil score
        ship.x = W / 2; ship.y = SHIP_Y; hp = 3;
        toast((TH.toasts && TH.toasts.level || 'VEIL {i} · {name}').replace('{i}', i + 1).replace('{name}', s.name || ''));
      }
      var bgImg = null;
      function startBoss() {
        var s = spec(); if (!s.boss || boss) return; var bs = (root.STARLANCE_BOSS) || (typeof s.boss==="object"?s.boss:{}) || {};
        boss = scene.physics.add.sprite(W / 2, 120, scene.textures.exists('boss_art') ? 'boss_art' : 'boss_fallback');
        boss.setDisplaySize(bs.w || 520, bs.h || 150); if (boss.body) { boss.body.setAllowGravity(false); boss.body.setSize((bs.w||520)*0.8, (bs.h||150)*0.7); }
        boss.hp = bs.hp || 520; bossHpMax = boss.hp;
        scene.tweens.add({ targets: boss, x: W / 2 - 80, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }

      // ----- powerups: deterministic drops → timed fire modes -----
      function clearPower() { power = null; powerT = 0; wingmen.forEach(function (w) { try { w.destroy(); } catch (e) {} }); wingmen = []; }
      function spawnPup() {
        var kind = PUP_KINDS[pupIdx % PUP_KINDS.length];
        var px = 140 + ((pupIdx * 257) % (W - 280));            // deterministic spread across the field
        pupIdx++;
        var p = scene.add.image(px, -20, scene.textures.exists('powerup_art') ? 'powerup_art' : 'spark').setDepth(8);
        p.setDisplaySize(34, 34); p._kind = kind; p._vy = 120;
        var tag = scene.add.text(px, -44, kind.toUpperCase(), { fontFamily: FONT, fontSize: '11px', color: '#aef6ff', stroke: '#03202c', strokeThickness: 3 }).setOrigin(0.5).setDepth(8);
        p._tag = tag; pups.push(p);
        Studio.Juice.glow(p, 0x8af0ff, 3);
      }
      function applyPower(kind) {
        clearPower(); power = kind; powerT = kind === 'swarm' ? 10 : 8;
        Studio.Audio.sfx('coin'); Studio.Juice.flash(scene, 120, 140, 240, 255);
        Studio.Juice.popText(scene, ship.x, ship.y - 40, kind.toUpperCase() + '!', { size: 18, color: '#aef6ff' });
        if (kind === 'swarm') for (var s = -1; s <= 1; s += 2) {
          var w = scene.add.image(ship.x + s * 46, ship.y + 10, scene.textures.exists('ship_art') ? 'ship_art' : 'ship_fallback').setDepth(9).setAlpha(0.85);
          w.setDisplaySize(30, 30); w._side = s; wingmen.push(w);
        }
      }
      function tickPups(dt) {
        // a pickup drifts down every `powerupEvery` s (theme/level tunable; default 18)
        var every = spec().powerupEvery != null ? spec().powerupEvery : (TH.powerupEvery != null ? TH.powerupEvery : 18);
        if (every > 0 && clock >= (pupIdx + 1) * every) spawnPup();
        for (var i = pups.length - 1; i >= 0; i--) {
          var p = pups[i]; p.y += p._vy * dt; if (p._tag) p._tag.setPosition(p.x, p.y - 26);
          if (Math.abs(p.x - ship.x) < 34 && Math.abs(p.y - ship.y) < 34) { applyPower(p._kind); p._tag && p._tag.destroy(); p.destroy(); pups.splice(i, 1); continue; }
          if (p.y > H + 24) { p._tag && p._tag.destroy(); p.destroy(); pups.splice(i, 1); }
        }
        if (power) { powerT -= dt; if (powerT <= 0) clearPower(); }
        for (var wgi = 0; wgi < wingmen.length; wgi++) { var wg = wingmen[wgi]; wg.x = ship.x + wg._side * 46; wg.y = ship.y + 10; }
      }
      function fireFrom(x, y, angDeg) {
        var b = bullets.get(x, y, 'pbullet'); if (!b) return;
        revive(b, x, y);
        var rad = (angDeg || 0) * Math.PI / 180;
        b.setVelocity(Math.sin(rad) * 680, -Math.cos(rad) * 680);
      }

      function die() {
        deaths++; hp = 0;
        Studio.Audio.sfx('hurt'); Studio.Juice.shake(scene, 200, 0.012); Studio.Juice.flash(scene, 200, 255, 80, 80);
        if (!auto) { showLose(); } else { ship.x = W / 2; ship.y = SHIP_Y; hp = 3; }  // eval: respawn (a death already failed the gate)
      }
      function hitShip() {
        if (hp <= 0) return; hp--;
        Studio.Juice.shake(scene, 90, 0.006);
        if (hp <= 0) die();
      }

      // ===================== scene =====================
      var Play = {
        key: 'Play',
        preload: function () {
          for (var i = 0; i < LEVELS.length; i++) if (TH.backdrops) this.load.image('bg_' + i, TH.backdrops.replace('{i}', i + 1));
          if (TH.ship) this.load.image('ship_art', TH.ship);
          (TH.enemyTex || []).forEach(function (e) { /* loaded below by key */ });
          var imgs = TH.images || {};
          for (var k in imgs) this.load.image(k, imgs[k]);
          if (TH.menu && TH.menu.logo) this.load.image('menu_logo', TH.menu.logo);
        },
        create: function () {
          scene = this;
          // baked fallbacks + projectiles (procedural — no art dependency)
          Studio.Textures.bake(this, 'ebullet', 10, 14, function (g) { g.fillStyle(0xff4d6d, 1).fillRoundedRect(2, 0, 6, 14, 3); g.fillStyle(0xffd0d8, 1).fillRect(3, 1, 4, 5); });
          Studio.Textures.bake(this, 'pbullet', 8, 16, function (g) { g.fillStyle(0x8af0ff, 1).fillRoundedRect(1, 0, 6, 16, 3); g.fillStyle(0xffffff, 1).fillRect(2, 1, 4, 6); });
          Studio.Textures.bake(this, 'star', 4, 4, function (g) { g.fillStyle(0xffffff, 1).fillCircle(2, 2, 1.6); });
          Studio.Textures.bake(this, 'spark', 10, 10, function (g) { g.fillStyle((TH.accent != null ? TH.accent : 0x8af0ff), 1).fillCircle(5, 5, 5); g.fillStyle(0xffffff, 1).fillCircle(5, 5, 2); });
          Studio.Textures.bake(this, 'ship_fallback', 34, 38, function (g) { g.fillStyle(0x6af0ff, 1).fillTriangle(17, 0, 34, 38, 0, 38); g.fillStyle(0xffffff, 1).fillTriangle(17, 8, 24, 30, 10, 30); });
          Studio.Textures.bake(this, 'enemy_fallback', 40, 40, function (g) { g.fillStyle(0xd66ad6, 1).fillCircle(20, 18, 16); g.fillStyle(0x221, 1).fillCircle(20, 18, 6); });
          Studio.Textures.bake(this, 'boss_fallback', 480, 140, function (g) { g.fillStyle(0x3a2150, 1).fillRoundedRect(0, 0, 480, 120, 18); g.fillStyle(0xff3b6b, 1).fillCircle(240, 70, 28); });

          // parallax starfield (decorative; seeded RNG, never read by snapshot)
          this.add.rectangle(W / 2, H / 2, W, H, TH.sky != null ? TH.sky : 0x05030f).setDepth(-100);
          bgImg = this.add.image(W / 2, H / 2, scene.textures.exists('bg_0') ? 'bg_0' : 'star').setDisplaySize(W, H).setDepth(-90);
          if (!scene.textures.exists('bg_0')) bgImg.setVisible(false);
          for (var s2 = 0; s2 < 70; s2++) { var st = this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'star').setDepth(-80); st.sp = Phaser.Math.Between(40, 160); st.setAlpha(Phaser.Math.FloatBetween(0.3, 1)); stars.push(st); }

          if (TH.grade) Studio.Juice.grade(this, function (cm) { try { cm.saturate(TH.grade.saturate || 0.1); cm.brightness(TH.grade.brightness || 1); } catch (e) {} });
          if (TH.vignette) Studio.Juice.vignette(this, TH.vignette);

          bullets = this.physics.add.group({ allowGravity: false, defaultKey: 'pbullet', maxSize: 64 });
          ebullets = this.physics.add.group({ allowGravity: false, defaultKey: 'ebullet', maxSize: 220 });
          enemies = this.physics.add.group({ allowGravity: false, maxSize: 40 });

          ship = this.physics.add.sprite(W / 2, SHIP_Y, scene.textures.exists('ship_art') ? 'ship_art' : 'ship_fallback');
          ship.setDisplaySize(TH.shipW || 44, TH.shipH || 48); ship.body.setAllowGravity(false);
          ship.body.setSize(SHIP_HALF * 2, SHIP_HALF * 2); ship.setDepth(10);
          if (TH.ship && TH.shipGlow) Studio.Juice.glow(ship, TH.shipGlow, 4);

          // collisions: player bullets damage enemies/boss; enemy bullets + bodies hurt the ship
          this.physics.add.overlap(bullets, enemies, function (b, e) {
            b.disableBody(true, true); e.hp -= 1;
            if (e.hp <= 0) { score += 100; Studio.Audio.sfx('coin'); Studio.Juice.burst(scene, e.x, e.y, { texture: 'spark', n: 10, tint: TH.accent || 0x8af0ff, life: 360 }); e.disableBody(true, true); }
          });
          this.physics.add.overlap(ebullets, ship, function (b) { b.disableBody(true, true); hitShip(); });
          this.physics.add.overlap(enemies, ship, function () { hitShip(); });

          scene._hud = this.add.text(16, 12, '', { fontFamily: FONT, fontSize: '18px', color: TH.hud && TH.hud.color || '#cdefff', stroke: TH.hud && TH.hud.stroke || '#0a0420', strokeThickness: 5 }).setScrollFactor(0).setDepth(100);
          hud();
          this.cursors = this.input.keyboard.createCursorKeys();
          touch = Studio.Touch.create(this, { theme: TH.touch || null, button: false });  // auto-fire: no JUMP/FIRE button
          Studio.Juice.glow(ship, TH.accent != null ? TH.accent : 0x8af0ff, 4);           // ship visibility

          var startBed = function () { if (bedOn || !TH.music) return; bedOn = true; var a = Studio.Audio.music(Studio.levelMusic(TH, LEVELS, levelIndex) || TH.music.url, TH.music.vol != null ? TH.music.vol : 0.55); if (!a && TH.music.fallback) Studio.Audio.music(TH.music.fallback, 0.3); };
          this.input.once('pointerdown', startBed); if (this.input.keyboard) this.input.keyboard.once('keydown', startBed);

          Studio.Shell.create(this, {
            theme: TH.shell || null,
            links: (function () { var L = [{ label: '📖 DIARY', href: '/diary.html' }]; if (cfg.repo) { L.push({ label: '🐙 REPO', href: 'https://github.com/' + cfg.repo }); L.push({ label: '🐛 NOTES → ISSUES', href: 'https://github.com/' + cfg.repo + '/issues' }); } if (cfg.engineUrl) L.push({ label: '⚙️ ENGINE', href: cfg.engineUrl }); return L; })(),
            context: function () { var s = spec(); return { where: 'V' + (levelIndex + 1) + ' ' + (s.name || '') + ' wave ' + (waveIdx + 1), level: levelIndex + 1, levelName: s.name || '', wave: waveIdx + 1, score: score, hp: hp, deaths: deaths, won: won, game: slug }; },
            onRestart: function () { startGame(0); }
          });

          Studio.harness.install(root.game, {
            snapshot: snapshot,
            setInput: function (o) { input = Object.assign({ left: false, right: false }, o || {}); },
            autopilot: function (on) { auto = !!on; input = { left: false, right: false }; },
            reset: function () { clearMenu(); mode = 'play'; try { scene.physics.world.resume(); } catch (e) {} deaths = 0; won = false; score = 0; frame = 0; loadLevel(0); hud(); }
          });
          root.__sense = function () { return { x: ship.x, gap: gapCenter(clock), hp: hp, wave: waveIdx }; };

          loadLevel(0);
          if (!cfg.skipMenu) showMenu();
        },
        update: function (time, delta) {
          if (!ship) return;
          if (mode !== 'play') return;
          frame++;
          var dt = Math.min((delta || (1000 / 60)) / 1000, 1 / 30);
          clock += dt;
          // starfield drift
          for (var i = 0; i < stars.length; i++) { var st = stars[i]; st.y += st.sp * dt; if (st.y > H) { st.y = 0; } }

          // ----- wave schedule -----
          var s = spec(), waves = s.waves || [];
          var wv = waves[waveIdx] || { dur: 6, formations: [] };
          if (waveT === 0 && wv.formations) wv.formations.forEach(spawnFormation);
          if (waveT === 0 && wv.boss) startBoss();
          waveT += dt;

          // ----- curtain bursts (deterministic on the clock) -----
          var c = curtain(); var interval = boss ? Math.max(20, (c.fireInterval||42) * 0.6) : (c.fireInterval||42); var burst = Math.floor(clock * 60 / interval);
          if (burst !== lastBurst) { lastBurst = burst; fireCurtain(!!boss); }

          // ----- enemies move; cull off-screen -----
          enemies.getChildren().forEach(function (e) { if (e.active) { moveEnemy(e); if (e.y > H + 40) e.disableBody(true, true); } });
          // ----- cull bullets -----
          ebullets.getChildren().forEach(function (b) { if (b.active && b.y > H + 20) b.disableBody(true, true); });
          bullets.getChildren().forEach(function (b) { if (b.active && b.y < -20) b.disableBody(true, true); });

          // ----- input (auto = ride the gap + fire) -----
          var mv;
          if (won) mv = { left: false, right: false, fire: false };
          else if (auto) { var s2 = root.__sense(); var dx = s2.gap - ship.x; mv = { left: dx < -6, right: dx > 6, fire: true }; }
          else { var cu = scene.cursors; mv = { left: (cu && cu.left.isDown) || touch.left, right: (cu && cu.right.isDown) || touch.right, fire: true }; }
          var vx = (mv.right ? 1 : 0) - (mv.left ? 1 : 0);
          ship.x = Math.max(30, Math.min(W - 30, ship.x + vx * SHIP_SPEED * dt));
          if (ship.body) { ship.body.x = ship.x - ship.body.halfWidth; ship.body.y = ship.y - ship.body.halfHeight; }
          // visibility: bank into the turn + a thruster flame off the tail
          ship.setRotation(vx * 0.16);
          if (frame % 3 === 0) Studio.Juice.burst(scene, ship.x - vx * 6, ship.y + 20, { texture: 'spark', n: 2, tint: 0x66d9ff, life: 220, spMin: 20, spMax: 60, scale: 0.55 });

          tickPups(dt);

          // ----- auto-fire upward (the active powerup shapes the salvo) -----
          fireCd -= dt;
          if (mv.fire && fireCd <= 0 && !won) {
            fireCd = (TH.fireRate || 0.13) * (power === 'rapid' ? 0.55 : 1);
            if (power === 'spread') { fireFrom(ship.x, ship.y - 22, 0); fireFrom(ship.x - 6, ship.y - 16, -14); fireFrom(ship.x + 6, ship.y - 16, 14); }
            else fireFrom(ship.x, ship.y - 22, 0);
            for (var wj = 0; wj < wingmen.length; wj++) fireFrom(wingmen[wj].x, wingmen[wj].y - 18, 0);
            if (frame % 4 === 0) Studio.Audio.sfx('jump');
          }
          // player bullets vs boss
          if (boss && boss.active) {
            bullets.getChildren().forEach(function (b) { if (b.active && Math.abs(b.x - boss.x) < boss.displayWidth / 2 && b.y < boss.y + boss.displayHeight / 2) { b.disableBody(true, true); boss.hp -= 1; } });
            if (boss.hp <= 0) { Studio.Juice.flash(scene, 300, 255, 220, 120); Studio.Juice.burst(scene, boss.x, boss.y, { texture: 'spark', n: 40, tint: 0xffd166, life: 800, spMax: 260 }); boss.destroy(); boss = null; }
          }

          // ----- wave / level advance + WIN -----
          var bossWaveDone = wv.boss ? !boss : true;
          if (waveT >= (wv.dur || 6) && bossWaveDone) {
            if (waveIdx < waves.length - 1) { waveIdx++; waveT = 0; }
            else if (!won) {
              if (levelIndex < LEVELS.length - 1) {
                Studio.Audio.sfx('win'); Studio.Juice.flash(scene, 160, 150, 255, 200);
                var stats = { score: score, timeMs: Math.round(((frame - levelStartFrame) / 60) * 1000) };
                if (!auto) { save = Studio.Save.levelClear(slug, levelIndex, { coins: score, timeMs: stats.timeMs }) || save; showCard(levelIndex, stats); }
                else { loadLevel(levelIndex + 1); }
              } else {
                won = true; Studio.Audio.sfx('win'); Studio.Juice.flash(scene, 300, 200, 255, 220);
                if (!auto) { save = Studio.Save.levelClear(slug, levelIndex, { coins: score, timeMs: Math.round(((frame - levelStartFrame) / 60) * 1000) }) || save; showWin({ score: score }); }
              }
            }
          }
          hud();
          if (ship) { ship.setVisible(true); }
        }
      };
      function hud() { if (scene && scene._hud) scene._hud.setText('score ' + score + '   ✦' + Math.max(0, hp) + '   ' + (TH.stageWord || 'veil') + ' ' + (levelIndex + 1) + '/' + LEVELS.length + (boss ? '   BOSS ' + Math.round(100 * boss.hp / Math.max(1, bossHpMax)) + '%' : '')); }
      function toast(txt) {
        if (!txt || mode !== 'play' || !scene) return;
        var t = scene.add.text(W / 2, 200, txt, { fontFamily: FONT, fontSize: '30px', color: TH.hud && TH.hud.color || '#cdefff', stroke: TH.hud && TH.hud.stroke || '#0a0420', strokeThickness: 6 }).setOrigin(0.5).setDepth(120).setAlpha(0);
        scene.tweens.add({ targets: t, alpha: 1, y: 188, duration: 420, yoyo: true, hold: 1100, onComplete: function () { try { t.destroy(); } catch (e) {} } });
      }

      // ===================== menu (compact deepfin-style; shooter-local) =====================
      function clearMenu() { if (menuLayer) { try { menuLayer.destroy(true); } catch (e) {} menuLayer = null; } }
      function mtext(c, x, y, str, size, it) {
        var t = scene.add.text(x, y, str, { fontFamily: FONT, fontSize: size + 'px', color: TH.hud && TH.hud.color || '#cdefff', stroke: TH.hud && TH.hud.stroke || '#0a0420', strokeThickness: Math.max(3, size / 7), align: 'center' }).setOrigin(0.5);
        if (it) { t.setInteractive({ useHandCursor: true }); t.on('pointerover', function () { t.setScale(1.07); }); t.on('pointerout', function () { t.setScale(1); }); }
        c.add(t); return t;
      }
      function showMenu() {
        mode = 'menu'; try { scene.physics.world.pause(); } catch (e) {}
        clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(400);
        if (scene.textures.exists('bg_0')) menuLayer.add(scene.add.image(W / 2, H / 2, 'bg_0').setDisplaySize(W, H));
        else menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, TH.sky != null ? TH.sky : 0x05030f));
        menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x05030f, 0.45));
        var shipKey = scene.textures.exists('ship_art') ? 'ship_art' : 'ship_fallback';
        var hs = scene.add.image(290, 300, shipKey).setScale(150 / scene.textures.get(shipKey).getSourceImage().height);
        scene.tweens.add({ targets: hs, y: 288, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); menuLayer.add(hs);
        if (scene.textures.exists('menu_logo')) { var lg = scene.add.image(0, 0, 'menu_logo'); lg.setScale(Math.min(440 / lg.width, 130 / lg.height, 1)); lg.setPosition(300, 30 + lg.displayHeight / 2); menuLayer.add(lg); if (cfg.tagline) mtext(menuLayer, 300, 30 + lg.displayHeight + 16, cfg.tagline.toUpperCase(), 11); }
        else { mtext(menuLayer, 300, 70, title.toUpperCase(), 44); if (cfg.tagline) mtext(menuLayer, 300, 112, cfg.tagline.toUpperCase(), 11); }
        var unlocked = Math.max(1, save.unlocked || 1), y0 = 250 - ((LEVELS.length - 1) * 64) / 2;
        LEVELS.forEach(function (L, i) {
          var open = i < unlocked, cy = y0 + i * 64;
          var card = scene.add.rectangle(800, cy, 280, 54, L.sky != null ? L.sky : 0x161430, 1).setStrokeStyle(2, open ? (TH.accent != null ? TH.accent : 0x8af0ff) : 0x333, 1);
          if (open) { card.setInteractive({ useHandCursor: true }); card.on('pointerdown', function () { startGame(i); }); } else card.setAlpha(0.4);
          menuLayer.add(card);
          mtext(menuLayer, 800, cy, (open ? (i + 1) + '. ' : '🔒 ') + (L.name || 'VEIL ' + (i + 1)).toUpperCase(), 13);
        });
        mtext(menuLayer, 480, 500, '▶  CLICK A VEIL · OR PRESS SPACE TO LAUNCH', 14);
        mtext(menuLayer, 480, 522, cfg.controls || '← → move · auto-fire', 11).setAlpha(0.8);
        var go = function () { if (mode === 'menu') startGame(Math.min(unlocked - 1, LEVELS.length - 1)); };
        scene.input.keyboard.once('keydown-SPACE', go); scene.input.keyboard.once('keydown-ENTER', go);
      }
      function startGame(i) { clearMenu(); mode = 'play'; try { scene.physics.world.resume(); } catch (e) {} won = false; deaths = 0; score = 0; loadLevel(i); hud(); }
      function showCard(i, stats) {
        mode = 'card'; try { scene.physics.world.pause(); } catch (e) {} clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(400);
        menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x05030f, 0.7));
        mtext(menuLayer, 480, 200, (spec().name || 'VEIL') + ' — CLEARED', 26);
        mtext(menuLayer, 480, 250, 'score ' + stats.score + '  ·  ' + (stats.timeMs / 1000).toFixed(1) + 's', 16);
        var go = function () { if (mode === 'card') startGame(i + 1); };
        mtext(menuLayer, 480, 320, '▶  NEXT VEIL', 22, true).on('pointerdown', go);
        scene.input.keyboard.once('keydown-SPACE', go); scene.input.keyboard.once('keydown-ENTER', go);
        scene.time.delayedCall(2600, go);
      }
      function showWin(st) {
        mode = 'win'; try { scene.physics.world.pause(); } catch (e) {} clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(400);
        menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x05030f, 0.78));
        mtext(menuLayer, 480, 170, TH.toasts && TH.toasts.win || 'THE HOLLOW STAR', 34);
        mtext(menuLayer, 480, 230, 'final score ' + st.score, 18);
        mtext(menuLayer, 480, 310, '↻  PLAY AGAIN', 22, true).on('pointerdown', function () { startGame(0); });
        mtext(menuLayer, 480, 360, 'MENU', 15, true).on('pointerdown', function () { showMenu(); });
      }
      function showLose() {
        mode = 'win'; try { scene.physics.world.pause(); } catch (e) {} clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(400);
        menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x1a0008, 0.8));
        mtext(menuLayer, 480, 200, 'SHIP LOST', 32);
        mtext(menuLayer, 480, 280, '↻  RETRY VEIL', 22, true).on('pointerdown', function () { startGame(levelIndex); });
        mtext(menuLayer, 480, 330, 'MENU', 15, true).on('pointerdown', function () { showMenu(); });
      }

      var config = {
        type: Phaser.AUTO, backgroundColor: TH.cssBg || '#05030f', seed: [cfg.seed || title],
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
        render: { preserveDrawingBuffer: true, pixelArt: false },
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: [Play]
      };
      var r = new URLSearchParams(location.search).get('r');
      if (r === 'canvas') config.type = Phaser.CANVAS; else if (r === 'webgl') config.type = Phaser.WEBGL;
      root.game = new Phaser.Game(config);
      return root.game;
    }
  };

  // ---------------------------------------------------------------------- RTS
  // A TOON CAR LANE-PUSH RTS archetype. Real-time strategy made DETERMINISTIC +
  // AI-completable-by-construction via the LANE model: a garage (bottom) and an
  // enemy fortress (top) joined by 3 lanes. You spend SCRAP (auto-income) to
  // BUILD cars into a lane; cars drive toward the enemy HQ and brawl whatever is
  // ahead (the fronts of each side fight; gunners out-range). HQ turrets defend.
  // The enemy spawns on a FIXED schedule (the level's difficulty). Win = fortress
  // HP→0; lose = garage HP→0. Everything advances on a fixed-dt clock, iterated
  // in stable unit-id order with no gameplay RNG, so a run is reproducible.
  //
  // The autopilot is an ALL-IN-ON-ONE-LANE macro: build the chosen unit whenever
  // affordable, into the rally lane. Levels are tuned (rules.json bound) so the
  // player's per-lane throughput overwhelms the enemy's per-lane defence and
  // leaks cars onto the fortress before the garage falls → 0-death by design.
  Studio.RTS = {
    boot: function (cfg) {
      var TH = cfg.theme || {}, LEVELS = cfg.levels || root.LEVELS || [];
      var title = cfg.title || 'Studio RTS', slug = cfg.slug || 'rts';
      var W = 960, H = 540, FONT = 'Georgia, "Times New Roman", serif';
      var LANES = [260, 480, 700], GAR_Y = 492, FORT_Y = 64;
      var UNIT = {  // base stats (a level/theme may scale via spec.tune)
        scout:   { cost: 20, hp: 42,  dmg: 6,  range: 38,  speed: 96, cd: 0.5, r: 17, dps: 12 },
        brawler: { cost: 46, hp: 130, dmg: 13, range: 42,  speed: 60, cd: 0.7, r: 20, dps: 18 },
        gunner:  { cost: 36, hp: 54,  dmg: 9,  range: 140, speed: 74, cd: 0.55, r: 17, dps: 16 },
        // warlord = the ENEMY BOSS (schedule-only; never player-buildable) — the
        // climactic war-rig: huge HP, heavy hit, slow. The rally deathball grinds
        // it down before it reaches the garage (verified 0-death in the sim/gate).
        warlord: { cost: 999, hp: 620, dmg: 22, range: 46, speed: 42, cd: 0.9, r: 32, dps: 24 }
      };
      // REFINERY — the economy building (coin generation). Spend scrap to raise
      // income: the army-vs-economy choice that balances how big a convoy you can
      // field. Deterministic (a flat +bonus/s per refinery, capped).
      var REFINERY = (cfg.economy && cfg.economy.refinery) || { cost: 55, bonus: 7, max: 4 };
      var save = Studio.Save.load(slug);

      var scene, units = [], uid = 0, scrap = 0, income = 12, depots = 0, garageHp = 1000, fortressHp = 1000, garageMax = 1000, fortressMax = 1000;
      var levelIndex = 0, clock = 0, frame = 0, won = false, deaths = 0, selLane = 1, buildType = 'brawler';
      var auto = false, schedIdx = 0, effSched = [], bedOn = false, mode = cfg.skipMenu ? 'play' : 'menu', menuLayer = null, levelStartFrame = 0;
      var gTurretCd = 0, fTurretCd = 0, bullets = [];
      var spec = function () { return LEVELS[levelIndex] || {}; };

      function curIncome() { return income + depots * REFINERY.bonus; }
      function snapshot() {
        return {
          x: 0, y: 0, vx: 0, vy: 0, scrap: Math.round(scrap), coins: Math.round(scrap),
          garageHp: Math.round(garageHp), fortressHp: Math.round(fortressHp), depots: depots, income: +curIncome().toFixed(1),
          units: units.filter(function (u) { return u.alive; }).length,
          deaths: deaths, dead: deaths > 0, won: won, frame: frame, level: levelIndex, maxX: 0
        };
      }

      function loadLevel(i) {
        levelIndex = i; clock = 0; schedIdx = 0; won = false;
        var s = spec(); effSched = Studio.rtsPressure(s, 'lane');   // systematic difficulty→flank pressure
        units = []; uid = 0; bullets.forEach(function (b) { try { b.spr.destroy(); } catch (e) {} }); bullets = [];
        depots = 0; if (depotLayer) depotLayer.removeAll(true);
        income = s.income || 12; scrap = s.startScrap != null ? s.startScrap : 40;
        garageHp = garageMax = s.garageHp || 1000; fortressHp = fortressMax = s.fortressHp || 1000;
        if (bgImg) bgImg.setTexture(scene.textures.exists('bg_' + i) ? 'bg_' + i : 'bg_0');
        levelStartFrame = frame;
        if (bedOn) Studio.Audio.switchMusic(Studio.levelMusic(TH, LEVELS, i), TH.music && TH.music.vol != null ? TH.music.vol : 0.55); // per-ground score
        // clear unit sprites
        if (uLayer) uLayer.removeAll(true);
        toast((TH.toasts && TH.toasts.level || 'GROUND {i} · {name}').replace('{i}', i + 1).replace('{name}', s.name || ''));
        hud();
      }
      var bgImg = null, uLayer = null, depotLayer = null;

      function tuned(type) {
        var u = UNIT[type], t = (spec().tune || {})[type] || {};
        return { cost: t.cost || u.cost, hp: t.hp || u.hp, dmg: t.dmg || u.dmg, range: u.range, speed: u.speed, cd: u.cd, r: u.r };
      }
      function spawnUnit(side, type, lane) {
        var st = tuned(type), id = uid++;
        var tex = (side === 'p' ? 'car_' : 'enemy_') + type;
        var spr = scene.add.image(LANES[lane], side === 'p' ? GAR_Y - 20 : FORT_Y + 20, scene.textures.exists(tex) ? tex : (side === 'p' ? 'car_fallback' : 'enemy_fallback'));
        spr.setDisplaySize(st.r * 2.4, st.r * 2.6); if (side === 'e') spr.setFlipY(true); spr.setDepth(5);
        if (uLayer) uLayer.add(spr);
        units.push({ id: id, side: side, type: type, lane: lane, x: LANES[lane], y: spr.y, hp: st.hp, maxHp: st.hp, dmg: st.dmg, range: st.range, speed: st.speed, cd: 0, atkCd: st.cd, r: st.r, spr: spr, alive: true });
      }
      function build(side, type, lane) {
        if (type === 'depot') return buildRefinery();
        if (side === 'p') { var c = tuned(type).cost; if (scrap < c) return false; scrap -= c; }
        spawnUnit(side, type, lane); Studio.Audio.sfx('jump'); return true;
      }
      // build a REFINERY (income building) — not a combat unit; a row near the garage
      function buildRefinery() {
        if (depots >= REFINERY.max || scrap < REFINERY.cost) return false;
        scrap -= REFINERY.cost; depots++;
        if (scene && depotLayer) {
          var dx = 150 - (depots - 1) * 0; var px = 120 + (depots - 1) * 46, py = GAR_Y + 6;
          var spr = scene.add.image(px, py, scene.textures.exists('depot_art') ? 'depot_art' : 'spark').setDepth(3);
          spr.setDisplaySize(40, 40); depotLayer.add(spr);
          Studio.Juice.burst(scene, px, py, { texture: 'spark', n: 8, tint: 0xffcc44, life: 360 });
        }
        Studio.Audio.sfx('coin'); hud(); return true;
      }

      // deterministic combat + movement (iterate in id order; stable tie-breaks)
      function frontOf(side, lane) {
        var best = null;
        for (var i = 0; i < units.length; i++) { var u = units[i]; if (!u.alive || u.side !== side || u.lane !== lane) continue; if (!best || (side === 'p' ? u.y < best.y : u.y > best.y)) best = u; }
        return best;
      }
      function nearestEnemyAhead(u) {
        var foe = u.side === 'p' ? 'e' : 'p', best = null, bd = 1e9;
        for (var i = 0; i < units.length; i++) { var o = units[i]; if (!o.alive || o.side !== foe || o.lane !== u.lane) continue; var ahead = u.side === 'p' ? (o.y < u.y) : (o.y > u.y); if (!ahead) continue; var d = Math.abs(o.y - u.y); if (d < bd) { bd = d; best = o; } }
        return best ? { o: best, d: bd } : null;
      }
      function tickWorld(dt) {
        scrap += curIncome() * dt;
        // units
        for (var i = 0; i < units.length; i++) {
          var u = units[i]; if (!u.alive) continue;
          u.cd -= dt;
          var ne = nearestEnemyAhead(u);
          var dir = u.side === 'p' ? -1 : 1;
          var hqY = u.side === 'p' ? FORT_Y : GAR_Y, hqDist = Math.abs(u.y - hqY);
          if (ne && ne.d <= Math.max(u.range, u.r + 10)) {
            // in combat: hold at engage range (melee close, ranged keep distance)
            var want = u.range > 80 ? u.range - 6 : (u.r + ne.o.r + 4);
            if (ne.d > want + 4) u.y += dir * u.speed * dt; // close a little
            if (u.cd <= 0) { ne.o.hp -= u.dmg; u.cd = u.atkCd; if (u.range > 80) { spawnBullet(u, ne.o); Studio.Juice.muzzle(scene, u.x, u.y + dir * 14, { tint: u.side === 'p' ? 0xffe27a : 0xff7a4a, scale: 1.1 }); } else { Studio.Juice.burst(scene, ne.o.x, ne.o.y, { texture: 'spark', n: 5, tint: 0xffcc44, life: 200 }); Studio.Juice.ring(scene, (u.x + ne.o.x) / 2, (u.y + ne.o.y) / 2, { tint: 0xffe7a0, r: 16, life: 160, width: 2 }); } }
          } else if (hqDist <= u.range + 6 && (!ne || ne.d > u.range)) {
            // attack the HQ
            if (u.cd <= 0) { if (u.side === 'p') fortressHp -= u.dmg; else garageHp -= u.dmg; u.cd = u.atkCd; Studio.Juice.burst(scene, u.x, hqY + dir * -10, { texture: 'spark', n: 6, tint: 0xff5a3c, life: 240 }); Studio.Juice.ring(scene, u.x, hqY + dir * -10, { tint: 0xff7a4a, r: 22, life: 220 }); }
          } else {
            u.y += dir * u.speed * dt;                       // advance the lane
          }
          if (u.spr) u.spr.setPosition(u.x, u.y);
          if (u.hp <= 0) {
            u.alive = false;
            if (u.spr) {
              var boss = u.type === 'warlord';
              Studio.Juice.explode(scene, u.x, u.y, { texture: 'spark', smoke: 'smoke', n: boss ? 34 : 13, r: boss ? 90 : 42, tint: u.side === 'p' ? 0x6ad6ff : 0xff7a3c, life: boss ? 700 : 420, spMax: boss ? 280 : 160, shake: boss ? 320 : 0, shakeAmt: 0.014, flash: boss });
              if (boss) Studio.Juice.popText(scene, u.x, u.y - 28, 'WARLORD DOWN', { size: 20, color: '#ffd24a' });
              u.spr.destroy();
            }
          }
        }
        // HQ turrets — defend ALL THREE lanes (target nearest enemy by APPROACH
        // distance along the lane, |y-hqY|, not euclidean-from-centre). This is
        // what makes side-lane leaks safe and the autopilot win-by-construction:
        // a unit the rally deathball never meets is still cleared by the base gun.
        gTurretCd -= dt; fTurretCd -= dt;
        var gT = nearestApproaching('e', GAR_Y, spec().garageTurret ? spec().garageTurret.range : 150);
        if (gT && gTurretCd <= 0) { gTurretCd = 0.6; gT.hp -= (spec().garageTurret ? spec().garageTurret.dmg : 14); spawnBullet({ x: 480, y: GAR_Y - 10, range: 200, side: 'p' }, gT); Studio.Juice.muzzle(scene, 480, GAR_Y - 14, { tint: 0x9cf0ff, scale: 1.4 }); }
        var fT = nearestApproaching('p', FORT_Y, spec().fortressTurret ? spec().fortressTurret.range : 160);
        if (fT && fTurretCd <= 0) { fTurretCd = 0.55; fT.hp -= (spec().fortressTurret ? spec().fortressTurret.dmg : 16); spawnBullet({ x: 480, y: FORT_Y + 10, range: 200, side: 'e' }, fT); Studio.Juice.muzzle(scene, 480, FORT_Y + 14, { tint: 0xff7a6a, scale: 1.4 }); }
        // bullets
        for (var b = bullets.length - 1; b >= 0; b--) { var bl = bullets[b]; bl.t -= dt; if (bl.spr) bl.spr.setPosition(bl.x + (bl.tx - bl.x) * (1 - bl.t / bl.life), bl.y + (bl.ty - bl.y) * (1 - bl.t / bl.life)); if (bl.t <= 0) { try { bl.spr.destroy(); } catch (e) {} bullets.splice(b, 1); } }
        // enemy spawn schedule (deterministic)
        var sched = effSched;
        while (schedIdx < sched.length && clock >= sched[schedIdx].t) { var ev = sched[schedIdx]; build('e', ev.type, ev.lane != null ? ev.lane : 1); schedIdx++; }
      }
      function nearestUnitNear(side, x, y, range) {
        var best = null, bd = range || 150;
        for (var i = 0; i < units.length; i++) { var u = units[i]; if (!u.alive || u.side !== side) continue; var d = Math.hypot(u.x - x, u.y - y); if (d < bd) { bd = d; best = u; } }
        return best;
      }
      // nearest enemy by APPROACH along the lane (covers all 3 lanes equally)
      function nearestApproaching(side, hqY, range) {
        var best = null, bd = range || 150;
        for (var i = 0; i < units.length; i++) { var u = units[i]; if (!u.alive || u.side !== side) continue; var d = Math.abs(u.y - hqY); if (d < bd) { bd = d; best = u; } }
        return best;
      }
      function spawnBullet(from, to) {
        var spr = scene.add.image(from.x, from.y, 'pellet').setDepth(6); if (uLayer) uLayer.add(spr);
        bullets.push({ x: from.x, y: from.y, tx: to.x, ty: to.y, t: 0.18, life: 0.18, spr: spr });
      }

      // ===================== scene =====================
      var Play = {
        key: 'Play',
        preload: function () {
          for (var i = 0; i < LEVELS.length; i++) if (TH.backdrops) this.load.image('bg_' + i, TH.backdrops.replace('{i}', i + 1));
          var imgs = TH.images || {}; for (var k in imgs) this.load.image(k, imgs[k]);
          if (TH.menu && TH.menu.logo) this.load.image('menu_logo', TH.menu.logo);
        },
        create: function () {
          scene = this;
          Studio.Textures.bake(this, 'spark', 10, 10, function (g) { g.fillStyle(TH.accent != null ? TH.accent : 0xffcc44, 1).fillCircle(5, 5, 5); g.fillStyle(0xffffff, 1).fillCircle(5, 5, 2); });
          Studio.Textures.bake(this, 'pellet', 7, 7, function (g) { g.fillStyle(0xfff0a0, 1).fillCircle(3.5, 3.5, 3.5); });
          Studio.Textures.bake(this, 'smoke', 16, 16, function (g) { g.fillStyle(0x888078, 0.5).fillCircle(8, 8, 8); g.fillStyle(0xb0a89c, 0.4).fillCircle(8, 8, 5); });
          // procedural roadside PROPS (set-dressing for depth) — tyre stack, barrel, cone
          Studio.Textures.bake(this, 'prop_tyres', 30, 26, function (g) { for (var i = 0; i < 3; i++) { g.fillStyle(0x222226, 1).fillCircle(15, 20 - i * 7, 11); g.fillStyle(0x44444a, 1).fillCircle(15, 20 - i * 7, 5); } });
          Studio.Textures.bake(this, 'prop_barrel', 22, 28, function (g) { g.fillStyle(0xc2462e, 1).fillRoundedRect(2, 2, 18, 24, 4); g.fillStyle(0x8f2f1e, 1).fillRect(2, 9, 18, 3); g.fillStyle(0x8f2f1e, 1).fillRect(2, 18, 18, 3); g.fillStyle(0xffd24a, 1).fillRect(7, 12, 8, 5); });
          Studio.Textures.bake(this, 'prop_cone', 20, 24, function (g) { g.fillStyle(0xff7a2a, 1).fillTriangle(10, 2, 2, 22, 18, 22); g.fillStyle(0xffffff, 1).fillRect(5, 12, 10, 3); g.fillStyle(0x6a3410, 1).fillRect(2, 21, 16, 3); });
          Studio.Textures.bake(this, 'car_fallback', 30, 34, function (g) { g.fillStyle(0x4aa3ff, 1).fillRoundedRect(3, 2, 24, 30, 5); g.fillStyle(0xcdefff, 1).fillRect(7, 6, 16, 8); });
          Studio.Textures.bake(this, 'enemy_fallback', 30, 34, function (g) { g.fillStyle(0xd64a4a, 1).fillRoundedRect(3, 2, 24, 30, 5); g.fillStyle(0x331, 1).fillRect(7, 6, 16, 8); });
          Studio.Textures.bake(this, 'garage_fallback', 200, 90, function (g) { g.fillStyle(0x2a6aa0, 1).fillRoundedRect(0, 0, 200, 80, 10); g.fillStyle(0x9cd, 1).fillRect(70, 14, 60, 50); });
          Studio.Textures.bake(this, 'fortress_fallback', 220, 100, function (g) { g.fillStyle(0x402038, 1).fillRoundedRect(0, 0, 220, 86, 10); g.fillStyle(0xff3b6b, 1).fillRect(96, 50, 28, 28); });

          this.add.rectangle(W / 2, H / 2, W, H, TH.sky != null ? TH.sky : 0x1a160f).setDepth(-100);
          bgImg = this.add.image(W / 2, H / 2, scene.textures.exists('bg_0') ? 'bg_0' : 'spark').setDisplaySize(W, H).setDepth(-90);
          if (!scene.textures.exists('bg_0')) bgImg.setVisible(false);
          // lane guides
          LANES.forEach(function (lx) { scene.add.rectangle(lx, H / 2, 86, H, 0xffffff, 0.04).setDepth(-80); });
          // PROPS — roadside set-dressing scattered down the two margins (fixed,
          // deterministic positions; purely cosmetic, depth-sorted behind units).
          var PROPS = ['prop_tyres', 'prop_barrel', 'prop_cone'];
          [[40, 120], [70, 250], [44, 380], [66, 470], [916, 150], [892, 300], [918, 410], [890, 500]].forEach(function (p, i) {
            var pr = scene.add.image(p[0], p[1], PROPS[(i * 2 + 1) % PROPS.length]).setDepth(2).setAlpha(0.95); pr.setScale(1.1);
          });
          // ambient atmosphere — slow drifting dust/embers tinted to the ground
          Studio.Juice.ambient(this, W, { texture: 'spark', y: H + 6, vyMin: -34, vyMax: -14, drift: 10, scale: 0.5, alpha: 0.22, frequency: 220, tint: TH.accent != null ? TH.accent : 0xffcc44, lifespan: 6000 });
          uLayer = this.add.container(0, 0).setDepth(4);
          depotLayer = this.add.container(0, 0).setDepth(3);

          this.garage = this.add.image(480, GAR_Y + 22, scene.textures.exists('garage_art') ? 'garage_art' : 'garage_fallback').setDepth(3); this.garage.setDisplaySize(220, 92);
          this.fortress = this.add.image(480, FORT_Y - 18, scene.textures.exists('fortress_art') ? 'fortress_art' : 'fortress_fallback').setDepth(3); this.fortress.setDisplaySize(240, 100);

          if (TH.grade) Studio.Juice.grade(this, function (cm) { try { cm.saturate(TH.grade.saturate || 0.14); cm.brightness(TH.grade.brightness || 1); } catch (e) {} });
          if (TH.vignette) Studio.Juice.vignette(this, TH.vignette);

          // HUD + HP bars
          scene._hud = this.add.text(16, 12, '', { fontFamily: FONT, fontSize: '18px', color: TH.hud && TH.hud.color || '#ffe7a0', stroke: TH.hud && TH.hud.stroke || '#1a1208', strokeThickness: 5 }).setScrollFactor(0).setDepth(100);
          this._fbar = this.add.graphics().setDepth(101); this._gbar = this.add.graphics().setDepth(101);

          // build bar (DOM-free: canvas buttons) — units + the REFINERY (economy)
          this._buildUI = this.add.container(0, 0).setDepth(102);
          var defs = [['scout', '1'], ['brawler', '2'], ['gunner', '3'], ['depot', '4']];
          defs.forEach(function (d, i) {
            var econ = d[0] === 'depot', cost = econ ? REFINERY.cost : UNIT[d[0]].cost;
            var bx = 312 + i * 116, by = H - 26;
            var btn = scene.add.rectangle(bx, by, 108, 36, econ ? 0x3a2c08 : 0x000000, econ ? 0.7 : 0.5).setStrokeStyle(2, econ ? 0xffd24a : (TH.accent != null ? TH.accent : 0xffcc44)).setInteractive({ useHandCursor: true });
            var lbl = scene.add.text(bx, by, d[1] + ' ' + (econ ? 'REFINERY' : d[0].toUpperCase()) + ' ' + cost, { fontFamily: FONT, fontSize: '11px', color: econ ? '#ffd86a' : '#ffe7a0' }).setOrigin(0.5);
            btn.on('pointerdown', function () { buildType = d[0]; build('p', d[0], selLane); });
            scene._buildUI.add(btn); scene._buildUI.add(lbl);
          });
          // lane labels (still clickable to pre-select)
          LANES.forEach(function (lx, li) { var t = scene.add.text(lx, H - 64, '▲ LANE ' + (li + 1), { fontFamily: FONT, fontSize: '12px', color: '#ffe7a0' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(102); t.on('pointerdown', function () { selLane = li; }); scene._laneLabels = scene._laneLabels || []; scene._laneLabels.push(t); });
          // ONE-CLICK DEPLOY (playtest ask): click anywhere on a lane → the selected
          // car deploys there immediately (no select-lane-then-build two-step).
          this.input.on('pointerdown', function (ptr) {
            if (mode !== 'play' || ptr.y > H - 84) return;            // ignore the build bar / lane labels
            var best = 0, bd = 1e9;
            for (var li = 0; li < LANES.length; li++) { var d = Math.abs(ptr.x - LANES[li]); if (d < bd) { bd = d; best = li; } }
            if (bd > 130) return;                                      // not near a lane
            selLane = best; build('p', buildType, best); hud();
          });
          hud();

          this.cursors = this.input.keyboard.createCursorKeys();
          this.input.keyboard.on('keydown', function (e) { if (mode !== 'play') return; if (e.key === '1') build('p', 'scout', selLane); else if (e.key === '2') build('p', 'brawler', selLane); else if (e.key === '3') build('p', 'gunner', selLane); else if (e.key === '4') build('p', 'depot', selLane); else if (e.key === 'ArrowLeft') selLane = Math.max(0, selLane - 1); else if (e.key === 'ArrowRight') selLane = Math.min(2, selLane + 1); });

          var startBed = function () { if (bedOn || !TH.music) return; bedOn = true; var a = Studio.Audio.music(Studio.levelMusic(TH, LEVELS, levelIndex) || TH.music.url, TH.music.vol != null ? TH.music.vol : 0.55); if (!a && TH.music.fallback) Studio.Audio.music(TH.music.fallback, 0.3); };
          this.input.once('pointerdown', startBed); if (this.input.keyboard) this.input.keyboard.once('keydown', startBed);

          Studio.Shell.create(this, {
            theme: TH.shell || null,
            links: (function () { var L = [{ label: '📖 DIARY', href: '/diary.html' }]; if (cfg.repo) { L.push({ label: '🐙 REPO', href: 'https://github.com/' + cfg.repo }); L.push({ label: '🐛 NOTES → ISSUES', href: 'https://github.com/' + cfg.repo + '/issues' }); } return L; })(),
            context: function () { var s = spec(); return { where: 'G' + (levelIndex + 1) + ' ' + (s.name || ''), level: levelIndex + 1, levelName: s.name || '', scrap: Math.round(scrap), fortressHp: Math.round(fortressHp), garageHp: Math.round(garageHp), won: won, deaths: deaths, game: slug }; },
            onRestart: function () { startGame(0); }
          });

          Studio.harness.install(root.game, {
            snapshot: snapshot,
            setInput: function () {},
            autopilot: function (on) { auto = !!on; },
            reset: function () { clearMenu(); mode = 'play'; try { scene.physics.world.resume(); } catch (e) {} deaths = 0; won = false; frame = 0; loadLevel(0); hud(); }
          });
          root.__sense = function () { return { scrap: Math.round(scrap), fortressHp: Math.round(fortressHp), garageHp: Math.round(garageHp), rally: spec().rally != null ? spec().rally : 1 }; };

          loadLevel(0);
          if (!cfg.skipMenu) showMenu();
        },
        update: function (time, delta) {
          if (!scene) return; if (mode !== 'play') return;
          frame++;
          var dt = Math.min((delta || (1000 / 60)) / 1000, 1 / 30); clock += dt;

          // AUTOPILOT: a deterministic macro — an optional ECONOMY OPENING (build
          // autoEcon refineries first, front-loading income) then ALL-IN on the
          // rally lane. autoEcon defaults to 0, so the army loop stays byte-identical
          // (the proven win-by-construction); with autoEcon>0 the AI plays economy too.
          if (auto && !won) {
            var rl = spec().rally != null ? spec().rally : 1, bt = spec().autoBuild || 'brawler', econ = spec().autoEcon || 0;
            var eg = 0; while (depots < econ && scrap >= REFINERY.cost && eg < 2) { build('p', 'depot', rl); eg++; }
            var guard = 0;
            while (scrap >= tuned(bt).cost && guard < 4) { build('p', bt, rl); guard++; }
          }

          tickWorld(dt);

          // WIN / LOSE
          if (!won && fortressHp <= 0) {
            // the fortress comes down — a chain of explosions across its footprint
            if (scene && scene.fortress) { for (var fb = 0; fb < 5; fb++) { (function (k) { scene.time.delayedCall(k * 90, function () { Studio.Juice.explode(scene, 480 + (k - 2) * 46, FORT_Y + 6, { texture: 'spark', smoke: 'smoke', n: 22, r: 70, tint: 0xffb24a, life: 560, spMax: 240, shake: 200, shakeAmt: 0.012, flash: k === 0 }); }); })(fb); } }
            if (levelIndex < LEVELS.length - 1) {
              Studio.Audio.sfx('win'); Studio.Juice.flash(scene, 160, 150, 255, 200);
              var stats = { score: Math.round(scrap), timeMs: Math.round(((frame - levelStartFrame) / 60) * 1000) };
              if (!auto) { save = Studio.Save.levelClear(slug, levelIndex, { coins: Math.round(scrap), timeMs: stats.timeMs }) || save; showCard(levelIndex, stats); }
              else { loadLevel(levelIndex + 1); }
            } else { won = true; Studio.Audio.sfx('win'); Studio.Juice.flash(scene, 300, 200, 255, 220); if (!auto) showWin({ score: Math.round(scrap) }); }
          }
          if (garageHp <= 0 && deaths === 0) { deaths++; Studio.Juice.flash(scene, 240, 255, 60, 60); Studio.Juice.shake(scene, 240, 0.012); if (!auto) showLose(); else { loadLevel(levelIndex); } }
          hud();
        }
      };
      function hud() {
        if (!scene || !scene._hud) return;
        scene._hud.setText('⚙ scrap ' + Math.round(scrap) + '  (+' + Math.round(curIncome()) + '/s' + (depots ? ' · ' + depots + '⛽' : '') + ')   ' + (TH.stageWord || 'ground') + ' ' + (levelIndex + 1) + '/' + LEVELS.length + '   lane ' + (selLane + 1));
        if (scene._fbar) { scene._fbar.clear(); scene._fbar.fillStyle(0x331018).fillRect(330, 22, 300, 9); scene._fbar.fillStyle(0xff3b6b).fillRect(330, 22, 300 * Math.max(0, fortressHp / fortressMax), 9); }
        if (scene._gbar) { scene._gbar.clear(); scene._gbar.fillStyle(0x06202a).fillRect(330, H - 88, 300, 9); scene._gbar.fillStyle(0x44d6ff).fillRect(330, H - 88, 300 * Math.max(0, garageHp / garageMax), 9); }
        if (scene._laneLabels) scene._laneLabels.forEach(function (t, li) { t.setColor(li === selLane ? '#ffffff' : '#ffe7a0'); });
      }
      function toast(txt) { if (!txt || mode !== 'play' || !scene) return; var t = scene.add.text(W / 2, 220, txt, { fontFamily: FONT, fontSize: '30px', color: TH.hud && TH.hud.color || '#ffe7a0', stroke: TH.hud && TH.hud.stroke || '#1a1208', strokeThickness: 6 }).setOrigin(0.5).setDepth(120).setAlpha(0); scene.tweens.add({ targets: t, alpha: 1, y: 206, duration: 420, yoyo: true, hold: 1100, onComplete: function () { try { t.destroy(); } catch (e) {} } }); }

      // ===================== menu (compact deepfin-style; rts-local) =====================
      function clearMenu() { if (menuLayer) { try { menuLayer.destroy(true); } catch (e) {} menuLayer = null; } }
      function mtext(c, x, y, str, size, it) { var t = scene.add.text(x, y, str, { fontFamily: FONT, fontSize: size + 'px', color: TH.hud && TH.hud.color || '#ffe7a0', stroke: TH.hud && TH.hud.stroke || '#1a1208', strokeThickness: Math.max(3, size / 7), align: 'center' }).setOrigin(0.5); if (it) { t.setInteractive({ useHandCursor: true }); t.on('pointerover', function () { t.setScale(1.07); }); t.on('pointerout', function () { t.setScale(1); }); } c.add(t); return t; }
      function showMenu() {
        mode = 'menu'; clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(400);
        if (scene.textures.exists('bg_0')) menuLayer.add(scene.add.image(W / 2, H / 2, 'bg_0').setDisplaySize(W, H)); else menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, TH.sky != null ? TH.sky : 0x1a160f));
        menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x140d04, 0.5));
        var hk = scene.textures.exists('car_brawler') ? 'car_brawler' : 'car_fallback';
        var hs = scene.add.image(290, 300, hk).setScale(150 / scene.textures.get(hk).getSourceImage().height); scene.tweens.add({ targets: hs, y: 288, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); menuLayer.add(hs);
        if (scene.textures.exists('menu_logo')) { var lg = scene.add.image(0, 0, 'menu_logo'); lg.setScale(Math.min(440 / lg.width, 130 / lg.height, 1)); lg.setPosition(300, 30 + lg.displayHeight / 2); menuLayer.add(lg); if (cfg.tagline) mtext(menuLayer, 300, 30 + lg.displayHeight + 16, cfg.tagline.toUpperCase(), 11); }
        else { mtext(menuLayer, 300, 70, title.toUpperCase(), 44); if (cfg.tagline) mtext(menuLayer, 300, 112, cfg.tagline.toUpperCase(), 11); }
        var unlocked = Math.max(1, save.unlocked || 1), y0 = 250 - ((LEVELS.length - 1) * 60) / 2;
        LEVELS.forEach(function (L, i) { var open = i < unlocked, cy = y0 + i * 60; var card = scene.add.rectangle(800, cy, 280, 50, L.sky != null ? L.sky : 0x241a0c, 1).setStrokeStyle(2, open ? (TH.accent != null ? TH.accent : 0xffcc44) : 0x333, 1); if (open) { card.setInteractive({ useHandCursor: true }); card.on('pointerdown', function () { startGame(i); }); } else card.setAlpha(0.4); menuLayer.add(card); mtext(menuLayer, 800, cy, (open ? (i + 1) + '. ' : '🔒 ') + (L.name || 'GROUND ' + (i + 1)).toUpperCase(), 13); });
        mtext(menuLayer, 480, 498, '▶  CLICK A GROUND · OR PRESS SPACE', 14);
        mtext(menuLayer, 480, 520, cfg.controls || 'click a lane · 1/2/3 build cars', 11).setAlpha(0.8);
        var go = function () { if (mode === 'menu') startGame(Math.min(unlocked - 1, LEVELS.length - 1)); };
        scene.input.keyboard.once('keydown-SPACE', go); scene.input.keyboard.once('keydown-ENTER', go);
      }
      function startGame(i) { clearMenu(); mode = 'play'; won = false; deaths = 0; loadLevel(i); hud(); }
      function showCard(i, stats) { mode = 'card'; clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(400); menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x140d04, 0.7)); mtext(menuLayer, 480, 200, (spec().name || 'GROUND') + ' — TAKEN', 26); mtext(menuLayer, 480, 250, 'scrap ' + stats.score + '  ·  ' + (stats.timeMs / 1000).toFixed(1) + 's', 16); var go = function () { if (mode === 'card') startGame(i + 1); }; mtext(menuLayer, 480, 320, '▶  NEXT GROUND', 22, true).on('pointerdown', go); scene.input.keyboard.once('keydown-SPACE', go); scene.time.delayedCall(2600, go); }
      function showWin(st) { mode = 'win'; clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(400); menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x140d04, 0.78)); mtext(menuLayer, 480, 170, TH.toasts && TH.toasts.win || 'THE ROAD IS YOURS', 34); mtext(menuLayer, 480, 230, 'final scrap ' + st.score, 18); mtext(menuLayer, 480, 310, '↻  PLAY AGAIN', 22, true).on('pointerdown', function () { startGame(0); }); mtext(menuLayer, 480, 360, 'MENU', 15, true).on('pointerdown', function () { showMenu(); }); }
      function showLose() { mode = 'win'; clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(400); menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x1a0404, 0.8)); mtext(menuLayer, 480, 200, 'GARAGE DESTROYED', 30); mtext(menuLayer, 480, 280, '↻  RETRY', 22, true).on('pointerdown', function () { startGame(levelIndex); }); mtext(menuLayer, 480, 330, 'MENU', 15, true).on('pointerdown', function () { showMenu(); }); }

      var config = { type: Phaser.AUTO, backgroundColor: TH.cssBg || '#1a160f', seed: [cfg.seed || title], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H }, render: { preserveDrawingBuffer: true, pixelArt: false }, physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } }, scene: [Play] };
      var rp = new URLSearchParams(location.search).get('r'); if (rp === 'canvas') config.type = Phaser.CANVAS; else if (rp === 'webgl') config.type = Phaser.WEBGL;
      root.game = new Phaser.Game(config);
      return root.game;
    }
  };

  // ============================================================ Studio.IsoRTS
  // The ISOMETRIC redesign of the car RTS: a freer 2.5D battlefield instead of
  // three fixed lanes. The deterministic combat + economy + win-by-construction
  // bounds are REUSED from Studio.RTS (depth axis y: fortress 64 → garage 492),
  // but the lane index is replaced by a CONTINUOUS lateral coordinate lx∈[-1,1]
  // (units fight whoever is within a lateral BAND ahead), and the world is drawn
  // in perspective iso: deeper = higher + narrower + smaller, near = lower + wider
  // + bigger, depth-sorted. Same scrap economy, same turrets, same 0-death proof.
  Studio.IsoRTS = {
    boot: function (cfg) {
      var TH = cfg.theme || {}, LEVELS = cfg.levels || root.LEVELS || [];
      var title = cfg.title || 'Studio IsoRTS', slug = cfg.slug || 'isorts';
      var W = 960, H = 540, FONT = 'Georgia, "Times New Roman", serif';
      var FORT_Y = 64, GAR_Y = 492, DEPTH = GAR_Y - FORT_Y;           // combat depth axis (reused from RTS)
      var BAND = 0.22;                                                 // lateral engage band (lx units)
      // iso projection screen anchors
      var FAR_Y = 120, NEAR_Y = 470, CX = 480, FAR_HALF = 150, NEAR_HALF = 330, FAR_SC = 0.52, NEAR_SC = 1.04;
      var UNIT = {
        scout:   { cost: 20, hp: 42,  dmg: 6,  range: 38,  speed: 96, cd: 0.5, r: 17 },
        brawler: { cost: 46, hp: 130, dmg: 13, range: 42,  speed: 60, cd: 0.7, r: 20 },
        gunner:  { cost: 36, hp: 54,  dmg: 9,  range: 140, speed: 74, cd: 0.55, r: 17 },
        warlord: { cost: 999, hp: 620, dmg: 22, range: 46, speed: 42, cd: 0.9, r: 32 }
      };
      var REFINERY = (cfg.economy && cfg.economy.refinery) || { cost: 55, bonus: 7, max: 4 };
      var save = Studio.Save.load(slug);

      var scene, units = [], uid = 0, scrap = 0, income = 12, depots = 0, garageHp = 1000, fortressHp = 1000, garageMax = 1000, fortressMax = 1000;
      var levelIndex = 0, clock = 0, frame = 0, won = false, deaths = 0, buildType = 'brawler', selLx = 0;
      var auto = false, schedIdx = 0, effSched = [], bedOn = false, mode = cfg.skipMenu ? 'play' : 'menu', menuLayer = null, levelStartFrame = 0;
      var gTurretCd = 0, fTurretCd = 0, bullets = [], bgImg = null, fieldLayer = null, depotLayer = null;
      var spec = function () { return LEVELS[levelIndex] || {}; };
      function curIncome() { return income + depots * REFINERY.bonus; }

      // the shared iso building block — configured for this game's field
      var ISO = Studio.Iso.projector({ farY: FAR_Y, nearY: NEAR_Y, cx: CX, farHalf: FAR_HALF, nearHalf: NEAR_HALF, farScale: FAR_SC, nearScale: NEAR_SC, depthSpan: 120 });
      function project(lx, y) { return ISO.at(lx, (y - FORT_Y) / DEPTH); }          // (lx∈[-1,1], depth-y) -> iso screen
      function place(spr, lx, y, baseScale) { return ISO.place(spr, lx, (y - FORT_Y) / DEPTH, baseScale); }

      function snapshot() {
        return {
          x: 0, y: 0, vx: 0, vy: 0, scrap: Math.round(scrap), coins: Math.round(scrap),
          garageHp: Math.round(garageHp), fortressHp: Math.round(fortressHp), depots: depots, income: +curIncome().toFixed(1),
          units: units.filter(function (u) { return u.alive; }).length,
          deaths: deaths, dead: deaths > 0, won: won, frame: frame, level: levelIndex, maxX: 0
        };
      }

      function loadLevel(i) {
        levelIndex = i; clock = 0; schedIdx = 0; won = false;
        var s = spec(); effSched = Studio.rtsPressure(s, 'lx');     // systematic difficulty→flank pressure (iso)
        units.forEach(function (u) { try { u.spr.destroy(); } catch (e) {} }); units = []; uid = 0;
        bullets.forEach(function (b) { try { b.spr.destroy(); } catch (e) {} }); bullets = [];
        depots = 0; if (depotLayer) depotLayer.removeAll(true);
        income = s.income || 12; scrap = s.startScrap != null ? s.startScrap : 40;
        garageHp = garageMax = s.garageHp || 1000; fortressHp = fortressMax = s.fortressHp || 1000;
        if (bgImg) bgImg.setTexture(scene.textures.exists('bg_' + i) ? 'bg_' + i : 'bg_0');
        levelStartFrame = frame;
        if (bedOn) Studio.Audio.switchMusic(Studio.levelMusic(TH, LEVELS, i), TH.music && TH.music.vol != null ? TH.music.vol : 0.55);
        toast((TH.toasts && TH.toasts.level || 'GROUND {i} · {name}').replace('{i}', i + 1).replace('{name}', s.name || ''));
        hud();
      }
      function tuned(type) { var u = UNIT[type], t = (spec().tune || {})[type] || {}; return { cost: t.cost || u.cost, hp: t.hp || u.hp, dmg: t.dmg || u.dmg, range: u.range, speed: u.speed, cd: u.cd, r: u.r }; }
      function spawnUnit(side, type, lx) {
        var st = tuned(type), id = uid++, y = side === 'p' ? GAR_Y - 18 : FORT_Y + 18;
        var tex = (side === 'p' ? 'car_' : 'enemy_') + type;
        var spr = scene.add.image(0, 0, scene.textures.exists(tex) ? tex : (side === 'p' ? 'car_fallback' : 'enemy_fallback'));
        // size cars to a readable on-screen height (the iso depth scale `sc` then
        // makes near cars bigger, far cars smaller). Was 0.4*44 ≈ 18px — far too tiny.
        var base = (type === 'warlord' ? 104 : 58) / Math.max(1, spr.height);
        if (side === 'e') spr.setFlipX(true);
        var u = { id: id, side: side, type: type, lx: lx, y: y, hp: st.hp, maxHp: st.hp, dmg: st.dmg, range: st.range, speed: st.speed, cd: 0, atkCd: st.cd, r: st.r, spr: spr, base: base, alive: true };
        place(spr, lx, y, base); if (fieldLayer) fieldLayer.add(spr); units.push(u);
      }
      function build(side, type, lx) {
        if (type === 'depot') return buildRefinery();
        if (side === 'p') { var c = tuned(type).cost; if (scrap < c) return false; scrap -= c; }
        spawnUnit(side, type, lx); Studio.Audio.sfx('jump'); return true;
      }
      function buildRefinery() {
        if (depots >= REFINERY.max || scrap < REFINERY.cost) return false;
        scrap -= REFINERY.cost; depots++;
        if (scene && depotLayer) { var lx = -0.9 + (depots - 1) * 0.12, p = project(lx, GAR_Y + 6); var spr = scene.add.image(p.sx, p.sy, scene.textures.exists('depot_art') ? 'depot_art' : 'spark').setDepth(p.depth).setScale(0.5 * p.sc); depotLayer.add(spr); Studio.Juice.burst(scene, p.sx, p.sy, { texture: 'spark', n: 8, tint: 0xffcc44, life: 360 }); }
        Studio.Audio.sfx('coin'); hud(); return true;
      }
      function nearestEnemyAhead(u) {
        var foe = u.side === 'p' ? 'e' : 'p', best = null, bd = 1e9;
        for (var i = 0; i < units.length; i++) { var o = units[i]; if (!o.alive || o.side !== foe) continue; if (Math.abs(o.lx - u.lx) > BAND) continue; var ahead = u.side === 'p' ? (o.y < u.y) : (o.y > u.y); if (!ahead) continue; var d = Math.abs(o.y - u.y); if (d < bd) { bd = d; best = o; } }
        return best ? { o: best, d: bd } : null;
      }
      function nearestApproaching(side, hqY, range) {
        var best = null, bd = range || 150;
        for (var i = 0; i < units.length; i++) { var u = units[i]; if (!u.alive || u.side !== side) continue; var d = Math.abs(u.y - hqY); if (d < bd) { bd = d; best = u; } }
        return best;
      }
      function spawnBullet(from, to) { var p = project(from.lx, from.y), q = project(to.lx, to.y); var spr = scene.add.image(p.sx, p.sy, 'pellet').setDepth(200); if (fieldLayer) fieldLayer.add(spr); bullets.push({ x: p.sx, y: p.sy, tx: q.sx, ty: q.sy, t: 0.18, life: 0.18, spr: spr }); }

      function tickWorld(dt) {
        scrap += curIncome() * dt;
        for (var i = 0; i < units.length; i++) {
          var u = units[i]; if (!u.alive) continue; u.cd -= dt;
          var ne = nearestEnemyAhead(u), dir = u.side === 'p' ? -1 : 1;
          var hqY = u.side === 'p' ? FORT_Y : GAR_Y, hqDist = Math.abs(u.y - hqY);
          if (ne && ne.d <= Math.max(u.range, u.r + 10)) {
            var want = u.range > 80 ? u.range - 6 : (u.r + ne.o.r + 4);
            if (ne.d > want + 4) u.y += dir * u.speed * dt;
            if (u.cd <= 0) { ne.o.hp -= u.dmg; u.cd = u.atkCd; if (u.range > 80) { spawnBullet(u, ne.o); Studio.Juice.muzzle(scene, project(u.lx, u.y).sx, project(u.lx, u.y).sy, { tint: u.side === 'p' ? 0xffe27a : 0xff7a4a }); } else { var pc = project((u.lx + ne.o.lx) / 2, (u.y + ne.o.y) / 2); Studio.Juice.burst(scene, pc.sx, pc.sy, { texture: 'spark', n: 5, tint: 0xffcc44, life: 200 }); } }
          } else if (hqDist <= u.range + 6 && (!ne || ne.d > u.range)) {
            if (u.cd <= 0) { if (u.side === 'p') fortressHp -= u.dmg; else garageHp -= u.dmg; u.cd = u.atkCd; var ph = project(u.lx, hqY + dir * -10); Studio.Juice.burst(scene, ph.sx, ph.sy, { texture: 'spark', n: 6, tint: 0xff5a3c, life: 240 }); }
          } else { u.y += dir * u.speed * dt; }
          if (u.spr) place(u.spr, u.lx, u.y, u.base);
          if (u.hp <= 0) { u.alive = false; if (u.spr) { var boss = u.type === 'warlord', pp = project(u.lx, u.y); Studio.Juice.explode(scene, pp.sx, pp.sy, { texture: 'spark', smoke: 'smoke', n: boss ? 34 : 13, r: boss ? 90 : 42, tint: u.side === 'p' ? 0x6ad6ff : 0xff7a3c, life: boss ? 700 : 420, spMax: boss ? 280 : 160, shake: boss ? 320 : 0, flash: boss }); if (boss) Studio.Juice.popText(scene, pp.sx, pp.sy - 26, 'WARLORD DOWN', { size: 20, color: '#ffd24a' }); u.spr.destroy(); } }
        }
        gTurretCd -= dt; fTurretCd -= dt;
        var gT = nearestApproaching('e', GAR_Y, spec().garageTurret ? spec().garageTurret.range : 150);
        if (gT && gTurretCd <= 0) { gTurretCd = 0.6; gT.hp -= (spec().garageTurret ? spec().garageTurret.dmg : 14); spawnBullet({ lx: 0, y: GAR_Y - 10 }, gT); }
        var fT = nearestApproaching('p', FORT_Y, spec().fortressTurret ? spec().fortressTurret.range : 160);
        if (fT && fTurretCd <= 0) { fTurretCd = 0.55; fT.hp -= (spec().fortressTurret ? spec().fortressTurret.dmg : 16); spawnBullet({ lx: 0, y: FORT_Y + 10 }, fT); }
        for (var b = bullets.length - 1; b >= 0; b--) { var bl = bullets[b]; bl.t -= dt; if (bl.spr) bl.spr.setPosition(bl.x + (bl.tx - bl.x) * (1 - bl.t / bl.life), bl.y + (bl.ty - bl.y) * (1 - bl.t / bl.life)); if (bl.t <= 0) { try { bl.spr.destroy(); } catch (e) {} bullets.splice(b, 1); } }
        var sched = effSched;
        while (schedIdx < sched.length && clock >= sched[schedIdx].t) { var ev = sched[schedIdx]; build('e', ev.type, ev.lx != null ? ev.lx : 0); schedIdx++; }
      }

      var Play = {
        key: 'Play',
        preload: function () {
          for (var i = 0; i < LEVELS.length; i++) if (TH.backdrops) this.load.image('bg_' + i, TH.backdrops.replace('{i}', i + 1));
          var imgs = TH.images || {}; for (var k in imgs) this.load.image(k, imgs[k]);
          if (TH.menu && TH.menu.logo) this.load.image('menu_logo', TH.menu.logo);
        },
        create: function () {
          scene = this;
          Studio.Textures.bake(this, 'spark', 10, 10, function (g) { g.fillStyle(TH.accent != null ? TH.accent : 0xffcc44, 1).fillCircle(5, 5, 5); g.fillStyle(0xffffff, 1).fillCircle(5, 5, 2); });
          Studio.Textures.bake(this, 'pellet', 7, 7, function (g) { g.fillStyle(0xfff0a0, 1).fillCircle(3.5, 3.5, 3.5); });
          Studio.Textures.bake(this, 'smoke', 16, 16, function (g) { g.fillStyle(0x888078, 0.5).fillCircle(8, 8, 8); });
          Studio.Textures.bake(this, 'car_fallback', 30, 34, function (g) { g.fillStyle(0x4aa3ff, 1).fillRoundedRect(3, 2, 24, 30, 5); });
          Studio.Textures.bake(this, 'enemy_fallback', 30, 34, function (g) { g.fillStyle(0xd64a4a, 1).fillRoundedRect(3, 2, 24, 30, 5); });
          Studio.Textures.bake(this, 'garage_fallback', 200, 110, function (g) { g.fillStyle(0x2a6aa0, 1).fillRoundedRect(0, 20, 200, 80, 10); g.fillStyle(0x9cd, 1).fillRect(70, 40, 60, 50); });
          Studio.Textures.bake(this, 'fortress_fallback', 220, 120, function (g) { g.fillStyle(0x402038, 1).fillRoundedRect(0, 24, 220, 86, 10); g.fillStyle(0xff3b6b, 1).fillRect(96, 60, 28, 28); });

          this.add.rectangle(W / 2, H / 2, W, H, TH.sky != null ? TH.sky : 0x1a160f).setDepth(-100);
          bgImg = this.add.image(W / 2, H / 2, scene.textures.exists('bg_0') ? 'bg_0' : 'spark').setDepth(-90);
          if (scene.textures.exists('bg_0')) { var bw = bgImg.width, bh = bgImg.height, k = Math.max(W / bw, H / bh); bgImg.setScale(k); } else bgImg.setVisible(false);
          Studio.Juice.ambient(this, W, { texture: 'spark', y: H + 6, vyMin: -30, vyMax: -12, drift: 12, scale: 0.5, alpha: 0.2, frequency: 240, tint: TH.accent != null ? TH.accent : 0xffcc44, lifespan: 6000 });

          // HQ buildings at the iso ends (origin bottom so they sit on the ground)
          var fp = project(0, FORT_Y), gp = project(0, GAR_Y);
          this.fortress = this.add.image(fp.sx, fp.sy, scene.textures.exists('fortress_art') ? 'fortress_art' : 'fortress_fallback').setOrigin(0.5, 0.9).setDepth(fp.depth - 1); this.fortress.setScale((150 / Math.max(1, this.fortress.height)) * fp.sc * 1.4);
          // the garage sits BELOW the near units (playtest: "my garage blocks the
          // view of my cars") — drawn behind + slightly translucent so fresh
          // deploys are always readable.
          this.garage = this.add.image(gp.sx, gp.sy + 6, scene.textures.exists('garage_art') ? 'garage_art' : 'garage_fallback').setOrigin(0.5, 0.85).setDepth(gp.depth - 30).setAlpha(0.92); this.garage.setScale((150 / Math.max(1, this.garage.height)) * gp.sc);
          // LANE GUIDES (playtest: "I want to see multiple lanes clearly") — the three
          // deploy lanes (lx −0.6 / 0 / +0.6) as soft projected stripes down the field.
          var laneG = this.add.graphics().setDepth(2).setAlpha(0.30);
          [-0.6, 0, 0.6].forEach(function (glx) {
            var hw = 0.085;
            var p1 = ISO.at(glx - hw, 0.02), p2 = ISO.at(glx + hw, 0.02), p3 = ISO.at(glx + hw, 0.985), p4 = ISO.at(glx - hw, 0.985);
            laneG.fillStyle(0xffffff, 0.10).fillPoints([{ x: p1.sx, y: p1.sy }, { x: p2.sx, y: p2.sy }, { x: p3.sx, y: p3.sy }, { x: p4.sx, y: p4.sy }], true);
            laneG.lineStyle(2, TH.accent != null ? TH.accent : 0xffcc44, 0.35);
            var m1 = ISO.at(glx, 0.02), m2 = ISO.at(glx, 0.985);
            laneG.lineBetween(m1.sx, m1.sy, m2.sx, m2.sy);
          });
          fieldLayer = this.add.container(0, 0); depotLayer = this.add.container(0, 0).setDepth(gp.depth - 31);

          if (TH.grade) Studio.Juice.grade(this, function (cm) { try { cm.saturate(TH.grade.saturate || 0.14); cm.brightness(TH.grade.brightness || 1); } catch (e) {} });
          if (TH.vignette) Studio.Juice.vignette(this, TH.vignette);

          scene._hud = this.add.text(16, 12, '', { fontFamily: FONT, fontSize: '18px', color: TH.hud && TH.hud.color || '#ffe7a0', stroke: TH.hud && TH.hud.stroke || '#1a1208', strokeThickness: 5 }).setScrollFactor(0).setDepth(500);
          this._fbar = this.add.graphics().setDepth(501); this._gbar = this.add.graphics().setDepth(501);

          this._buildUI = this.add.container(0, 0).setDepth(502);
          var defs = [['scout', '1'], ['brawler', '2'], ['gunner', '3'], ['depot', '4']];
          defs.forEach(function (d, i) {
            var econ = d[0] === 'depot', cost = econ ? REFINERY.cost : UNIT[d[0]].cost, bx = 312 + i * 116, by = H - 26;
            var btn = scene.add.rectangle(bx, by, 108, 36, econ ? 0x3a2c08 : 0x000000, econ ? 0.7 : 0.55).setStrokeStyle(2, econ ? 0xffd24a : (TH.accent != null ? TH.accent : 0xffcc44)).setInteractive({ useHandCursor: true });
            var lbl = scene.add.text(bx, by, d[1] + ' ' + (econ ? 'REFINERY' : d[0].toUpperCase()) + ' ' + cost, { fontFamily: FONT, fontSize: '11px', color: econ ? '#ffd86a' : '#ffe7a0' }).setOrigin(0.5);
            btn.on('pointerdown', function () { buildType = d[0]; if (econ) build('p', 'depot', 0); });
            scene._buildUI.add(btn); scene._buildUI.add(lbl);
          });
          scene.add.text(CX, H - 52, 'CLICK THE FIELD TO DEPLOY  ·  1/2/3 pick a car', { fontFamily: FONT, fontSize: '11px', color: '#ffe7a0' }).setOrigin(0.5).setDepth(502).setAlpha(0.85);
          hud();

          // click the field -> deploy the selected car at that lateral spot
          this.input.on('pointerdown', function (ptr) { if (mode !== 'play') return; if (ptr.y > H - 44) return; var lx = ISO.lxAt(ptr.x); selLx = lx; if (buildType !== 'depot') build('p', buildType, lx); });
          this.input.keyboard.on('keydown', function (e) { if (mode !== 'play') return; if (e.key === '1') buildType = 'scout'; else if (e.key === '2') buildType = 'brawler'; else if (e.key === '3') buildType = 'gunner'; else if (e.key === '4') build('p', 'depot', 0); else if (e.key === ' ') build('p', buildType, selLx); });

          var startBed = function () { if (bedOn || !TH.music) return; bedOn = true; var a = Studio.Audio.music(Studio.levelMusic(TH, LEVELS, levelIndex) || TH.music.url, TH.music.vol != null ? TH.music.vol : 0.55); if (!a && TH.music.fallback) Studio.Audio.music(TH.music.fallback, 0.3); };
          this.input.once('pointerdown', startBed); if (this.input.keyboard) this.input.keyboard.once('keydown', startBed);

          Studio.Shell.create(this, {
            theme: TH.shell || null,
            links: (function () { var L = [{ label: '📖 DIARY', href: '/diary.html' }]; if (cfg.repo) { L.push({ label: '🐙 REPO', href: 'https://github.com/' + cfg.repo }); L.push({ label: '🐛 NOTES → ISSUES', href: 'https://github.com/' + cfg.repo + '/issues' }); } return L; })(),
            context: function () { var s = spec(); return { where: 'G' + (levelIndex + 1) + ' ' + (s.name || ''), level: levelIndex + 1, scrap: Math.round(scrap), fortressHp: Math.round(fortressHp), garageHp: Math.round(garageHp), won: won, deaths: deaths, game: slug }; },
            onRestart: function () { startGame(0); }
          });
          Studio.harness.install(root.game, {
            snapshot: snapshot, setInput: function () {},
            autopilot: function (on) { auto = !!on; },
            reset: function () { clearMenu(); mode = 'play'; deaths = 0; won = false; frame = 0; loadLevel(0); hud(); }
          });

          loadLevel(0);
          if (!cfg.skipMenu) showMenu();
        },
        update: function (time, delta) {
          if (!scene || mode !== 'play') return;
          frame++; var dt = Math.min((delta || (1000 / 60)) / 1000, 1 / 30); clock += dt;
          if (auto && !won) {
            var rl = spec().rally != null ? spec().rally : 0, bt = spec().autoBuild || 'brawler', econ = spec().autoEcon || 0;
            var eg = 0; while (depots < econ && scrap >= REFINERY.cost && eg < 2) { build('p', 'depot', rl); eg++; }
            var guard = 0; while (scrap >= tuned(bt).cost && guard < 4) { build('p', bt, rl); guard++; }
          }
          tickWorld(dt);
          if (!won && fortressHp <= 0) {
            if (scene && scene.fortress) { for (var fb = 0; fb < 5; fb++) { (function (k) { scene.time.delayedCall(k * 90, function () { var pe = project((k - 2) * 0.12, FORT_Y); Studio.Juice.explode(scene, pe.sx, pe.sy, { texture: 'spark', smoke: 'smoke', n: 22, r: 70, tint: 0xffb24a, life: 560, spMax: 240, shake: 200, flash: k === 0 }); }); })(fb); } }
            if (levelIndex < LEVELS.length - 1) { Studio.Audio.sfx('win'); Studio.Juice.flash(scene, 160, 150, 255, 200); var stats = { score: Math.round(scrap), timeMs: Math.round(((frame - levelStartFrame) / 60) * 1000) }; if (!auto) { save = Studio.Save.levelClear(slug, levelIndex, { coins: Math.round(scrap), timeMs: stats.timeMs }) || save; showCard(levelIndex, stats); } else { loadLevel(levelIndex + 1); } }
            else { won = true; Studio.Audio.sfx('win'); Studio.Juice.flash(scene, 300, 200, 255, 220); if (!auto) showWin({ score: Math.round(scrap) }); }
          }
          if (garageHp <= 0 && deaths === 0) { deaths++; Studio.Juice.flash(scene, 240, 255, 60, 60); Studio.Juice.shake(scene, 240, 0.012); if (!auto) showLose(); else { loadLevel(levelIndex); } }
          hud();
        }
      };
      function hud() {
        if (!scene || !scene._hud) return;
        scene._hud.setText('⚙ scrap ' + Math.round(scrap) + '  (+' + Math.round(curIncome()) + '/s' + (depots ? ' · ' + depots + '⛽' : '') + ')   ' + (TH.stageWord || 'ground') + ' ' + (levelIndex + 1) + '/' + LEVELS.length);
        if (scene._fbar) { scene._fbar.clear(); scene._fbar.fillStyle(0x331018).fillRect(330, 22, 300, 9); scene._fbar.fillStyle(0xff3b6b).fillRect(330, 22, 300 * Math.max(0, fortressHp / fortressMax), 9); }
        if (scene._gbar) { scene._gbar.clear(); scene._gbar.fillStyle(0x06202a).fillRect(330, H - 92, 300, 9); scene._gbar.fillStyle(0x44d6ff).fillRect(330, H - 92, 300 * Math.max(0, garageHp / garageMax), 9); }
      }
      function toast(txt) { if (!txt || mode !== 'play' || !scene) return; var t = scene.add.text(W / 2, 210, txt, { fontFamily: FONT, fontSize: '30px', color: TH.hud && TH.hud.color || '#ffe7a0', stroke: TH.hud && TH.hud.stroke || '#1a1208', strokeThickness: 6 }).setOrigin(0.5).setDepth(520).setAlpha(0); scene.tweens.add({ targets: t, alpha: 1, y: 196, duration: 420, yoyo: true, hold: 1100, onComplete: function () { try { t.destroy(); } catch (e) {} } }); }

      function clearMenu() { if (menuLayer) { try { menuLayer.destroy(true); } catch (e) {} menuLayer = null; } }
      function mtext(c, x, y, str, size, it) { var t = scene.add.text(x, y, str, { fontFamily: FONT, fontSize: size + 'px', color: TH.hud && TH.hud.color || '#ffe7a0', stroke: TH.hud && TH.hud.stroke || '#1a1208', strokeThickness: Math.max(3, size / 7), align: 'center' }).setOrigin(0.5); if (it) { t.setInteractive({ useHandCursor: true }); t.on('pointerover', function () { t.setScale(1.07); }); t.on('pointerout', function () { t.setScale(1); }); } c.add(t); return t; }
      function showMenu() {
        mode = 'menu'; clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(600);
        if (scene.textures.exists('bg_0')) { var b = scene.add.image(W / 2, H / 2, 'bg_0'); b.setScale(Math.max(W / b.width, H / b.height)); menuLayer.add(b); } else menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, TH.sky != null ? TH.sky : 0x1a160f));
        menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x140d04, 0.5));
        var hk = scene.textures.exists('car_brawler') ? 'car_brawler' : 'car_fallback';
        var hs = scene.add.image(290, 300, hk); hs.setScale(150 / Math.max(1, scene.textures.get(hk).getSourceImage().height)); scene.tweens.add({ targets: hs, y: 288, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); menuLayer.add(hs);
        if (scene.textures.exists('menu_logo')) { var lg = scene.add.image(0, 0, 'menu_logo'); lg.setScale(Math.min(440 / lg.width, 130 / lg.height, 1)); lg.setPosition(300, 30 + lg.displayHeight / 2); menuLayer.add(lg); if (cfg.tagline) mtext(menuLayer, 300, 30 + lg.displayHeight + 16, cfg.tagline.toUpperCase(), 11); }
        else { mtext(menuLayer, 300, 70, title.toUpperCase(), 42); if (cfg.tagline) mtext(menuLayer, 300, 112, cfg.tagline.toUpperCase(), 11); }
        var unlocked = Math.max(1, save.unlocked || 1), y0 = 250 - ((LEVELS.length - 1) * 60) / 2;
        LEVELS.forEach(function (L, i) { var open = i < unlocked, cy = y0 + i * 60; var card = scene.add.rectangle(800, cy, 280, 50, L.sky != null ? L.sky : 0x241a0c, 1).setStrokeStyle(2, open ? (TH.accent != null ? TH.accent : 0xffcc44) : 0x333, 1); if (open) { card.setInteractive({ useHandCursor: true }); card.on('pointerdown', function () { startGame(i); }); } else card.setAlpha(0.4); menuLayer.add(card); mtext(menuLayer, 800, cy, (open ? (i + 1) + '. ' : '🔒 ') + (L.name || 'GROUND ' + (i + 1)).toUpperCase(), 13); });
        mtext(menuLayer, 480, 498, '▶  CLICK A GROUND · OR PRESS SPACE', 14);
        var go = function () { if (mode === 'menu') startGame(Math.min(unlocked - 1, LEVELS.length - 1)); };
        scene.input.keyboard.once('keydown-SPACE', go); scene.input.keyboard.once('keydown-ENTER', go);
      }
      function startGame(i) { clearMenu(); mode = 'play'; won = false; deaths = 0; loadLevel(i); hud(); }
      function showCard(i, stats) { mode = 'card'; clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(600); menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x140d04, 0.7)); mtext(menuLayer, 480, 200, (spec().name || 'GROUND') + ' — TAKEN', 26); mtext(menuLayer, 480, 250, 'scrap ' + stats.score + '  ·  ' + (stats.timeMs / 1000).toFixed(1) + 's', 16); var go = function () { if (mode === 'card') startGame(i + 1); }; mtext(menuLayer, 480, 320, '▶  NEXT GROUND', 22, true).on('pointerdown', go); scene.input.keyboard.once('keydown-SPACE', go); scene.time.delayedCall(2600, go); }
      function showWin(st) { mode = 'win'; clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(600); menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x140d04, 0.78)); mtext(menuLayer, 480, 170, TH.toasts && TH.toasts.win || 'THE ROAD IS YOURS', 34); mtext(menuLayer, 480, 230, 'final scrap ' + st.score, 18); mtext(menuLayer, 480, 310, '↻  PLAY AGAIN', 22, true).on('pointerdown', function () { startGame(0); }); mtext(menuLayer, 480, 360, 'MENU', 15, true).on('pointerdown', function () { showMenu(); }); }
      function showLose() { mode = 'win'; clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(600); menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x1a0404, 0.8)); mtext(menuLayer, 480, 200, 'GARAGE DESTROYED', 30); mtext(menuLayer, 480, 280, '↻  RETRY', 22, true).on('pointerdown', function () { startGame(levelIndex); }); mtext(menuLayer, 480, 330, 'MENU', 15, true).on('pointerdown', function () { showMenu(); }); }

      var config = { type: Phaser.AUTO, backgroundColor: TH.cssBg || '#1a160f', seed: [cfg.seed || title], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H }, render: { preserveDrawingBuffer: true, pixelArt: false }, physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } }, scene: [Play] };
      var rp = new URLSearchParams(location.search).get('r'); if (rp === 'canvas') config.type = Phaser.CANVAS; else if (rp === 'webgl') config.type = Phaser.WEBGL;
      root.game = new Phaser.Game(config);
      return root.game;
    }
  };

  // ============================================================ Studio.Builder
  // The WORLD-BUILDER archetype (5th genre): an isometric-grid settlement game.
  // You spend auto-income resources (TIMBER + FOOD) to PLACE structures on a
  // glade grid; structures raise rates/pop-cap; rootlings join as the village
  // grows; each glade has a GOAL (population / stockpile / a landmark built).
  // No death state — the deterministic gate is WIN-BY-CONSTRUCTION: the level's
  // `plan` (the autopilot's build order) provably reaches the goal (lint checks
  // affordability + goal coverage; the browser gate replays it bit-identically).
  // Built on Studio.Iso (the projector) + Studio.UI (palette/cards/bars/tooltip).
  Studio.Builder = {
    boot: function (cfg) {
      var TH = cfg.theme || {}, LEVELS = cfg.levels || root.LEVELS || [];
      var title = cfg.title || 'Studio Builder', slug = cfg.slug || 'builder';
      var W = 960, H = 540, FONT = 'Georgia, "Times New Roman", serif';
      var GW = TH.gridW || 12, GH = TH.gridH || 7;
      var save = Studio.Save.load(slug);

      // STRUCTURES — the build vocabulary (theme-tunable via TH.structs overrides)
      var STRUCTS = Object.assign({
        hut:        { name: 'Hut',         cost: { timber: 18 },           gives: { popCap: 2 },      tip: 'Shelters 2 rootlings.' },
        lumbercamp: { name: 'Lumber Camp', cost: { timber: 24 },           gives: { timberRate: 1.6 },tip: '+1.6 timber/s.' },
        garden:     { name: 'Berry Garden',cost: { timber: 20 },           gives: { foodRate: 1.2 },  tip: '+1.2 food/s.' },
        well:       { name: 'Well',        cost: { timber: 14 },           gives: { foodRate: 0.6 },  tip: '+0.6 food/s.' },
        storehouse: { name: 'Storehouse',  cost: { timber: 30 },           gives: { popCap: 1, timberRate: 0.4 }, tip: '+1 shelter, +0.4 timber/s.' },
        campfire:   { name: 'Campfire',    cost: { timber: 10 },           gives: { popCap: 1 },      tip: 'A warm heart. +1 shelter.' },
        shrine:     { name: 'Sun Shrine',  cost: { timber: 60, food: 30 }, gives: {},                 tip: 'A landmark goal.' },
        hall:       { name: 'Great Oak Hall', cost: { timber: 90, food: 40 }, gives: { popCap: 4 },   tip: 'THE landmark. +4 shelter.' }
      }, TH.structs || {});

      var scene, mode = cfg.skipMenu ? 'play' : 'menu', menuLayer = null;
      var levelIndex = 0, clock = 0, frame = 0, won = false, allWon = false, levelStartFrame = 0;
      var res = { timber: 0, food: 0 }, rate = { timber: 0, food: 0 }, pop = 0, popCap = 0, popT = 0;
      var grid = [], placed = [], villagers = [], planIdx = 0, auto = false, bedOn = false;
      var selKey = null, ghost = null, cards = {}, barT = null, barF = null, barP = null, goalTx = null, tip = null, bgImg = null, gridG = null, rosterPanel = null;
      var spec = function () { return LEVELS[levelIndex] || {}; };
      var ISO = Studio.Iso.projector({ farY: TH.farY || 96, nearY: TH.nearY || 430, cx: 480, farHalf: TH.farHalf || 300, nearHalf: TH.nearHalf || 444, farScale: 0.8, nearScale: 1.06, depthSpan: 100 });
      function cellAt(gx, gy) { return ISO.at((gx / (GW - 1)) * 2 - 1, gy / (GH - 1)); }
      function inGrid(gx, gy) { return gx >= 0 && gx < GW && gy >= 0 && gy < GH; }
      function gridFromPointer(px, py) {
        // invert the projector: t from py, then lx from px at that depth
        var t = (py - ISO.at(0, 0).sy) / (ISO.at(0, 1).sy - ISO.at(0, 0).sy);
        var gy = Math.round(t * (GH - 1)); if (gy < 0) gy = 0; if (gy > GH - 1) gy = GH - 1;
        var row = gy / (GH - 1), p0 = ISO.at(-1, row), p1 = ISO.at(1, row);
        var lx = ((px - p0.sx) / Math.max(1, p1.sx - p0.sx)) * 2 - 1;
        var gx = Math.round(((lx + 1) / 2) * (GW - 1)); if (gx < 0) gx = 0; if (gx > GW - 1) gx = GW - 1;
        return { gx: gx, gy: gy };
      }

      function snapshot() {
        return {
          x: 0, y: 0, vx: 0, vy: 0, timber: Math.round(res.timber), food: Math.round(res.food),
          coins: Math.round(res.timber), pop: pop, popCap: popCap, built: placed.length,
          deaths: 0, dead: false, won: allWon, frame: frame, level: levelIndex, maxX: 0
        };
      }
      function goalText() {
        var g = spec().goal || {};
        if (g.pop) return 'Shelter ' + g.pop + ' rootlings  (' + pop + '/' + g.pop + ')';
        if (g.timber) return 'Stockpile ' + g.timber + ' timber  (' + Math.min(Math.round(res.timber), g.timber) + '/' + g.timber + ')';
        if (g.built) return 'Build the ' + (STRUCTS[g.built] ? STRUCTS[g.built].name : g.built) + (hasBuilt(g.built) ? '  ✓' : '');
        return '';
      }
      function goalMet() {
        var g = spec().goal || {};
        if (g.pop && pop < g.pop) return false;
        if (g.timber && res.timber < g.timber) return false;
        if (g.built && !hasBuilt(g.built)) return false;
        return !!(g.pop || g.timber || g.built);
      }
      function hasBuilt(key) { for (var i = 0; i < placed.length; i++) if (placed[i].key === key) return true; return false; }

      function loadLevel(i) {
        levelIndex = i; clock = 0; won = false; planIdx = 0; popT = 0;
        var s = spec();
        placed.forEach(function (p) { try { p.spr.destroy(); } catch (e) {} }); placed = [];
        villagers.forEach(function (v) { try { v.spr.destroy(); v.tag.destroy(); } catch (e) {} }); villagers = [];
        grid = []; for (var gx = 0; gx < GW; gx++) { grid[gx] = []; for (var gy = 0; gy < GH; gy++) grid[gx][gy] = null; }
        res.timber = s.start && s.start.timber != null ? s.start.timber : 30;
        res.food = s.start && s.start.food != null ? s.start.food : 10;
        rate.timber = s.income && s.income.timber != null ? s.income.timber : 1.2;
        rate.food = s.income && s.income.food != null ? s.income.food : 0.6;
        pop = s.startPop != null ? s.startPop : 2; popCap = pop;
        (s.decor || []).forEach(function (d) {
          var c = cellAt(d.g[0], d.g[1]);
          var tex = 'bld_' + d.kind;
          var spr = scene.add.image(c.sx, c.sy, scene.textures.exists(tex) ? tex : 'tile_ghost').setDepth(c.depth);
          spr.setScale((TH.decorH || 64) / Math.max(1, spr.height) * c.sc); spr.setOrigin(0.5, 0.86);
          if (inGrid(d.g[0], d.g[1])) grid[d.g[0]][d.g[1]] = { key: d.kind, decor: true };
          placed.push({ key: d.kind, gx: d.g[0], gy: d.g[1], spr: spr, decor: true });
        });
        for (var v = 0; v < pop; v++) addVillager(v);
        if (bgImg) bgImg.setTexture(scene.textures.exists('bg_' + i) ? 'bg_' + i : 'bg_0');
        levelStartFrame = frame;
        if (bedOn) Studio.Audio.switchMusic(Studio.levelMusic(TH, LEVELS, i), TH.music && TH.music.vol != null ? TH.music.vol : 0.5);
        toast((TH.toasts && TH.toasts.level || 'GLADE {i} · {name}').replace('{i}', i + 1).replace('{name}', s.name || ''));
        refreshHud(true);
      }

      function addVillager(idx) {
        var roster = TH.roster || [];
        var who = roster[idx % Math.max(1, roster.length)] || { key: 'char_fern', name: 'Rootling' };
        var c = cellAt(2 + (idx * 3) % (GW - 4), 2 + (idx * 2) % (GH - 3));
        var spr = scene.add.image(c.sx, c.sy, scene.textures.exists(who.key) ? who.key : 'tile_ghost').setDepth(c.depth + 1);
        spr.setScale((TH.charH || 40) / Math.max(1, spr.height) * c.sc); spr.setOrigin(0.5, 0.92);
        var tag = scene.add.text(c.sx, c.sy - 34, who.name, { fontFamily: FONT, fontSize: '9px', color: '#e8f4d8', stroke: '#10160c', strokeThickness: 3 }).setOrigin(0.5).setDepth(c.depth + 1).setAlpha(0.85);
        villagers.push({ spr: spr, tag: tag, i: idx, hx: c.sx, hy: c.sy });
        if (rosterPanel && rosterPanel.refresh) rosterPanel.refresh();
      }

      function canPlace(gx, gy) { return inGrid(gx, gy) && !grid[gx][gy]; }
      function afford(key) { var st = STRUCTS[key]; if (!st) return false; var c = st.cost || {}; return res.timber >= (c.timber || 0) && res.food >= (c.food || 0); }
      function place(key, gx, gy, silent) {
        var st = STRUCTS[key];
        if (!st || !canPlace(gx, gy) || !afford(key)) return false;
        res.timber -= (st.cost.timber || 0); res.food -= (st.cost.food || 0);
        var g = st.gives || {};
        if (g.timberRate) rate.timber += g.timberRate;
        if (g.foodRate) rate.food += g.foodRate;
        if (g.popCap) popCap += g.popCap;
        var c = cellAt(gx, gy), tex = 'bld_' + key;
        var spr = scene.add.image(c.sx, c.sy, scene.textures.exists(tex) ? tex : 'tile_ghost').setDepth(c.depth);
        spr.setScale((TH.structH || 74) / Math.max(1, spr.height) * c.sc); spr.setOrigin(0.5, 0.86);
        grid[gx][gy] = { key: key }; placed.push({ key: key, gx: gx, gy: gy, spr: spr });
        if (!silent) {
          Studio.Audio.sfx('coin');
          Studio.Juice.burst(scene, c.sx, c.sy - 14, { texture: 'spark', n: 12, tint: 0xffd166, life: 420, spMax: 130 });
          Studio.Juice.ring(scene, c.sx, c.sy - 8, { tint: 0xffe8a0, r: 30, life: 260 });
          scene.tweens.add({ targets: spr, scaleX: spr.scaleX * 1.12, scaleY: spr.scaleY * 0.9, yoyo: true, duration: 110 });
        }
        refreshHud();
        return true;
      }

      function tickWorld(dt) {
        res.timber += rate.timber * dt; res.food += rate.food * dt;
        // rootlings join while there is shelter + food surplus (deterministic)
        if (pop < popCap && rate.food >= (pop + 1) * 0.25) {
          popT += dt;
          if (popT >= (spec().popEvery || 4)) { popT = 0; pop++; addVillager(pop - 1); Studio.Audio.sfx('coin'); var cc = villagers[villagers.length - 1]; Studio.Juice.popText(scene, cc.hx, cc.hy - 40, '+1 rootling', { size: 12, color: '#ffe8a0' }); refreshHud(); }
        } else popT = 0;
        // wander (cosmetic, phase-deterministic)
        for (var i = 0; i < villagers.length; i++) {
          var v = villagers[i];
          v.spr.x = v.hx + Math.sin(clock * 0.6 + i * 1.7) * 18;
          v.spr.y = v.hy + Math.cos(clock * 0.45 + i * 2.3) * 6;
          v.spr.setFlipX(Math.cos(clock * 0.6 + i * 1.7) < 0);
          v.tag.setPosition(v.spr.x, v.spr.y - 34);
        }
        // AUTOPILOT: execute the level plan in order whenever affordable (the
        // win-by-construction strategy the lint proves out).
        if (auto && !won) {
          var plan = spec().plan || [];
          if (planIdx < plan.length) { var st = plan[planIdx]; if (afford(st.build) && canPlace(st.g[0], st.g[1])) { place(st.build, st.g[0], st.g[1], true); planIdx++; } }
        }
      }

      function refreshHud(instant) {
        if (!barT) return;
        if (instant) { barT._shown = res.timber; barF._shown = res.food; barP._shown = pop; }
        barT.set(Math.floor(res.timber)); barF.set(Math.floor(res.food)); barP.set(pop, '/' + popCap);
        if (goalTx) goalTx.setText('★ ' + goalText());
        for (var k in cards) cards[k].setAffordable(afford(k));
      }

      var Play = {
        key: 'Play',
        preload: function () {
          for (var i = 0; i < LEVELS.length; i++) if (TH.backdrops) this.load.image('bg_' + i, TH.backdrops.replace('{i}', i + 1));
          var imgs = TH.images || {}; for (var k in imgs) this.load.image(k, imgs[k]);
          if (TH.menu && TH.menu.logo) this.load.image('menu_logo', TH.menu.logo);
        },
        create: function () {
          scene = this;
          Studio.Textures.bake(this, 'spark', 10, 10, function (g) { g.fillStyle(0xffd166, 1).fillCircle(5, 5, 5); g.fillStyle(0xffffff, 1).fillCircle(5, 5, 2); });
          Studio.Textures.bake(this, 'tile_ghost', 40, 40, function (g) { g.fillStyle(0x6fae4e, 0.5).fillRoundedRect(2, 2, 36, 36, 6); });
          this.add.rectangle(W / 2, H / 2, W, H, TH.sky != null ? TH.sky : 0x16210f).setDepth(-100);
          bgImg = this.add.image(W / 2, H / 2, this.textures.exists('bg_0') ? 'bg_0' : 'spark').setDepth(-90);
          if (this.textures.exists('bg_0')) { var k0 = Math.max(W / bgImg.width, H / bgImg.height); bgImg.setScale(k0); } else bgImg.setVisible(false);
          // the buildable grid — subtle diamond outlines via the projector
          gridG = this.add.graphics().setDepth(1).setAlpha(0.35);
          for (var gx = 0; gx < GW; gx++) for (var gy = 0; gy < GH; gy++) {
            var c = cellAt(gx, gy);
            gridG.lineStyle(1, 0xeaf6d8, 0.16).strokeCircle(c.sx, c.sy, 3);
          }
          Studio.Juice.ambient(this, W, { texture: 'spark', y: -8, vyMin: 8, vyMax: 22, drift: 14, scale: 0.4, alpha: 0.25, frequency: 420, tint: 0xfff2b0, lifespan: 9000 });
          if (TH.vignette) Studio.Juice.vignette(this, TH.vignette);

          // ---------- THE UI (Studio.UI) ----------
          var uth = TH.ui || {};
          barT = Studio.UI.bar(this, 12, 46, { emoji: '🪵', label: 'timber', w: 124, theme: uth });
          barF = Studio.UI.bar(this, 144, 46, { emoji: '🫐', label: 'food', w: 118, theme: uth });
          barP = Studio.UI.bar(this, 270, 46, { emoji: '🌱', label: 'rootlings', w: 132, theme: uth });
          var gp = Studio.UI.panel(this, W / 2 - 170, 8, 340, 26, { theme: uth, alpha: 0.78, depth: 299 });
          goalTx = this.add.text(W / 2, 21, '', { fontFamily: FONT, fontSize: '13px', color: '#ffe8a0', stroke: '#10160c', strokeThickness: 3 }).setOrigin(0.5).setDepth(300);
          tip = Studio.UI.tooltip(this, { theme: uth });
          // the BUILD PALETTE
          var keys = (TH.palette || ['hut', 'lumbercamp', 'garden', 'well', 'storehouse', 'campfire', 'shrine', 'hall']);
          var pw = keys.length * 92 + 10;
          Studio.UI.panel(this, W / 2 - pw / 2, H - 112, pw, 106, { theme: uth, alpha: 0.7, depth: 298 });
          keys.forEach(function (k2, i2) {
            var st = STRUCTS[k2], cost = '🪵' + (st.cost.timber || 0) + (st.cost.food ? ' 🫐' + st.cost.food : '');
            cards[k2] = Studio.UI.card(scene, W / 2 - pw / 2 + 8 + i2 * 92, H - 106, {
              theme: uth, icon: 'bld_' + k2, label: st.name, cost: cost,
              onClick: function () { selectStruct(selKey === k2 ? null : k2); },
              onHover: function (on) { on ? tip.show(st.name + ' — ' + st.tip + '\n' + cost, scene.input.activePointer) : tip.hide(); }
            });
          });
          // ROSTER (the 20 rootlings) — a names-and-faces panel
          var rosterBtn = Studio.UI.button(this, W - 124, 56, 112, 30, '🌿 ROOTLINGS', { theme: uth, onClick: function () { toggleRoster(); } });
          buildRoster(uth);

          // placement ghost + input
          ghost = this.add.image(0, 0, 'tile_ghost').setDepth(250).setVisible(false).setAlpha(0.85);
          this.input.on('pointermove', function (p) {
            if (!selKey || mode !== 'play') { ghost.setVisible(false); return; }
            var g = gridFromPointer(p.x, p.y), c = cellAt(g.gx, g.gy);
            var tex = scene.textures.exists('bld_' + selKey) ? 'bld_' + selKey : 'tile_ghost';
            if (ghost.texture.key !== tex) ghost.setTexture(tex);
            ghost.setPosition(c.sx, c.sy).setVisible(p.y < H - 118 && p.y > 92);
            ghost.setScale((TH.structH || 74) / Math.max(1, ghost.height) * c.sc); ghost.setOrigin(0.5, 0.86);
            ghost.setTint(canPlace(g.gx, g.gy) && afford(selKey) ? 0xaaffaa : 0xff8888);
            ghost._g = g;
          });
          this.input.on('pointerdown', function (p) {
            if (mode !== 'play' || !selKey || p.y >= H - 118 || p.y <= 92) return;
            var g = ghost._g || gridFromPointer(p.x, p.y);
            if (place(selKey, g.gx, g.gy)) { if (!afford(selKey)) selectStruct(null); }
            else { barT.flash(true); Studio.Audio.sfx('hurt'); }
          });
          this.input.keyboard.on('keydown', function (e) {
            if (mode !== 'play') return;
            var n = parseInt(e.key, 10);
            if (n >= 1 && n <= keys.length) selectStruct(keys[n - 1]);
            else if (e.key === 'Escape') selectStruct(null);
            else if (e.key === 'r' || e.key === 'R') toggleRoster();
          });

          var startBed = function () { if (bedOn || !TH.music) return; bedOn = true; var a = Studio.Audio.music(Studio.levelMusic(TH, LEVELS, levelIndex) || TH.music.url, TH.music.vol != null ? TH.music.vol : 0.5); if (!a && TH.music.fallback) Studio.Audio.music(TH.music.fallback, 0.3); };
          this.input.once('pointerdown', startBed); if (this.input.keyboard) this.input.keyboard.once('keydown', startBed);

          Studio.Shell.create(this, {
            theme: TH.shell || null,
            links: (function () { var L = [{ label: '📖 DIARY', href: '/diary.html' }]; if (cfg.repo) { L.push({ label: '🐙 REPO', href: 'https://github.com/' + cfg.repo }); L.push({ label: '🐛 NOTES → ISSUES', href: 'https://github.com/' + cfg.repo + '/issues' }); } return L; })(),
            context: function () { var s = spec(); return { where: 'G' + (levelIndex + 1) + ' ' + (s.name || ''), level: levelIndex + 1, levelName: s.name || '', coins: Math.round(res.timber), deaths: 0, won: allWon, game: slug }; },
            onRestart: function () { startGame(0); }
          });
          Studio.harness.install(root.game, {
            snapshot: snapshot, setInput: function () {},
            autopilot: function (on) { auto = !!on; },
            reset: function () { clearMenu(); mode = 'play'; allWon = false; won = false; frame = 0; loadLevel(0); }
          });

          loadLevel(0);
          if (!cfg.skipMenu) showMenu();
        },
        update: function (time, delta) {
          if (!scene || mode !== 'play') return;
          frame++; var dt = Math.min((delta || (1000 / 60)) / 1000, 1 / 30); clock += dt;
          tickWorld(dt);
          if (frame % 12 === 0) refreshHud();
          if (!won && goalMet()) {
            won = true;
            Studio.Audio.sfx('win'); Studio.Juice.flash(scene, 220, 230, 255, 180);
            for (var fb = 0; fb < 3; fb++) (function (k) { scene.time.delayedCall(k * 140, function () { var c = cellAt(2 + k * 3, 2); Studio.Juice.burst(scene, c.sx, c.sy - 20, { texture: 'spark', n: 16, tint: 0xffe8a0, life: 600, spMax: 170 }); }); })(fb);
            if (levelIndex < LEVELS.length - 1) {
              var stats = { score: Math.round(res.timber), timeMs: Math.round(((frame - levelStartFrame) / 60) * 1000) };
              if (!auto) { save = Studio.Save.levelClear(slug, levelIndex, { coins: stats.score, timeMs: stats.timeMs }) || save; showCard(levelIndex, stats); }
              else { loadLevel(levelIndex + 1); }
            } else { allWon = true; if (!auto) showWin({ score: Math.round(res.timber) }); }
          }
        }
      };

      function toast(txt) { if (!txt || !scene || mode !== 'play') return; var t = scene.add.text(W / 2, 150, txt, { fontFamily: FONT, fontSize: '26px', color: '#e8f4d8', stroke: '#10160c', strokeThickness: 6 }).setOrigin(0.5).setDepth(520).setAlpha(0); scene.tweens.add({ targets: t, alpha: 1, y: 138, duration: 420, yoyo: true, hold: 1100, onComplete: function () { try { t.destroy(); } catch (e) {} } }); }
      function selectStruct(k) {
        selKey = k;
        for (var kk in cards) cards[kk].select(kk === k);
        if (!k && ghost) ghost.setVisible(false);
      }
      function buildRoster(uth) {
        var roster = TH.roster || [];
        var p = Studio.UI.panel(scene, W - 332, 92, 320, 392, { theme: uth, title: '🌿 The Rootlings of the Grove', depth: 400 });
        p.setVisible(false);
        var items = [];
        roster.forEach(function (r, i) {
          var col = i % 4, row = Math.floor(i / 4);
          var x = 16 + col * 76, y = 32 + row * 70;
          var ic = scene.textures.exists(r.key) ? scene.add.image(x + 28, y + 22, r.key) : scene.add.rectangle(x + 28, y + 22, 40, 40, 0x2a3a20);
          if (ic.setScale && ic.height) ic.setScale(Math.min(44 / ic.width, 44 / ic.height));
          var nm = scene.add.text(x + 28, y + 50, r.name, { fontFamily: FONT, fontSize: '9px', color: '#e8f4d8' }).setOrigin(0.5);
          p.add(ic); p.add(nm); items.push({ ic: ic, nm: nm, i: i });
        });
        p.refresh = function () { items.forEach(function (it) { var joined = it.i < pop; it.ic.setAlpha(joined ? 1 : 0.22); it.nm.setAlpha(joined ? 1 : 0.3); it.nm.setColor(joined ? '#ffe8a0' : '#e8f4d8'); }); };
        p.refresh();
        rosterPanel = p;
      }
      function toggleRoster() { if (rosterPanel) { rosterPanel.setVisible(!rosterPanel.visible); if (rosterPanel.visible) rosterPanel.refresh(); } }

      function clearMenu() { if (menuLayer) { try { menuLayer.destroy(true); } catch (e) {} menuLayer = null; } }
      function mtext(c, x, y, str, size, it) { var t = scene.add.text(x, y, str, { fontFamily: FONT, fontSize: size + 'px', color: '#e8f4d8', stroke: '#10160c', strokeThickness: Math.max(3, size / 7), align: 'center' }).setOrigin(0.5); if (it) { t.setInteractive({ useHandCursor: true }); t.on('pointerover', function () { t.setScale(1.07); }); t.on('pointerout', function () { t.setScale(1); }); } c.add(t); return t; }
      function showMenu() {
        mode = 'menu'; clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(600);
        if (scene.textures.exists('bg_0')) { var b = scene.add.image(W / 2, H / 2, 'bg_0'); b.setScale(Math.max(W / b.width, H / b.height)); menuLayer.add(b); } else menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, TH.sky != null ? TH.sky : 0x16210f));
        menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x0c1407, 0.55));
        var hk = (TH.roster && TH.roster[0] && scene.textures.exists(TH.roster[0].key)) ? TH.roster[0].key : null;
        if (hk) { var hs = scene.add.image(250, 320, hk); hs.setScale(170 / Math.max(1, hs.height)); scene.tweens.add({ targets: hs, y: 310, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); menuLayer.add(hs); }
        if (scene.textures.exists('menu_logo')) { var lg = scene.add.image(0, 0, 'menu_logo'); lg.setScale(Math.min(430 / lg.width, 150 / lg.height)); lg.setPosition(300, 40 + lg.displayHeight / 2); menuLayer.add(lg); if (cfg.tagline) mtext(menuLayer, 300, 56 + lg.displayHeight, cfg.tagline.toUpperCase(), 11); }
        else { mtext(menuLayer, 300, 80, title.toUpperCase(), 42); if (cfg.tagline) mtext(menuLayer, 300, 122, cfg.tagline.toUpperCase(), 11); }
        var unlocked = Math.max(1, save.unlocked || 1), y0 = 220 - 0;
        LEVELS.forEach(function (L, i) {
          var open = i < unlocked, cy = 150 + i * 62;
          var card = scene.add.rectangle(740, cy, 320, 52, 0x1c2616, 0.94).setStrokeStyle(2, open ? 0x6fae4e : 0x333a2c, 1);
          if (open) { card.setInteractive({ useHandCursor: true }); card.on('pointerdown', function () { startGame(i); }); } else card.setAlpha(0.4);
          menuLayer.add(card); mtext(menuLayer, 740, cy, (open ? (i + 1) + '. ' : '🔒 ') + (L.name || 'GLADE ' + (i + 1)).toUpperCase(), 13);
        });
        mtext(menuLayer, 480, 505, '▶  CLICK A GLADE · OR PRESS SPACE', 14);
        var go = function () { if (mode === 'menu') startGame(Math.min(unlocked - 1, LEVELS.length - 1)); };
        scene.input.keyboard.once('keydown-SPACE', go); scene.input.keyboard.once('keydown-ENTER', go);
      }
      function startGame(i) { clearMenu(); mode = 'play'; won = false; loadLevel(i); }
      function showCard(i, stats) { mode = 'card'; clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(600); menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x0c1407, 0.7)); mtext(menuLayer, 480, 200, (spec().name || 'GLADE') + ' — FLOURISHING', 26); mtext(menuLayer, 480, 250, 'timber ' + stats.score + '  ·  ' + (stats.timeMs / 1000).toFixed(1) + 's', 16); var go = function () { if (mode === 'card') startGame(i + 1); }; mtext(menuLayer, 480, 320, '▶  NEXT GLADE', 22, true).on('pointerdown', go); scene.input.keyboard.once('keydown-SPACE', go); scene.time.delayedCall(2600, go); }
      function showWin(st) { mode = 'win'; clearMenu(); menuLayer = scene.add.container(0, 0).setDepth(600); menuLayer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x0c1407, 0.78)); mtext(menuLayer, 480, 170, TH.toasts && TH.toasts.win || 'THE GROVE THRIVES', 34); mtext(menuLayer, 480, 230, 'final timber ' + st.score, 18); mtext(menuLayer, 480, 310, '↻  PLAY AGAIN', 22, true).on('pointerdown', function () { startGame(0); }); mtext(menuLayer, 480, 360, 'MENU', 15, true).on('pointerdown', function () { showMenu(); }); }

      var config = { type: Phaser.AUTO, backgroundColor: TH.cssBg || '#16210f', seed: [cfg.seed || title], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H }, render: { preserveDrawingBuffer: true, pixelArt: true }, physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } }, scene: [Play] };
      var rp = new URLSearchParams(location.search).get('r'); if (rp === 'canvas') config.type = Phaser.CANVAS; else if (rp === 'webgl') config.type = Phaser.WEBGL;
      root.game = new Phaser.Game(config);
      return root.game;
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
      // CONTRAPTIONS — each registers a beat tagged by its TYPE (so novelty/fatigue
      // + the dominant-verb feeling tag treat it as a first-class verb), weighted by
      // its registry weight (Studio.Contraptions[type].weight). A contraption sitting
      // near the ~84% arc peak therefore lifts that window's interest -> a better arc.
      (spec.contraptions || []).forEach(function (c) {
        var meta = (Studio.Contraptions && Studio.Contraptions.meta) ? Studio.Contraptions.meta(c.type) : null;
        var wgt = meta ? meta.weight : (INTEREST[c.type] || 7);
        b.push({ x: c.x, type: c.type, interest: wgt, feeling: meta ? meta.feeling : null, lens: meta ? meta.lens : null });
      });
      return b;
    }

    // VERTICAL beats: the climb axis replaces x. Every beat's position is its
    // climb progress in px (H - y: 0 at the bottom, H at the top), so the same
    // window/novelty/fatigue/arc math scores a tower exactly like a runner.
    function collectBeatsVertical(spec) {
      var H = spec.height || 2200, b = [];
      var pos = function (y) { return Math.max(0, Math.min(H, H - y)); };
      var cw = function (t, fb) { var m = (Studio.Contraptions && Studio.Contraptions.meta) ? Studio.Contraptions.meta(t) : null; return m ? m.weight : fb; };
      var prevMat = null;
      (spec.platforms || []).slice().sort(function (p, q) { return q.y - p.y; }).forEach(function (p) {
        var mat = p.mat || 'cloud';
        var m = (Studio.Materials && Studio.Materials.get) ? Studio.Materials.get(mat) : null;
        if (m && m.deadly) { b.push({ x: pos(p.y), type: 'gap', interest: INTEREST.gap }); return; } // storm shelf = the deadly beat
        b.push({ x: pos(p.y), type: 'ledge', interest: INTEREST.ledge });
        if (prevMat != null && mat !== prevMat) b.push({ x: pos(p.y), type: 'matchg', interest: INTEREST.matchg });
        prevMat = mat;
      });
      (spec.updrafts || []).forEach(function (u) { b.push({ x: pos((u.y0 + u.y1) / 2), type: 'updraft', interest: cw('updraft', 8) }); });
      (spec.gusts || []).forEach(function (g) { b.push({ x: pos(g.y), type: 'gust', interest: cw('gust', 7) }); });
      (spec.springs || []).forEach(function (s) { b.push({ x: pos(s.y != null ? s.y : H), type: 'spring', interest: INTEREST.spring }); });
      (spec.movers || []).forEach(function (m) { b.push({ x: pos(m.y), type: 'mover', interest: INTEREST.mover }); });
      (spec.enemies || []).forEach(function (e) { b.push({ x: pos(e.y != null ? e.y : H), type: 'walker', interest: INTEREST.walker }); });
      (spec.contraptions || []).forEach(function (c) { b.push({ x: pos(c.y || c.top || H), type: c.type, interest: cw(c.type, 7) }); });
      return b;
    }

    // predict the interest curve from placement alone (jazz novelty/fatigue/combo)
    // SHOOTER beats: waves placed along the TIME axis. Each wave's interest =
    // its enemy load (count × type weight) + a big peak for the boss wave, so the
    // arc naturally climaxes at the boss near the end.
    function collectBeatsShooter(spec) {
      var waves = spec.waves || [], total = waves.reduce(function (a, w) { return a + (w.dur || 6); }, 0) || 1, t = 0, b = [];
      var TW = { enemy_drone: 4, enemy_dart: 6, enemy_turret: 6 };
      waves.forEach(function (w) {
        var load = (w.formations || []).reduce(function (a, f) { return a + (f.count || 0) * (TW[f.tex] || 4) * 0.25; }, 0);
        b.push({ x: t, type: w.boss ? 'boss' : 'wave', interest: w.boss ? 9 : Math.max(3, Math.min(8, load)) });
        t += (w.dur || 6);
      });
      return { beats: b, span: total };
    }
    // RTS beats: the enemy SCHEDULE placed along the TIME axis (the designed
    // intensity curve), plus the opening sortie and a big climax beat for storming
    // the fortress after the schedule exhausts — so the arc peaks at the final push.
    // A flank (off the rally lane) reads as a sharper spike (the moment you must react).
    function collectBeatsRts(spec) {
      var sched = (spec.schedule || []), b = [], TW = { scout: 4, gunner: 6, brawler: 7, warlord: 10 };
      var lastT = sched.reduce(function (a, e) { return Math.max(a, e.t || 0); }, 0), span = lastT + 12;
      var rally = spec.rally != null ? spec.rally : 1;
      // RISING "battle heat" — the front-line melee never stops and intensifies as
      // both convoys pile up; this fills the gaps between spawns (no dead air) and
      // gives the level its climbing spine toward the fortress assault.
      for (var t = 0.5; t < span; t += 3) b.push({ x: t, type: 'skirmish', interest: 3.2 + 3.6 * (t / span) });
      // the designed SCHEDULE = the intensity spikes on top; stakes rise with time,
      // and a flank (off the rally lane) reads as a sharper spike (react NOW).
      sched.forEach(function (e) {
        var flank = (e.lane != null && e.lane !== rally), prog = (e.t || 0) / span;
        b.push({ x: e.t, type: e.type + (flank ? '_flank' : ''), interest: ((TW[e.type] || 5) + (flank ? 1.5 : 0)) * (0.7 + 0.5 * prog) });
      });
      b.push({ x: span * 0.88, type: 'assault', interest: 10 });                  // the climax: storming the fortress
      return { beats: b, span: span };
    }
    function predict(spec, opt) {
      opt = opt || {};
      var vertical = !!spec.vertical, shooter = !!spec.waves, rts = !!spec.schedule;
      if (shooter || rts) {
        var tl = shooter ? collectBeatsShooter(spec) : collectBeatsRts(spec); var W2 = tl.span;
        var n2 = shooter ? Math.max(6, Math.min(20, (spec.waves || []).length * 2)) : Math.max(8, Math.min(24, Math.round(W2 / 4)));
        var win2 = []; for (var k = 0; k < n2; k++) win2.push({ peak: 0, dom: null, count: 0, coins: 0 });
        tl.beats.forEach(function (bt) { var wi2 = Math.max(0, Math.min(n2 - 1, Math.floor((bt.x / W2) * n2))); var w = win2[wi2]; w.count++; if (bt.interest > w.peak) { w.peak = bt.interest; w.dom = bt.type; } });
        return finishPredict(win2, W2, n2);
      }
      var W = vertical ? (spec.height || 2200) : (spec.width || 960), T = spec.tile || 40;
      // ~6-tile windows, clamped to a sane count so short/long levels both behave
      var n = opt.nWin || Math.max(8, Math.min(40, Math.round(W / (6 * T))));
      var beats = vertical ? collectBeatsVertical(spec) : collectBeats(spec);
      var win = [], i;
      for (i = 0; i < n; i++) win.push({ peak: 0, dom: null, count: 0, coins: 0 });
      var wi = function (x) { return Math.max(0, Math.min(n - 1, Math.floor((x / W) * n))); };
      beats.forEach(function (bt) { var w = win[wi(bt.x)]; w.count++; if (bt.interest > w.peak) { w.peak = bt.interest; w.dom = bt.type; } });
      (spec.coins || []).forEach(function (c) { win[wi(vertical ? ((spec.height || 2200) - c.y) : c.x)].coins++; });
      return finishPredict(win, W, n);
    }
    // shared: windows -> interest curve (novelty/fatigue/combo), used by all archetypes
    function finishPredict(win, W, n) {
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
      },
      // PUBLIC: the contraption beats of a level, each tagged with its position
      // (px + normalized arc 0..1) and {feeling,lens,weight} — so docs/tools can
      // report "what feeling sits where" and whether a contraption hits the arc peak.
      contraptionBeats: function (spec) {
        if (!spec || !spec.contraptions) return [];
        var W = spec.width || 960;
        return spec.contraptions.map(function (c) {
          var meta = (Studio.Contraptions && Studio.Contraptions.meta) ? Studio.Contraptions.meta(c.type) : null;
          return {
            type: c.type, x: c.x, arcPos: +(c.x / W).toFixed(2),
            feeling: meta ? meta.feeling : null, lens: meta ? meta.lens : null,
            weight: meta ? meta.weight : null,
            nearPeak: Math.abs((c.x / W) - 0.84) <= 0.12     // does it lift the ~84% arc peak?
          };
        });
      }
    };
  })();

  root.Studio = Studio;
  if (typeof module !== 'undefined' && module.exports) module.exports = Studio;
})(typeof window !== 'undefined' ? window : globalThis);
