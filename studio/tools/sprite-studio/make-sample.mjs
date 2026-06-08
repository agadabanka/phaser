/*
 * Bake the BUNDLED sample spritesheet (assets/sample-hero.png) used as the
 * Sprite Studio's default sheet when no real spritesheet is supplied.
 *
 * We draw a tiny on-model character — a round "Spark" elemental (one consistent
 * silhouette + palette across every frame) — procedurally on a Canvas2D via
 * headless Chromium (the same no-native-deps trick key.mjs uses), and write a
 * uniform PNG grid. This keeps the tool standalone: it ships with a VALID sheet
 * (equal cells, real per-frame motion, a true alpha channel) so develop ->
 * animate -> validate works offline with zero generated art.
 *
 * Layout (uniform 64x64 cells, single horizontal strip, 15 frames):
 *   idle : 0..3   (4 frames — gentle bob + blink)
 *   run  : 4..11  (8 frames — leg/arm cycle + body lean)
 *   jump : 12..14 (3 frames — crouch / launch / tuck)
 *
 * Deterministic (no randomness) so the bundled asset is stable in git.
 *
 * usage: node make-sample.mjs           (writes assets/sample-hero.png)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'assets');
mkdirSync(OUT, { recursive: true });

const FW = 64, FH = 64, COLS = 15;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

const dataUrl = await page.evaluate(({ FW, FH, COLS }) => {
  const c = document.createElement('canvas');
  c.width = FW * COLS; c.height = FH;
  const x = c.getContext('2d');
  // leave the sheet fully TRANSPARENT outside the character (real alpha channel).

  // palette — one consistent character identity across all frames
  const BODY = '#ff7a1a', BODY_D = '#c8530a', CORE = '#ffe08a', EYE = '#2a1206';
  const FOOT = '#7a2e06';

  // draw ONE frame into cell `i`, with a pose described by params.
  // cx,cy = body center within the cell; bob = vertical bob; lean = body skew;
  // legPhase drives the run leg swing; arm tuck; eyeOpen for blink.
  function frame(i, p) {
    const ox = i * FW;
    x.save();
    x.translate(ox, 0);
    const cx = FW / 2 + (p.dx || 0), cy = FH / 2 + (p.bob || 0);
    const r = 17;

    // shadow on the ground (anchors the character; fades when airborne)
    x.fillStyle = 'rgba(0,0,0,0.18)';
    x.beginPath();
    x.ellipse(FW / 2, FH - 7, 13 * (p.shadow ?? 1), 4 * (p.shadow ?? 1), 0, 0, 7);
    x.fill();

    // legs (two stubby feet, swung in opposition for the run)
    const lp = p.legPhase || 0;
    const footY = cy + r - 2;
    const drawFoot = (sx, swing) => {
      x.fillStyle = FOOT;
      x.beginPath();
      x.ellipse(cx + sx, footY + Math.max(0, -swing) * 4, 6, 4 + Math.max(0, swing) * 3, 0, 0, 7);
      x.fill();
    };
    drawFoot(-7, Math.sin(lp));
    drawFoot(7, Math.sin(lp + Math.PI));

    // body (round elemental, slight lean)
    x.save();
    x.translate(cx, cy);
    x.rotate((p.lean || 0));
    x.fillStyle = BODY;
    x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
    x.fillStyle = BODY_D;                                   // lower-body shade
    x.beginPath(); x.arc(0, 5, r, 0.15 * Math.PI, 0.85 * Math.PI); x.fill();
    // glowing core (the "ember")
    x.fillStyle = CORE;
    x.beginPath(); x.arc(0, 1, 7 - (p.coreShrink || 0), 0, 7); x.fill();
    // little arms (tuck up in jump)
    x.fillStyle = BODY;
    const armUp = p.armUp || 0;
    x.beginPath(); x.ellipse(-r + 2, 2 - armUp, 5, 7, -0.3, 0, 7); x.fill();
    x.beginPath(); x.ellipse(r - 2, 2 - armUp, 5, 7, 0.3, 0, 7); x.fill();
    x.restore();

    // eyes (face RIGHT; blink closes them to a line)
    const eo = p.eyeOpen ?? 1;
    x.fillStyle = EYE;
    if (eo > 0.2) {
      x.beginPath(); x.ellipse(cx + 3, cy - 4, 2.4, 3.2 * eo, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(cx + 11, cy - 4, 2.4, 3.2 * eo, 0, 0, 7); x.fill();
    } else {
      x.fillRect(cx + 1, cy - 4, 5, 1.4); x.fillRect(cx + 9, cy - 4, 5, 1.4);
    }
    x.restore();
  }

  // ---- idle 0..3: gentle bob + a blink on frame 2 ----
  const idleBob = [0, -1.5, 0, -1.5];
  for (let f = 0; f < 4; f++) frame(f, { bob: idleBob[f], eyeOpen: f === 2 ? 0 : 1, legPhase: 0 });

  // ---- run 4..11: 8-frame leg cycle, body bob + forward lean, arm swing ----
  for (let f = 0; f < 8; f++) {
    const ph = (f / 8) * Math.PI * 2;
    frame(4 + f, {
      legPhase: ph,
      bob: -Math.abs(Math.sin(ph)) * 2.5,          // up on each stride
      lean: 0.12,                                   // forward run lean
      dx: 1,
      eyeOpen: 1
    });
  }

  // ---- jump 12..14: crouch -> launch -> tuck ----
  frame(12, { bob: 3, coreShrink: 1, shadow: 1, legPhase: 0, eyeOpen: 1 });          // crouch (anticipation)
  frame(13, { bob: -6, lean: 0.05, armUp: 5, shadow: 0.5, legPhase: Math.PI / 2, eyeOpen: 1 }); // launch
  frame(14, { bob: -3, armUp: 6, shadow: 0.25, legPhase: Math.PI, eyeOpen: 1 });     // tuck (apex)

  return c.toDataURL('image/png');
}, { FW, FH, COLS });

writeFileSync(path.join(OUT, 'sample-hero.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
console.log(`wrote assets/sample-hero.png  (${FW}x${FH} cells x ${COLS} frames = ${FW * COLS}x${FH})`);
console.log('  anims: idle 0-3, run 4-11, jump 12-14');
