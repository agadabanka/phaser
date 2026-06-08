/*
 * Sprite Studio — shared animation + VALIDATION core.
 *
 * Loaded BOTH in the browser (index.html, as a plain <script> -> window.SpriteCore)
 * AND in Node (check.mjs / gen.mjs, via require) so the studio UI, the headless
 * checker, and the generator all use ONE definition of "what a valid sheet is".
 * It is pure: no DOM, no Phaser, no fs. Pixel access differs per host, so callers
 * pass in PRE-EXTRACTED per-frame pixel stats and this module judges them.
 *
 * Two halves:
 *   1. anim model — the default sheet descriptor + frame-range helpers Phaser uses
 *      (start/end -> generateFrameNumbers), kept here so UI + checker can't drift.
 *   2. validateStructural() — the deterministic, offline half of validate():
 *        - frame count matches expected
 *        - every anim's frame range is in-bounds
 *        - NO fully-transparent (empty) frame
 *        - a real ALPHA channel is present (the magenta bg was keyed out): flag a
 *          frame that is fully OPAQUE (key never ran) or still has MAGENTA pixels
 *          (key leftover / wrong chroma)
 *      (cells being equal-size is structural too, but that's guaranteed by the
 *       frameWidth/frameHeight grid slicing itself — we assert the sheet divides
 *       evenly into the declared grid here.)
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;     // Node
  root.SpriteCore = mod;                                                          // browser
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // The bundled sample sheet's descriptor — also the DEFAULT a fresh studio opens
  // with. A "sheet" is { url, frameWidth, frameHeight, frameCount, anims:{name:{start,end,frameRate,repeat}} }.
  var SAMPLE_SHEET = {
    url: 'assets/sample-hero.png',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 15,
    anims: {
      idle: { start: 0,  end: 3,  frameRate: 6,  repeat: -1 },
      run:  { start: 4,  end: 11, frameRate: 17, repeat: -1 },   // jazz uses ~17 for a run cycle
      jump: { start: 12, end: 14, frameRate: 12, repeat: 0  }    // one-shot
    }
  };

  // Phaser pattern helper: a frame range -> the {start,end} generateFrameNumbers wants.
  function frameRange(anim) {
    return { start: anim.start, end: anim.end };
  }
  function animFrameCount(anim) {
    return anim.end - anim.start + 1;
  }

  // ----------------------------------------------------------------------------
  // STRUCTURAL VALIDATION
  //
  // `stats` is the host-extracted analysis:
  //   {
  //     sheetW, sheetH,                       // full sheet pixel dims
  //     frameWidth, frameHeight, frameCount,  // declared grid
  //     frames: [ { transparentRatio, opaqueRatio, magentaRatio, nonEmptyPixels } ... ]
  //   }
  // Ratios are 0..1 over that frame's pixels. `expected` = the sheet descriptor
  // we're validating against (its frameCount + anims).
  // ----------------------------------------------------------------------------
  var MAGENTA_FLAG = 0.005;          // >0.5% leftover magenta pixels => key failed/missed
  var FULLY_OPAQUE = 0.999;          // ~no transparent pixels => alpha/key never applied
  var EMPTY_FRAME  = 0.999;          // ~all transparent => a blank/missing frame

  function validateStructural(stats, expected) {
    var checks = [];
    var add = function (name, pass, detail) { checks.push({ name: name, pass: !!pass, detail: detail }); };

    var fw = stats.frameWidth, fh = stats.frameHeight;

    // 1. the sheet divides evenly into the declared grid (=> equal frame cells)
    var colsExact = stats.sheetW / fw, rowsExact = stats.sheetH / fh;
    var evenGrid = Number.isInteger(colsExact) && Number.isInteger(rowsExact);
    add('equal frame cells (sheet divides evenly into frameWidth x frameHeight)', evenGrid,
      stats.sheetW + 'x' + stats.sheetH + ' / ' + fw + 'x' + fh + ' = ' +
      (+colsExact.toFixed(3)) + ' x ' + (+rowsExact.toFixed(3)) + ' cells');

    // 2. frame count matches expected
    var gridCount = Math.floor(colsExact) * Math.floor(rowsExact);
    var countOK = stats.frameCount === expected.frameCount && gridCount >= expected.frameCount;
    add('frame count matches expected (' + expected.frameCount + ')', countOK,
      'declared=' + stats.frameCount + ', grid holds=' + gridCount + ', expected=' + expected.frameCount);

    // 3. every declared anim's frame range is in-bounds
    var animNames = Object.keys(expected.anims || {});
    var rangeBad = [];
    animNames.forEach(function (n) {
      var a = expected.anims[n];
      if (a.start < 0 || a.end >= expected.frameCount || a.end < a.start) {
        rangeBad.push(n + ' [' + a.start + '..' + a.end + ']');
      }
    });
    add('all anim frame ranges in-bounds (0..' + (expected.frameCount - 1) + ')', rangeBad.length === 0,
      rangeBad.length ? ('out of range: ' + rangeBad.join(', ')) : (animNames.join(', ') + ' OK'));

    // 4. no fully-transparent (empty) frame
    var empties = [];
    (stats.frames || []).forEach(function (f, i) { if (f.transparentRatio >= EMPTY_FRAME) empties.push(i); });
    add('no fully-transparent frames', empties.length === 0,
      empties.length ? ('empty frames: ' + empties.join(', ')) : 'all ' + stats.frames.length + ' frames have content');

    // 5. a real alpha channel is present (background was keyed) — flag a fully
    //    OPAQUE frame (key never ran -> a solid block, no transparent surround).
    var solid = [];
    (stats.frames || []).forEach(function (f, i) { if (f.opaqueRatio >= FULLY_OPAQUE) solid.push(i); });
    add('alpha channel present (no fully-opaque/un-keyed frame)', solid.length === 0,
      solid.length ? ('fully-opaque frames: ' + solid.join(', ') + ' (was the magenta keyed out?)')
                   : 'every frame has transparent surround');

    // 6. no leftover MAGENTA (the key field) bleeding through
    var magenta = [];
    (stats.frames || []).forEach(function (f, i) { if (f.magentaRatio >= MAGENTA_FLAG) magenta.push(i + ' (' + (f.magentaRatio * 100).toFixed(1) + '%)'); });
    add('no leftover magenta key pixels', magenta.length === 0,
      magenta.length ? ('magenta in frames: ' + magenta.join(', ')) : 'clean (no #f0f magenta)');

    var pass = checks.every(function (c) { return c.pass; });
    return { kind: 'structural', pass: pass, checks: checks };
  }

  // Classify a single pixel for the per-frame stats the validator consumes. Shared
  // so browser + Node bucket pixels IDENTICALLY. (Same magenta recipe as key.mjs.)
  //   returns one of: 'transparent' | 'magenta' | 'opaque' | 'content'
  function classifyPixel(r, g, b, a) {
    if (a < 16) return 'transparent';
    // magenta key field (tolerant, matches tools/art/key.mjs): R>120 && B>100 && G < min(R,B)-22
    if (r > 120 && b > 100 && g < Math.min(r, b) - 22) return 'magenta';
    if (a >= 250) return 'opaque';
    return 'content';
  }

  return {
    SAMPLE_SHEET: SAMPLE_SHEET,
    frameRange: frameRange,
    animFrameCount: animFrameCount,
    validateStructural: validateStructural,
    classifyPixel: classifyPixel,
    THRESHOLDS: { MAGENTA_FLAG: MAGENTA_FLAG, FULLY_OPAQUE: FULLY_OPAQUE, EMPTY_FRAME: EMPTY_FRAME }
  };
});
