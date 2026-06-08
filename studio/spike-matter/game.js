/*
 * SPIKE — Is Matter.js (Phaser 4) deterministic enough to be driven by the Studio
 * deterministic fixed-step stepper (game.loop.sleep() + game.step(t, 1000/60))?
 *
 * Determinism strategy (see notes inline):
 *   - matter config: customUpdate:true  -> Phaser does NOT bind world.update to the
 *     scene UPDATE event, so Matter is NEVER advanced off the wall clock. (The default
 *     Matter World.update is a Common.now()-driven Runner with frameDelta smoothing /
 *     timeBuffer accumulation = inherently non-deterministic.)
 *   - autoUpdate:false  -> belt & suspenders: even if update fired, it no-ops.
 *   - enableSleeping:false -> no sleep thresholds (sleeping can mask/branch motion).
 *   - explicit positionIterations / velocityIterations / constraintIterations.
 *   - We advance physics ONLY via scene.update(): world.step(FIXED_MS) with a fixed
 *     delta. Matter Engine.update(engine, fixedDelta) with fixed iterations and no
 *     Math.random in the solver is a pure function of state -> should be bit-identical.
 *   - NO Math.random / Date.now anywhere. All initial state is hard-coded.
 */
(function () {
  'use strict';

  var W = 960, H = 540;
  var FIXED_MS = 1000 / 60;            // the fixed delta the Studio stepper uses
  var scene = null, matterWorld = null;
  var bodies = [];                     // [{label, go}] in a STABLE, deterministic order

  // Maximum-determinism Matter engine config.
  var MATTER_CFG = {
    gravity: { x: 0, y: 1, scale: 0.001 },   // Matter's default gravity model
    setBounds: false,                        // no world-bounds walls (we make our own ground)
    enableSleeping: false,                   // sleeping can branch integration -> off
    positionIterations: 12,                  // explicit solver iteration counts (default 6)
    velocityIterations: 8,                   // (default 4)
    constraintIterations: 4,                 // (default 2) — matters for the see-saw/pendulum
    autoUpdate: false,                       // do NOT self-advance off wall clock
    customUpdate: true,                      // do NOT even bind world.update to scene UPDATE
    debug: false
  };

  var Play = {
    key: 'Play',
    create: function () {
      scene = this;
      matterWorld = this.matter.world;

      // Be extra explicit at runtime too (in case config keys differ across builds).
      matterWorld.autoUpdate = false;
      if (matterWorld.engine) {
        matterWorld.engine.positionIterations = MATTER_CFG.positionIterations;
        matterWorld.engine.velocityIterations = MATTER_CFG.velocityIterations;
        matterWorld.engine.constraintIterations = MATTER_CFG.constraintIterations;
        if (matterWorld.engine.enableSleeping !== undefined) matterWorld.engine.enableSleeping = false;
      }

      var M = this.matter;

      // ---- a STATIC ground ----
      var ground = M.add.rectangle(W / 2, H - 20, W, 40, { isStatic: true, label: 'ground', friction: 1, restitution: 0 });

      // ---- ~4 dynamic boxes stacked (slightly offset so they topple/settle predictably) ----
      var boxBodies = [];
      var bx = 300;
      for (var i = 0; i < 4; i++) {
        var off = (i % 2 === 0) ? -3 : 3;             // tiny fixed offset (NOT random) -> non-trivial settling
        var b = M.add.rectangle(bx + off, H - 60 - i * 44, 40, 40, {
          label: 'box' + i, restitution: 0.1, friction: 0.6, frictionAir: 0.01
        });
        boxBodies.push(b);
      }

      // ---- one box given a FIXED initial velocity (flies in, hits the stack) ----
      var flyer = M.add.rectangle(120, H - 80, 36, 36, {
        label: 'flyer', restitution: 0.2, friction: 0.5, frictionAir: 0.01
      });
      M.body.setVelocity(flyer, { x: 9, y: -2 });     // deterministic, hard-coded launch

      // ---- constraint contraption #1: a PLANK pinned at its centre = a see-saw ----
      // A long thin dynamic rectangle, pinned to the (static) world at its centre with
      // a stiff zero-length constraint so it can only rotate. A small weight box dropped
      // on one end makes it tip — exercising rotational + constraint dynamics.
      var plank = M.add.rectangle(680, H - 90, 240, 16, { label: 'plank', friction: 0.8, restitution: 0.1 });
      M.add.worldConstraint(plank, 0, 1, { pointA: { x: 680, y: H - 90 } }); // pin centre to world
      var weight = M.add.rectangle(600, H - 200, 30, 30, { label: 'weight', restitution: 0.1, friction: 0.6 });

      // ---- constraint contraption #2: a PENDULUM bob on a constraint ----
      // A bob hung from a fixed world anchor by a stiff constraint, released from the
      // side so it swings — exercises a long-running oscillating constraint (the kind
      // of thing most likely to drift if integration is not deterministic).
      var bob = M.add.circle(820, H - 200, 18, { label: 'bob', restitution: 0.4, friction: 0.3, frictionAir: 0.0 });
      M.add.worldConstraint(bob, 120, 0.9, { pointA: { x: 820, y: H - 320 } }); // anchor above; length 120

      // STABLE iteration order for the state snapshot. Order is fixed by construction,
      // never by object identity / hash, so __state() is comparable run-to-run.
      bodies = [
        { label: 'ground', body: ground },
        { label: 'box0', body: boxBodies[0] },
        { label: 'box1', body: boxBodies[1] },
        { label: 'box2', body: boxBodies[2] },
        { label: 'box3', body: boxBodies[3] },
        { label: 'flyer', body: flyer },
        { label: 'plank', body: plank },
        { label: 'weight', body: weight },
        { label: 'bob', body: bob }
      ];

      // simple visuals so headless WebGL has something non-black to read back
      this.cameras.main.setBackgroundColor('#101822');
      var g = this.add.graphics();
      this._drawBodies = function () {
        g.clear();
        for (var k = 0; k < bodies.length; k++) {
          var bd = bodies[k].body;
          var isStatic = bd.isStatic;
          g.lineStyle(2, 0x6ad1ff, 1);
          g.fillStyle(isStatic ? 0x394b59 : 0xffcf6a, 1);
          var verts = bd.vertices;
          g.beginPath();
          g.moveTo(verts[0].x, verts[0].y);
          for (var v = 1; v < verts.length; v++) g.lineTo(verts[v].x, verts[v].y);
          g.closePath();
          g.fillPath();
          g.strokePath();
        }
      };
      this._drawBodies();

      installHarness(window.game);
      window.__ready = true;
    },

    // The ONLY place physics advances. Driven by the Studio stepper via game.step():
    // a fixed delta, regardless of the wall-clock `delta` Phaser passes in.
    update: function (time, delta) {
      if (!matterWorld) return;
      matterWorld.step(FIXED_MS);   // == Matter Engine.update(engine, FIXED_MS) — deterministic
      // optionally skip drawing to isolate whether the render path perturbs physics
      if (this._drawBodies && !window.__nodraw) this._drawBodies();
    }
  };

  // ---------------------------------------------------------------- harness
  // window.__rec : the SAME deterministic stepper the Studio SDK uses
  //   begin(): game.loop.sleep(); t = 1000;
  //   step(n): t += 1000/60 each tick; game.step(t, 1000/60)
  // window.__state(): every body's x/y/angle, rounded to 3 decimals, in stable order.
  function installHarness(game) {
    window.__rec = {
      on: false, t: 0, dt: FIXED_MS,
      begin: function () { if (this.on) return; game.loop.sleep(); this.on = true; this.t = 1000; },
      step: function (n) { n = n || 1; for (var i = 0; i < n; i++) { this.t += this.dt; game.step(this.t, this.dt); } },
      end: function () { if (!this.on) return; this.on = false; game.loop.wake(); }
    };
    window.__state = function () {
      var r3 = function (x) { return Math.round(x * 1000) / 1000; };
      var out = [];
      for (var i = 0; i < bodies.length; i++) {
        var bd = bodies[i].body;
        out.push({ label: bodies[i].label, x: r3(bd.position.x), y: r3(bd.position.y), angle: r3(bd.angle) });
      }
      return out;
    };
    // FULL-PRECISION state (no rounding) — to tell a real physics drift apart from a
    // 3rd-decimal rounding-boundary flicker.
    window.__stateRaw = function () {
      var out = [];
      for (var i = 0; i < bodies.length; i++) {
        var bd = bodies[i].body;
        out.push({ label: bodies[i].label, x: bd.position.x, y: bd.position.y, angle: bd.angle });
      }
      return out;
    };
    // convenience: run N fixed steps from a fresh begin and return the final state
    window.__runState = function (n) { window.__rec.begin(); window.__rec.step(n); return window.__state(); };
  }

  var config = {
    type: Phaser.AUTO, width: W, height: H, backgroundColor: '#101822',
    render: { preserveDrawingBuffer: true },     // required for headless canvas readback
    physics: { default: 'matter', matter: MATTER_CFG },
    scene: [Play]
  };
  var r = new URLSearchParams(location.search).get('r');
  if (r === 'canvas') config.type = Phaser.CANVAS; else if (r === 'webgl') config.type = Phaser.WEBGL;

  window.game = new Phaser.Game(config);
})();
