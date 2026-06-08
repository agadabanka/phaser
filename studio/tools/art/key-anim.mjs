// Chroma-key + slice Ember's hero animation sources into ONE uniform spritesheet.
//
// Gemini emits the 6-frame RUN as a single strip on flat magenta, but the frames
// are UNEVENLY spaced and each running pose has a different bounding box. A naive
// even-N split would chop legs/arms. So we:
//   1. chroma-key the magenta (same recipe as key.mjs: bg if R>120 && B>100 && G<min(R,B)-22),
//   2. find connected non-transparent regions and group them into the 6 run frames
//      by their X centroids (column clustering — robust to uneven gaps),
//   3. compute a UNIFORM cell size big enough for the largest frame box,
//   4. re-pack every frame CENTERED (x) / BOTTOM-anchored (y, so feet line up) into
//      equal cells, then append the idle + jump single frames into the same grid.
// Result: hero_sheet.png — N equal cells, so Phaser generateFrameNumbers just works.
//
// Output layout (one row): [run0 run1 run2 run3 run4 run5 idle jump]
// Prints frameWidth/frameHeight + the index ranges to wire into game.js.
//
//   node key-anim.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const EMBER = new URL('../../games/ember/', import.meta.url);
const ART = new URL('art-src/', EMBER);
const RUN = 'hero_run.jpg';            // 6-frame strip
const IDLE = 'hero_idle.jpg';
const JUMP = 'hero_jump.jpg';
const OUT = 'src/assets/hero_sheet.png';
const RUN_FRAMES = 6;

const dataUrlOf = (name) => {
  const buf = readFileSync(new URL(name, ART));
  const mime = name.endsWith('png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

const result = await page.evaluate(async ({ runUrl, idleUrl, jumpUrl, RUN_FRAMES }) => {
  // ---- shared helpers (run in the page so we have a real canvas/getImageData) ----
  const isBg = (r, g, b) => (r > 120 && b > 100 && g < Math.min(r, b) - 22);

  async function load(url) {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, c.width, c.height);
    return { c, ctx, id, w: c.width, h: c.height };
  }

  // Per-column "ink" profile (count of foreground px) → split a strip into N frames.
  // We find the N widest contiguous ink bands (separated by empty magenta columns),
  // then return each band's tight box. Robust to uneven gaps + size differences.
  function frameBoxes(id, w, h, n) {
    const d = id.data;
    const colInk = new Array(w).fill(0);
    const rowMin = new Array(w).fill(h), rowMax = new Array(w).fill(-1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        if (!isBg(d[p], d[p + 1], d[p + 2])) { colInk[x]++; if (y < rowMin[x]) rowMin[x] = y; if (y > rowMax[x]) rowMax[x] = y; }
      }
    }
    // threshold: a column is "filled" if it has more than a tiny amount of ink
    const maxCol = Math.max(...colInk);
    const thr = Math.max(2, maxCol * 0.04);
    // contiguous runs of filled columns = candidate frames; merge across short gaps
    const GAP = Math.round(w * 0.012);              // bridge <~1.2% magenta gaps inside a body
    let bands = [], cur = null, gap = 0;
    for (let x = 0; x < w; x++) {
      if (colInk[x] > thr) { if (!cur) cur = { x0: x, x1: x }; else cur.x1 = x; gap = 0; }
      else if (cur) { gap++; if (gap > GAP) { bands.push(cur); cur = null; } }
    }
    if (cur) bands.push(cur);
    // keep the N widest bands (drops specks), restore left-to-right order
    bands.sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0));
    bands = bands.slice(0, n).sort((a, b) => a.x0 - b.x0);
    // tight vertical box per band
    return bands.map((bd) => {
      let y0 = h, y1 = -1;
      for (let x = bd.x0; x <= bd.x1; x++) { if (rowMin[x] < y0) y0 = rowMin[x]; if (rowMax[x] > y1) y1 = rowMax[x]; }
      return { x0: bd.x0, y0, x1: bd.x1, y1, w: bd.x1 - bd.x0 + 1, h: y1 - y0 + 1 };
    });
  }

  // tight box of a whole single-character image (idle/jump)
  function wholeBox(id, w, h) {
    const d = id.data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      if (!isBg(d[p], d[p + 1], d[p + 2])) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // make a transparent canvas of just one box (magenta keyed out)
  function cutTransparent(src, box) {
    const c = document.createElement('canvas'); c.width = box.w; c.height = box.h;
    const ctx = c.getContext('2d'); ctx.drawImage(src.c, box.x0, box.y0, box.w, box.h, 0, 0, box.w, box.h);
    const id = ctx.getImageData(0, 0, box.w, box.h), d = id.data;
    for (let p = 0; p < d.length; p += 4) if (isBg(d[p], d[p + 1], d[p + 2])) d[p + 3] = 0;
    ctx.putImageData(id, 0, 0);
    return c;
  }

  // ---- collect every frame's transparent cutout + its box ----
  const runImg = await load(runUrl);
  const runBoxes = frameBoxes(runImg.id, runImg.w, runImg.h, RUN_FRAMES);
  const cells = runBoxes.map((b) => ({ canvas: cutTransparent(runImg, b), w: b.w, h: b.h, kind: 'run' }));

  for (const [url, kind] of [[idleUrl, 'idle'], [jumpUrl, 'jump']]) {
    const im = await load(url); const b = wholeBox(im.id, im.w, im.h);
    cells.push({ canvas: cutTransparent(im, b), w: b.w, h: b.h, kind });
  }

  // ---- NORMALIZE SIZE across poses ----
  // Gemini rendered the run-strip characters smaller than the 1:1 idle/jump, so the
  // raw boxes differ a lot in scale. If we packed them as-is the hero would POP
  // bigger when idle/jump play. Pick the run cycle's MEDIAN height as the canonical
  // character height and scale EVERY frame to it (uniform scale, preserve aspect),
  // so idle/run/jump all read at one consistent size.
  const runHeights = cells.filter((c) => c.kind === 'run').map((c) => c.h).sort((a, b) => a - b);
  const targetH = runHeights[Math.floor(runHeights.length / 2)] || cells[0].h;
  cells.forEach((c) => {
    const s = targetH / c.h;
    c.sw = Math.max(1, Math.round(c.w * s));
    c.sh = Math.max(1, Math.round(c.h * s));
  });

  // ---- uniform cell size = max SCALED box + padding, then re-pack ----
  const PAD = 12;
  let cw = 0, ch = 0;
  for (const c of cells) { if (c.sw > cw) cw = c.sw; if (c.sh > ch) ch = c.sh; }
  cw += PAD * 2; ch += PAD * 2;
  // even cell dims (clean for pixelArt scaling)
  cw += cw % 2; ch += ch % 2;

  const sheet = document.createElement('canvas');
  sheet.width = cw * cells.length; sheet.height = ch;
  const sctx = sheet.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  cells.forEach((c, i) => {
    const dx = i * cw + Math.round((cw - c.sw) / 2);     // center horizontally
    const dy = ch - PAD - c.sh;                          // bottom-anchor (feet on a common baseline)
    sctx.drawImage(c.canvas, 0, 0, c.w, c.h, dx, dy, c.sw, c.sh);
  });

  return {
    dataUrl: sheet.toDataURL('image/png'),
    frameWidth: cw, frameHeight: ch, count: cells.length,
    runBoxes, kinds: cells.map((c) => c.kind),
  };
}, { runUrl: dataUrlOf(RUN), idleUrl: dataUrlOf(IDLE), jumpUrl: dataUrlOf(JUMP), RUN_FRAMES });

await browser.close();

mkdirSync(new URL(OUT.split('/').slice(0, -1).join('/') + '/', EMBER), { recursive: true });
writeFileSync(new URL(OUT, EMBER), Buffer.from(result.dataUrl.split(',')[1], 'base64'));

const runIdx = result.kinds.map((k, i) => k === 'run' ? i : -1).filter((i) => i >= 0);
const idleIdx = result.kinds.indexOf('idle');
const jumpIdx = result.kinds.indexOf('jump');
console.log('wrote', OUT);
console.log('frameWidth:', result.frameWidth, 'frameHeight:', result.frameHeight, 'frames:', result.count);
console.log('run[]:', `${runIdx[0]}..${runIdx[runIdx.length - 1]}`, '  idle:', idleIdx, '  jump:', jumpIdx);
console.log('detected run frame boxes (uneven → repacked):');
result.runBoxes.forEach((b, i) => console.log(`  run${i}: x[${b.x0}-${b.x1}] w=${b.w} h=${b.h}`));
