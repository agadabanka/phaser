/*
 * Contraption Playground — a standalone live test bench for Studio.Contraptions.
 *
 * It boots a small Phaser scene on the Studio SDK, builds a TINY test level via
 * Studio.Level (a flat themed slab + ONE chosen contraption), and runs it live —
 * world.tick(dt) is called every frame in the scene's update() so the contraption
 * visibly MOVES (the seesaw tilts, the launcher fires, the crumble collapses).
 *
 * A tiny scripted "tester" body walks back and forth across the slab so every
 * contraption gets a rider and shows its interaction (carry / launch / collapse).
 * Motion is deterministic-friendly (fixed dt clamp) but this is a sandbox, not a
 * gate — the point is to SEE and FEEL each machine.
 *
 * The HTML panel (index.html) drives the scene: a dropdown of
 * Studio.Contraptions.types, a Studio.Materials picker to theme the slab, a few
 * param inputs, and a readout of meta (feeling / lens / weight) + the live FUN
 * contribution = Studio.Feel.score(level WITHOUT) vs (level WITH the contraption).
 *
 * Load order (index.html): phaser.min.js -> studio.js -> this file.
 */
(function () {
  'use strict';

  var T = 40, GRAV = 1300;
  var W = 640, H = 400;                 // a compact stage (fits beside the panel)
  var GROUND_Y = 300;                   // floor line (top of the slab)
  var SLAB_X0 = 0, SLAB_X1 = W;         // the slab spans the whole stage width

  var scene = null, player = null, world = null, pc = null;
  var built = [];                       // colliders/overlaps + decor to tear down on rebuild
  var heroDir = 1;                      // tester walk direction
  var ready = false;

  // ---- current selection (kept in sync with the HTML controls) ----
  var sel = {
    type: null,                          // chosen contraption type
    mat: 'stone',                        // slab material (themes the slab + contraption)
    x: Math.round(W / 2),                // contraption x
    p1: null, p2: null                   // two type-relevant params (meaning depends on type)
  };

  // ----------------------------------------------------------------------------
  // PARAM SCHEMA — the two type-relevant inputs surfaced per contraption type.
  // (key -> the spec field, label, default, step). These map straight onto the
  // contraption spec passed to Studio.Level / Studio.Contraptions.build.
  // ----------------------------------------------------------------------------
  var PARAMS = {
    seesaw:   [ { key: 'tilt',   label: 'tilt (rad)',   def: 0.16, min: 0,  max: 0.5,  step: 0.01 },
                { key: 'period', label: 'period (s)',   def: 2.2,  min: 0.5, max: 6,   step: 0.1  } ],
    launcher: [ { key: 'vel',    label: 'launch vel',   def: 920,  min: 300, max: 1400, step: 20  },
                { key: 'period', label: 'cycle period', def: 1.4,  min: 0.4, max: 4,    step: 0.1 } ],
    crumble:  [ { key: 'delay',  label: 'collapse delay (frames)', def: 26, min: 6, max: 120, step: 1 },
                { key: 'w',      label: 'width (px)',   def: 3 * T, min: T, max: 6 * T, step: T   } ]
  };

  // ----------------------------------------------------------------------------
  // LEVEL SPEC — the tiny test level. WITHOUT vs WITH the contraption, so we can
  // diff Studio.Feel.score and surface the live FUN contribution. The slab spans
  // the stage; the contraption sits in the middle. We feed Studio.Feel a spec in
  // its native PIXEL coordinates (its width = our stage width).
  // ----------------------------------------------------------------------------
  function contraptionSpec() {
    var s = { type: sel.type, x: sel.x, mat: sel.mat, tile: T, groundY: GROUND_Y };
    var schema = PARAMS[sel.type] || [];
    if (schema[0]) s[schema[0].key] = sel.p1;
    if (schema[1]) s[schema[1].key] = sel.p2;
    return s;
  }

  function baseSpec() {
    // a flat themed slab with a spawn + goal — the minimal Studio.Level the Feel
    // model and the scene both understand.
    return {
      name: 'playground',
      width: W, height: H, tile: T, groundY: GROUND_Y,
      ground: [[SLAB_X0, SLAB_X1, sel.mat]],
      spawn: { x: 60, y: GROUND_Y - 80 },
      goal: W - 60
    };
  }

  function withSpec() {
    var spec = baseSpec();
    spec.contraptions = [contraptionSpec()];
    return spec;
  }

  // ----------------------------------------------------------------------------
  // FEEL DELTA — Studio.Feel.score the level WITHOUT vs WITH the contraption, and
  // surface the delta. This is exactly how the fun model "sees" a contraption: its
  // registry weight (Studio.Contraptions.meta(type).weight) becomes an interest
  // beat at its x (Studio.Feel.collectBeats), lifting the arc near that window.
  // ----------------------------------------------------------------------------
  function feelDelta() {
    var base = Studio.Feel.score(baseSpec());
    var withC = Studio.Feel.score(withSpec());
    var beats = Studio.Feel.contraptionBeats(withSpec());
    return { base: base, withC: withC, delta: +(withC.fun - base.fun).toFixed(1), beat: beats[0] || null };
  }

  // ----------------------------------------------------------------------------
  // SCENE — build (or rebuild) the live world from withSpec(), wiring colliders
  // generically (seesaw: no collider / crumble: solid / launcher: overlap), and
  // attaching themed FX hooks so the interaction is visible. Mirrors the SDK's
  // intended usage (see Ember's loadLevel) but trimmed to one contraption.
  // ----------------------------------------------------------------------------
  function teardown() {
    built.forEach(function (o) { try { (o.destroy ? o.destroy() : o.remove && o.remove()); } catch (e) {} });
    built = [];
    if (world) {
      ['platforms', 'hazards', 'coins', 'enemies', 'springs', 'moverGroup'].forEach(function (k) {
        try { world[k] && world[k].clear(true, true); } catch (e) {}
        try { world[k] && world[k].destroy(true); } catch (e) {}
      });
    }
    world = null;
  }

  function buildScene() {
    if (!scene) return;
    teardown();

    var spec = withSpec();
    world = Studio.Level.build(scene, spec);

    // theme the slab: the SDK already textures it with the material gradient; we
    // just keep it visible (no extra art needed) and give the floor line a subtle
    // edge so the contraptions read against it.
    world.platforms.getChildren().forEach(function (s) { s.setDepth(1); });
    world.hazards.getChildren().forEach(function (s) { s.setDepth(1); });

    // collider for the player against the slab (so the tester walks on it)
    built.push(scene.physics.add.collider(player, world.platforms));
    built.push(scene.physics.add.overlap(player, world.hazards, function () { resetPlayer(); }));

    // CONTRAPTIONS — wire generically (the per-frame interaction itself is driven
    // by world.contraptionsInteract in update; here we only add the right physics
    // binding per type + themed FX hooks so the effect is visible).
    world.contraptions.forEach(function (cx) {
      var s = cx.spr;
      built.push(s);
      (cx._extra || []).forEach(function (e) { built.push(e); });
      if (cx.type === 'crumble') {
        built.push(scene.physics.add.collider(player, s));
        s._onArm = function (sp) { sp.setTexture('cx_crumble_x'); Studio.Juice.shake(scene, 80, 0.005); };
        s._onFall = function (sp) {
          Studio.Juice.shake(scene, 120, 0.008);
          Studio.Juice.burst(scene, sp.x, sp.y, { texture: 'dot', n: 16, tint: 0x8a5a2b, life: 520, spMax: 180 });
        };
      } else if (cx.type === 'launcher') {
        s._onFire = function (sp) {
          Studio.Juice.squash(scene, player, 0.8, 1.25);
          Studio.Juice.burst(scene, sp.x, sp.y - 8, { texture: 'dot', n: 14, tint: 0xffd166, life: 460, spMax: 220 });
        };
      }
      // seesaw: NO collider — the player stands on the slab beneath the flush plank;
      // the tilting plank ART + the bounded downhill carry deliver the feeling.
      Studio.Juice.glow(s, 0xffd34d, 2);
    });

    resetPlayer();
  }

  function resetPlayer() {
    if (!player || !world) return;
    player.setVelocity(0, 0);
    player.setPosition(world.spawn.x, world.spawn.y);
    heroDir = 1;
    if (pc) pc.reset();
    if (world.resetContraptions) world.resetContraptions();
  }

  // a simple scripted driver: walk right, turn at the slab edges, hop occasionally
  // so the tester repeatedly crosses (and re-arms) the contraption. Not a gate —
  // just enough motion to exercise every machine on screen.
  function testerInput() {
    var x = player.x;
    if (x > SLAB_X1 - 70) heroDir = -1;
    else if (x < SLAB_X0 + 70) heroDir = 1;
    var onGround = player.body.blocked.down || player.body.touching.down;
    // hop when close to the contraption so launcher/crumble/seesaw all get a rider
    var nearCx = Math.abs(x - sel.x) < 90;
    var jump = onGround && nearCx && heroDir === 1;
    return { left: heroDir < 0, right: heroDir > 0, jump: jump, down: false };
  }

  function footFrictionUnder() {
    var px = player.x, py = player.body.bottom + 4;
    var kids = world.platforms.getChildren();
    for (var i = 0; i < kids.length; i++) {
      var s = kids[i], b = s && s.body; if (!b) continue;
      if (px >= b.left - 2 && px <= b.right + 2 && py >= b.top - 8 && py <= b.top + 14) {
        return Studio.Materials.get(s.mat || 'solid').friction;
      }
    }
    return 1;
  }

  var Play = {
    key: 'Play',
    create: function () {
      scene = this;
      // bake the procedural kit (hero/coin/contraption art) themed off the palette
      Studio.Textures.kit(this, { tile: T });
      // a soft dot for FX bursts (kit already bakes 'dot', but ensure it exists)
      if (!this.textures.exists('dot')) {
        Studio.Textures.bake(this, 'dot', 8, 8, function (g) { g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4); });
      }
      // a subtle sky so the stage isn't flat black
      Studio.Backdrop(this, { top: 0x1b2440, bottom: 0x0b1021, worldWidth: W });

      // the tester body (uses the baked hero sprite directly — visible here)
      player = this.physics.add.sprite(60, GROUND_Y - 80, 'hero').setDepth(6);
      pc = Studio.Platformer.create();
      player.setMaxVelocity(pc.tune.maxRun, pc.tune.maxFall);

      buildScene();

      // expose hooks for the verifier / debugging
      window.__ready = true;
      ready = true;
      window.__pg = {
        rebuild: buildScene,
        setSelection: setSelection,
        select: function () { return JSON.parse(JSON.stringify(sel)); },
        feel: feelDelta,
        meta: function () { return Studio.Contraptions.meta(sel.type); },
        contraptionState: function () {
          return (world.contraptions || []).map(function (c) {
            return { type: c.type, active: !!c.spr.active, state: c.state ? c.state() : null };
          });
        }
      };
    },
    update: function (time, delta) {
      if (!player || !world) return;
      var dt = Math.min((delta || (1000 / 60)) / 1000, 1 / 30);
      var onGround = player.body.blocked.down || player.body.touching.down;

      // advance the contraption (deterministic phase clock), then run the generic
      // interaction pass (launcher overlap -> launch, seesaw carry, crumble timer).
      world.tick(dt);
      world.contraptionsInteract(player, { dt: dt, pc: pc });

      var mv = testerInput();
      var ff = footFrictionUnder();
      pc.update(player, mv, { onGround: onGround, footFriction: ff, dt: dt });

      // fell off the world -> respawn (sandbox keeps running forever)
      if (player.y > H + 120) resetPlayer();
    }
  };

  // ----------------------------------------------------------------------------
  // BOOT — same Phaser.Game shape Ember uses (AUTO renderer, arcade physics with
  // a base gravity the Platformer layers onto). ?r=canvas|webgl forces a renderer
  // (the verifier loads default AUTO; canvas is the safe headless fallback).
  // ----------------------------------------------------------------------------
  function boot() {
    var config = {
      type: Phaser.AUTO, width: W, height: H, parent: 'stage',
      backgroundColor: '#0b1021',
      render: { preserveDrawingBuffer: true, pixelArt: true },
      physics: { default: 'arcade', arcade: { gravity: { y: GRAV }, debug: false } },
      scene: [Play]
    };
    var r = new URLSearchParams(location.search).get('r');
    if (r === 'canvas') config.type = Phaser.CANVAS; else if (r === 'webgl') config.type = Phaser.WEBGL;
    window.game = new Phaser.Game(config);
  }

  // ----------------------------------------------------------------------------
  // UI WIRING — populate the controls from the SDK registries, reflect changes
  // into `sel`, rebuild the scene, and refresh the readout. Kept dependency-free
  // (plain DOM) so the tool is self-contained.
  // ----------------------------------------------------------------------------
  function setSelection(next) {
    Object.assign(sel, next || {});
    buildScene();
    refreshReadout();
  }

  function el(id) { return document.getElementById(id); }

  function buildParamInputs() {
    var host = el('params');
    host.innerHTML = '';
    var schema = PARAMS[sel.type] || [];
    var row = document.createElement('div'); row.className = 'row';
    schema.forEach(function (p, i) {
      var box = document.createElement('div');
      var lab = document.createElement('label'); lab.textContent = p.label; lab.htmlFor = 'p' + i;
      var inp = document.createElement('input');
      inp.type = 'number'; inp.id = 'p' + i; inp.step = String(p.step);
      if (p.min != null) inp.min = String(p.min);
      if (p.max != null) inp.max = String(p.max);
      inp.value = String(i === 0 ? sel.p1 : sel.p2);
      inp.addEventListener('input', function () {
        var v = parseFloat(inp.value);
        if (isNaN(v)) return;
        if (i === 0) sel.p1 = v; else sel.p2 = v;
        buildScene();
        refreshReadout();
      });
      box.appendChild(lab); box.appendChild(inp); row.appendChild(box);
    });
    host.appendChild(row);
  }

  function applyTypeDefaults() {
    var schema = PARAMS[sel.type] || [];
    sel.p1 = schema[0] ? schema[0].def : null;
    sel.p2 = schema[1] ? schema[1].def : null;
  }

  function refreshReadout() {
    var meta = Studio.Contraptions.meta(sel.type) || { feeling: '', lens: '–', weight: '–' };
    // feeling tags (the human-readable emotional payload, e.g. "balance / tension / control")
    var fhost = el('feeling'); fhost.innerHTML = '';
    String(meta.feeling || '').split('/').forEach(function (f) {
      f = f.trim(); if (!f) return;
      var t = document.createElement('span'); t.className = 'feel-tag'; t.textContent = f; fhost.appendChild(t);
    });
    el('lens').textContent = meta.lens != null ? meta.lens : '–';
    el('weight').textContent = meta.weight != null ? meta.weight : '–';

    var fd = feelDelta();
    el('funBase').textContent = fd.base.fun.toFixed(1);
    el('funWith').textContent = fd.withC.fun.toFixed(1);
    var dEl = el('funDelta');
    var sign = fd.delta > 0 ? '+' : '';
    dEl.textContent = sign + fd.delta.toFixed(1) + ' fun';
    dEl.className = 'big ' + (fd.delta > 0 ? 'pos' : fd.delta < 0 ? 'neg' : '');
    var beat = fd.beat;
    el('arcHint').textContent = beat
      ? ('beat at x=' + beat.x + ' (arc ' + beat.arcPos + ')' + (beat.nearPeak ? ' — sits on the ~84% arc peak' : ''))
      : '';
  }

  function populateControls() {
    var typeSel = el('type');
    Studio.Contraptions.types.forEach(function (t) {
      var o = document.createElement('option'); o.value = t; o.textContent = t; typeSel.appendChild(o);
    });
    sel.type = Studio.Contraptions.types[0];
    typeSel.value = sel.type;
    applyTypeDefaults();
    typeSel.addEventListener('change', function () {
      sel.type = typeSel.value;
      applyTypeDefaults();
      buildParamInputs();
      buildScene();
      refreshReadout();
    });

    var matSel = el('mat');
    Object.keys(Studio.Materials.table).forEach(function (m) {
      var o = document.createElement('option'); o.value = m; o.textContent = m; matSel.appendChild(o);
    });
    matSel.value = sel.mat;
    matSel.addEventListener('change', function () {
      sel.mat = matSel.value;
      buildScene();
      refreshReadout();
    });

    buildParamInputs();
  }

  // wire UI once the DOM is ready, then boot Phaser
  function start() {
    populateControls();
    boot();
    // refresh the readout once the scene exists (boot is async via Phaser's create)
    var poll = setInterval(function () {
      if (ready) { clearInterval(poll); refreshReadout(); }
    }, 30);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
