/*
 * Sprite Studio — a standalone live bench to DEVELOP, ANIMATE and VALIDATE
 * character sprite animations (the animation analogue of the Contraption
 * Playground).
 *
 * It boots a small Phaser scene, loads a SPRITESHEET as a texture
 * (this.load.spritesheet(key, url, {frameWidth, frameHeight})), defines named
 * animations as frame ranges (this.anims.create({ key, frames:
 * generateFrameNumbers(key,{start,end}), frameRate, repeat })) and plays them on a
 * single big preview sprite. The HTML panel drives it: a sheet loader
 * (url + frameWidth/frameHeight + frame count), idle/run/jump buttons, per-anim
 * frame-range + fps + loop inputs, a frame SCRUBBER, and a live readout
 * (playing anim, current frame, fps, frame counts, cell size).
 *
 * The DEFAULT sheet is the bundled procedural sample (assets/sample-hero.png,
 * SpriteCore.SAMPLE_SHEET) so the tool is useful with zero generated art; if
 * ember's hero spritesheet is present it can be loaded by URL too.
 *
 * VALIDATION (the core ask) is window.validate(sheet): the STRUCTURAL half runs
 * in-browser here (extract per-frame pixel stats off the loaded texture, then
 * SpriteCore.validateStructural) and is surfaced in the UI; the MOTION/quality
 * half (Gemini contact-sheet read) is the same contact-sheet this builds, judged
 * by check.mjs/gemini-validate.mjs out of band (creds + network live in Node).
 *
 * Load order (index.html): phaser.min.js -> studio.js -> anim-core.js -> this.
 */
(function () {
  'use strict';

  var W = 560, H = 480;
  var TEX = 'sheet';                  // the Phaser texture key for the loaded sheet
  var ZOOM = 4;                       // preview magnification (sprite scale)

  var scene = null, sprite = null, ready = false;
  var loadSeq = 0;                    // bumped each (re)load so stale loader events are ignored
  var current = 'idle';               // anim currently selected
  var scrubbing = false;
  var scrubFrame = null;              // the SHEET frame the scrubber is parked on

  // the live sheet descriptor (mirrors SpriteCore.SAMPLE_SHEET shape). Deep-cloned
  // from the sample so edits never mutate the shared core constant.
  var sheet = JSON.parse(JSON.stringify(SpriteCore.SAMPLE_SHEET));

  function el(id) { return document.getElementById(id); }
  function animNames() { return Object.keys(sheet.anims); }

  // ----------------------------------------------------------------------------
  // ANIM (RE)BUILD — register every sheet anim with Phaser from its frame range.
  // This is the canonical Phaser pattern (generateFrameNumbers + anims.create),
  // re-run on every edit so the preview always reflects the current sheet.
  // ----------------------------------------------------------------------------
  function rebuildAnims() {
    if (!scene) return;
    animNames().forEach(function (name) {
      var a = sheet.anims[name];
      var key = 'anim_' + name;
      if (scene.anims.exists(key)) scene.anims.remove(key);
      scene.anims.create({
        key: key,
        frames: scene.anims.generateFrameNumbers(TEX, SpriteCore.frameRange(a)),
        frameRate: a.frameRate,
        repeat: a.repeat
      });
    });
  }

  function playAnim(name) {
    if (!scene || !sprite || !sheet.anims[name]) return;
    current = name;
    scrubbing = false;
    sprite.play({ key: 'anim_' + name, repeat: sheet.anims[name].repeat }, true);
    syncAnimButtons();
    syncRangeInputs();
    refreshScrubBounds();
    refreshReadout();
  }

  // ----------------------------------------------------------------------------
  // SHEET (RE)LOAD — dynamically load a NEW spritesheet texture at runtime. Phaser
  // can load mid-game via a fresh LoaderPlugin pass: remove the old texture, queue
  // the spritesheet with its frame dims, start the loader, and on 'complete'
  // rebuild anims + replay. Guarded by loadSeq so a slow/failed load can't clobber
  // a newer one.
  // ----------------------------------------------------------------------------
  function reloadSheet() {
    if (!scene) return;
    var seq = ++loadSeq;
    // DETACH the live sprite from the texture we're about to destroy: stop its anim
    // and park it on a tiny safe placeholder, so the render loop can't read a frame
    // out of a removed texture mid-swap (the 'resolution'/'sourceSize' null crash).
    if (sprite) {
      sprite.anims.stop();
      ensurePlaceholder();
      sprite.setTexture('ss_blank', 0);
    }
    // remove the old anims FIRST (they reference the old texture's frames), then it.
    animNames().forEach(function (name) { var k = 'anim_' + name; if (scene.anims.exists(k)) scene.anims.remove(k); });
    if (scene.textures.exists(TEX)) scene.textures.remove(TEX);

    scene.load.spritesheet(TEX, sheet.url, { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
    scene.load.once('complete', function () {
      if (seq !== loadSeq) return;                       // a newer load superseded this one
      // the real frame count Phaser sliced (grid cells); clamp the descriptor to it
      var tex = scene.textures.get(TEX);
      var sliced = tex.frameTotal - 1;                   // Phaser adds a '__BASE' frame
      if (sliced > 0) sheet.frameCount = sliced;
      clampAnimsToCount();
      rebuildAnims();
      if (!sprite) {
        sprite = scene.add.sprite(W / 2, H / 2 + 30, TEX).setScale(ZOOM);
      } else {
        sprite.setTexture(TEX, 0);
      }
      playAnim(sheet.anims[current] ? current : animNames()[0]);
      refreshReadout();
    });
    scene.load.once('loaderror', function (f) {
      if (seq !== loadSeq) return;
      console.error('sprite-studio: failed to load sheet "' + (f && f.key) + '" from ' + sheet.url);
    });
    scene.load.start();
  }

  // a 1x1 transparent placeholder the sprite parks on during a texture swap
  function ensurePlaceholder() {
    if (scene.textures.exists('ss_blank')) return;
    var g = scene.make.graphics({ add: false });
    g.fillStyle(0x000000, 0).fillRect(0, 0, 2, 2);
    g.generateTexture('ss_blank', 2, 2); g.destroy();
  }

  // keep every anim range inside the real frame count (so an edit/sheet swap can't
  // point an anim past the last frame -> a Phaser error).
  function clampAnimsToCount() {
    var max = sheet.frameCount - 1;
    animNames().forEach(function (name) {
      var a = sheet.anims[name];
      a.end = Math.min(a.end, max);
      a.start = Math.min(a.start, a.end);
    });
  }

  // ----------------------------------------------------------------------------
  // VALIDATION — window.validate(sheet). The STRUCTURAL half: read the loaded
  // texture's pixels, bucket each frame's pixels (transparent / opaque / magenta /
  // content) via SpriteCore.classifyPixel, then SpriteCore.validateStructural.
  // Returns { structural, motion, contactSheet } — motion is left for the headless
  // checker (Gemini needs creds + network), but we ALWAYS build the contact sheet
  // here so both paths judge the exact same composition.
  // ----------------------------------------------------------------------------
  function extractFrameStats(descriptor) {
    var d = descriptor || sheet;
    var src = scene.textures.get(TEX).getSourceImage();
    var sheetW = src.width, sheetH = src.height;
    var cols = Math.floor(sheetW / d.frameWidth);
    var c = document.createElement('canvas'); c.width = sheetW; c.height = sheetH;
    var ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0);

    var frames = [];
    for (var fi = 0; fi < d.frameCount; fi++) {
      var fx = (fi % cols) * d.frameWidth;
      var fy = Math.floor(fi / cols) * d.frameHeight;
      var img = ctx.getImageData(fx, fy, d.frameWidth, d.frameHeight).data;
      var tot = img.length / 4, transp = 0, opaque = 0, magenta = 0, content = 0;
      for (var p = 0; p < img.length; p += 4) {
        var cls = SpriteCore.classifyPixel(img[p], img[p + 1], img[p + 2], img[p + 3]);
        if (cls === 'transparent') transp++;
        else if (cls === 'magenta') { magenta++; content++; }
        else if (cls === 'opaque') { opaque++; content++; }
        else content++;
      }
      frames.push({
        transparentRatio: transp / tot,
        opaqueRatio: opaque / tot,
        magentaRatio: magenta / tot,
        nonEmptyPixels: content
      });
    }
    return { sheetW: sheetW, sheetH: sheetH, frameWidth: d.frameWidth, frameHeight: d.frameHeight, frameCount: d.frameCount, frames: frames };
  }

  // Compose all frames into a single CONTACT SHEET (a labeled grid) as a PNG data
  // URL — the artifact the Gemini motion read judges ("do these read as a smooth
  // <run|idle|jump> cycle of ONE on-model character?"). Rows are grouped per anim.
  // `only` (optional) = a single anim name -> a FOCUSED one-row sheet of just that
  // cycle (what the per-anim Gemini motion read judges); omit it for the full
  // all-anims overview shown/screenshot in the UI.
  function buildContactSheet(descriptor, only) {
    var d = descriptor || sheet;
    var src = scene.textures.get(TEX).getSourceImage();
    var cols = Math.floor(src.width / d.frameWidth);
    var fw = d.frameWidth, fh = d.frameHeight;
    var names = only && d.anims[only] ? [only] : animNames();
    var groups = names.map(function (n) { return { name: n, a: d.anims[n] }; });

    var cellW = fw + 8, cellH = fh + 20, pad = 8, labelW = 56;
    var maxLen = groups.reduce(function (m, g) { return Math.max(m, SpriteCore.animFrameCount(g.a)); }, 1);
    var cw = labelW + maxLen * cellW + pad * 2;
    var ch = pad + groups.length * cellH + pad;
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var x = c.getContext('2d');
    x.fillStyle = '#1b2030'; x.fillRect(0, 0, cw, ch);            // dark backing so transparent frames read
    x.font = '12px system-ui'; x.textBaseline = 'middle';

    groups.forEach(function (g, gi) {
      var y = pad + gi * cellH;
      x.fillStyle = '#ffd34d'; x.fillText(g.name, 6, y + fh / 2);
      var n = SpriteCore.animFrameCount(g.a);
      for (var k = 0; k < n; k++) {
        var fi = g.a.start + k;
        var fx = (fi % cols) * fw, fy = Math.floor(fi / cols) * fh;
        var dx = labelW + k * cellW, dy = y;
        x.strokeStyle = '#2a3556'; x.strokeRect(dx - 0.5, dy - 0.5, fw + 1, fh + 1);
        x.drawImage(src, fx, fy, fw, fh, dx, dy, fw, fh);
        x.fillStyle = '#6b769c'; x.fillText(String(fi), dx + 2, dy + fh + 8);
      }
    });
    return { dataUrl: c.toDataURL('image/png'), w: cw, h: ch };
  }

  // window.validate(sheet) — the surfaced API. Structural runs here & now; motion
  // is described (the checker performs the Gemini call). Pure data out.
  function validate(descriptor) {
    var d = descriptor || sheet;
    var stats = extractFrameStats(d);
    var structural = SpriteCore.validateStructural(stats, d);
    var contact = buildContactSheet(d);
    return {
      structural: structural,
      stats: stats,
      contactSheet: contact,
      motion: { available: false, note: 'motion/quality validation runs in check.mjs (Gemini needs creds + network); the contact sheet above is what it judges.' }
    };
  }

  // render the validate() result into the panel
  function renderVerdict(res) {
    var box = el('verdict'); box.classList.add('show');
    var s = res.structural;
    var badge = el('vbadge');
    badge.textContent = s.pass ? 'PASS' : 'FAIL';
    badge.className = 'vbadge ' + (s.pass ? 'pass' : 'fail');
    el('vscore').textContent = 'structural · ' + s.checks.filter(function (c) { return c.pass; }).length + '/' + s.checks.length + ' checks';
    var host = el('vchecks'); host.innerHTML = '';
    s.checks.forEach(function (c) {
      var row = document.createElement('div'); row.className = 'check ' + (c.pass ? 'ok' : 'no');
      row.innerHTML = '<span class="mark">' + (c.pass ? '✓' : '✗') + '</span>' + c.name +
        '<span class="detail">' + c.detail + '</span>';
      host.appendChild(row);
    });
    el('vnote').textContent = res.motion.note;
  }

  // ----------------------------------------------------------------------------
  // READOUT + SCRUBBER
  // ----------------------------------------------------------------------------
  // the SHEET frame number currently shown (the texture cell), whether the anim is
  // playing (Phaser's currentFrame.textureFrame is the numeric sheet index) or the
  // scrubber has parked it on a specific cell.
  function liveSheetFrame() {
    if (scrubbing && scrubFrame != null) return scrubFrame;
    var f = sprite && sprite.anims.currentFrame;
    return f ? f.textureFrame : null;
  }
  function refreshReadout() {
    if (!sprite) return;
    var a = sheet.anims[current] || {};
    var sf = liveSheetFrame();
    el('roAnim').textContent = current;
    el('roFrame').textContent = sf != null ? sf : '–';
    el('roFps').textContent = (a.frameRate != null ? a.frameRate : '–') + ' fps';
    el('roCount').textContent = (a.end != null ? SpriteCore.animFrameCount(a) : '–') + ' / ' + sheet.frameCount;
    el('roCell').textContent = sheet.frameWidth + ' × ' + sheet.frameHeight + ' px';
    el('frameVal').textContent = sf != null ? '(frame ' + sf + ')' : '';
  }

  function refreshScrubBounds() {
    var a = sheet.anims[current]; if (!a) return;
    var s = el('scrub');
    s.min = 0; s.max = String(SpriteCore.animFrameCount(a) - 1);
    s.value = '0';
  }

  // ----------------------------------------------------------------------------
  // SCENE
  // ----------------------------------------------------------------------------
  var Play = {
    key: 'Play',
    create: function () {
      scene = this;
      // a soft checkerboard backdrop so transparent sprite edges read clearly
      var bgKey = 'sscheck';
      if (!this.textures.exists(bgKey)) {
        var g = this.make.graphics({ add: false });
        g.fillStyle(0x10162b, 1).fillRect(0, 0, 32, 32);
        g.fillStyle(0x161d36, 1).fillRect(0, 0, 16, 16).fillRect(16, 16, 16, 16);
        g.generateTexture(bgKey, 32, 32); g.destroy();
      }
      this.add.tileSprite(W / 2, H / 2, W, H, bgKey).setAlpha(0.6);
      this.add.line(0, 0, 0, H / 2 + 30 + sheet.frameHeight * ZOOM / 2, W, H / 2 + 30 + sheet.frameHeight * ZOOM / 2, 0x2a3556).setOrigin(0).setLineWidth(1); // ground line

      reloadSheet();                                     // loads the bundled sample

      // expose hooks for the verifier / debugging
      window.validate = validate;
      window.__ready = true;
      ready = true;
      window.__ss = {
        play: playAnim,
        validate: validate,
        sheet: function () { return JSON.parse(JSON.stringify(sheet)); },
        setSheet: function (next) { Object.assign(sheet, next || {}); reflectSheetInputs(); reloadSheet(); },
        anims: animNames,
        // the live preview state, for the checker's per-anim assertions
        state: function () {
          var f = sprite && sprite.anims.currentFrame;
          return {
            anim: current,
            playing: !!(sprite && sprite.anims.isPlaying),
            frameIndex: f ? f.index : null,
            frameCount: sheet.anims[current] ? SpriteCore.animFrameCount(sheet.anims[current]) : null,
            frameRate: sheet.anims[current] ? sheet.anims[current].frameRate : null,
            sheetFrameCount: sheet.frameCount
          };
        },
        // hand the checker the contact sheet + frame stats it needs (no re-derive).
        // pass an anim name for a FOCUSED one-row sheet (per-anim Gemini read);
        // omit for the full all-anims overview.
        contactSheet: function (only) { return buildContactSheet(sheet, only); },
        frameStats: function () { return extractFrameStats(sheet); }
      };
    },
    update: function () {
      if (scrubbing || !sprite) return;
      refreshReadout();                                  // live frame readout while playing
    }
  };

  function boot() {
    var config = {
      type: Phaser.AUTO, width: W, height: H, parent: 'stage',
      backgroundColor: '#0b1021',
      render: { preserveDrawingBuffer: true, pixelArt: true },
      scene: [Play]
    };
    var r = new URLSearchParams(location.search).get('r');
    if (r === 'canvas') config.type = Phaser.CANVAS; else if (r === 'webgl') config.type = Phaser.WEBGL;
    window.game = new Phaser.Game(config);
  }

  // ----------------------------------------------------------------------------
  // UI WIRING (plain DOM, dependency-free)
  // ----------------------------------------------------------------------------
  function reflectSheetInputs() {
    el('sheetUrl').value = sheet.url;
    el('fw').value = sheet.frameWidth;
    el('fh').value = sheet.frameHeight;
    el('fc').value = sheet.frameCount;
  }

  function buildAnimButtons() {
    var host = el('animBtns'); host.innerHTML = '';
    animNames().forEach(function (name) {
      var b = document.createElement('button');
      b.textContent = name; b.dataset.anim = name;
      b.addEventListener('click', function () { playAnim(name); });
      host.appendChild(b);
    });
  }
  function syncAnimButtons() {
    Array.prototype.forEach.call(el('animBtns').children, function (b) {
      b.classList.toggle('active', b.dataset.anim === current);
    });
  }

  function syncRangeInputs() {
    var a = sheet.anims[current]; if (!a) return;
    el('frStart').value = a.start;
    el('frEnd').value = a.end;
    el('frRate').value = a.frameRate;
    el('frLoop').value = String(a.repeat);
  }

  // editing a range/fps/loop input rebuilds that anim and replays it live
  function wireRangeInputs() {
    var apply = function () {
      var a = sheet.anims[current]; if (!a) return;
      var st = parseInt(el('frStart').value, 10), en = parseInt(el('frEnd').value, 10),
          fr = parseInt(el('frRate').value, 10), lp = parseInt(el('frLoop').value, 10);
      if (!isNaN(st)) a.start = Math.max(0, Math.min(st, sheet.frameCount - 1));
      if (!isNaN(en)) a.end = Math.max(a.start, Math.min(en, sheet.frameCount - 1));
      if (!isNaN(fr)) a.frameRate = Math.max(1, fr);
      if (!isNaN(lp)) a.repeat = lp;
      rebuildAnims();
      playAnim(current);
    };
    ['frStart', 'frEnd', 'frRate', 'frLoop'].forEach(function (id) { el(id).addEventListener('change', apply); });
  }

  function wireScrubber() {
    var s = el('scrub');
    s.addEventListener('input', function () {
      if (!sprite) return;
      scrubbing = true;
      sprite.anims.pause();                              // freeze the anim
      var a = sheet.anims[current];
      scrubFrame = a.start + parseInt(s.value, 10);      // the SHEET frame to show
      sprite.setFrame(scrubFrame);                       // park the sprite on that texture cell
      refreshReadout();
    });
    // releasing resumes the anim from the top
    s.addEventListener('change', function () { if (scrubbing) playAnim(current); });
  }

  function wireLoad() {
    el('loadBtn').addEventListener('click', function () {
      sheet.url = el('sheetUrl').value.trim() || sheet.url;
      var fw = parseInt(el('fw').value, 10), fh = parseInt(el('fh').value, 10), fc = parseInt(el('fc').value, 10);
      if (!isNaN(fw) && fw > 0) sheet.frameWidth = fw;
      if (!isNaN(fh) && fh > 0) sheet.frameHeight = fh;
      if (!isNaN(fc) && fc > 0) sheet.frameCount = fc;
      reloadSheet();
    });
  }

  function wireValidate() {
    el('validateBtn').addEventListener('click', function () {
      try { renderVerdict(validate(sheet)); }
      catch (e) { console.error('validate failed:', e); }
    });
  }

  function start() {
    reflectSheetInputs();
    buildAnimButtons();
    syncAnimButtons();
    syncRangeInputs();
    wireRangeInputs();
    wireScrubber();
    wireLoad();
    wireValidate();
    boot();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
