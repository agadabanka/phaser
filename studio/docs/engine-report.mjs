/*
 * engine-report.mjs — the illustrated ENGINE PAPER. A detailed PDF on what the
 * Studio layer changes/adds on top of Phaser 4 (for the game-engine family).
 * Backgrounds (the games' painterly backdrops), embedded screenshots + the live
 * sysmap, and hand-drawn inline-SVG diagrams. Rendered via headless Chromium's
 * print engine — no LaTeX/pandoc. Reproducible: re-run after the SDK changes.
 *
 *   node docs/engine-report.mjs   ->  docs/out/studio-on-phaser.pdf
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..');
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(STUDIO, 'package.json'));
const { chromium } = require('playwright');

const diary = JSON.parse(fs.readFileSync(path.join(STUDIO, 'diary', 'diary.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(STUDIO, 'lego', 'registry.json'), 'utf8'));
const sdkLines = fs.readFileSync(path.join(STUDIO, 'sdk', 'studio.js'), 'utf8').split('\n').length;
const today = new Date().toISOString().slice(0, 10);

const img = (p) => { try { const f = path.join(STUDIO, p); const ext = path.extname(f).slice(1).replace('jpg', 'jpeg'); return `data:image/${ext};base64,` + fs.readFileSync(f).toString('base64'); } catch { return null; } };
const FIG = {
  emberBg: img('games/ember/src/assets/backdrop.jpg'),
  nimbusBg: img('games/nimbus/src/assets/backdrop.jpg'),
  emberMenu: img('docs/fig/ember-menu.png'), emberPlay: img('docs/fig/ember-play.png'),
  nimbusMenu: img('docs/fig/nimbus-menu.png'), nimbusPlay: img('docs/fig/nimbus-play.png'),
  emberHero: img('games/ember/src/assets/hero_sheet.png'), nimbusHero: img('games/nimbus/src/assets/hero_sheet.png'),
  sysmap: img('tools/sysmap/out/sysmap.png'),
};

// ───────────────────────────────────────────────── SVG diagram helpers ─────
const C = { ink: '#1b2433', mut: '#5d6b80', line: '#33415c', accent: '#b3540f', sky: '#2e7fa3', tool: '#8a4fb0', val: '#1f7a45', game: '#c95a28', paper: '#fbfaf7', band: '#eef1f6' };
function box(x, y, w, h, label, sub, fill, txt) {
  fill = fill || '#ffffff'; txt = txt || C.ink;
  const subColor = (txt === '#fff' || txt === '#ffffff') ? 'rgba(255,255,255,0.82)' : C.mut;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" stroke="${C.line}" stroke-width="1.3"/>` +
    `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 3 : h / 2 + 4)}" text-anchor="middle" font-size="12.5" font-weight="600" fill="${txt}">${label}</text>` +
    (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 13}" text-anchor="middle" font-size="9" fill="${subColor}">${sub}</text>` : '') + `</g>`;
}
function arrow(x1, y1, x2, y2, color, dash, label) {
  color = color || C.line;
  const mid = `${(x1 + x2) / 2}`;
  return `<g>${label ? `<rect x="${(x1 + x2) / 2 - label.length * 3.2 - 4}" y="${(y1 + y2) / 2 - 8}" width="${label.length * 6.4 + 8}" height="14" rx="3" fill="${C.paper}" opacity="0.92"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 + 2.5}" text-anchor="middle" font-size="8.5" fill="${C.mut}">${label}</text>` : ''}` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.6" ${dash ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#ah)"/></g>`;
}
function svg(w, h, body, title) {
  return `<figure class="dia"><svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><marker id="ah" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="${C.line}"/></marker></defs>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="${C.paper}"/>${body}</svg>${title ? `<figcaption>${title}</figcaption>` : ''}</figure>`;
}

// D1 — the layered stack
const D1 = svg(720, 360, (() => {
  let s = '';
  const rows = [
    ['Games — DATA + theme + hooks', 'Ember Depths · Nimbus Climb · template  (≈70-line boot() configs)', C.game, '#fff'],
    ['Studio.Game.boot — the declarative runtime', 'world build · theming · HUD · menu · shell · win/death · the eval contract — ONE implementation', C.accent, '#fff'],
    ['Studio SDK modules (16)', 'Materials · Level · Platformer · Contraptions · Autopilot · Juice · Audio · Cam · Touch · Save · Shell · Feel · Textures · harness', C.sky, '#fff'],
    ['Phaser 4 (phaser-private fork)', 'Scenes · Arcade Physics · WebGL/Canvas · GPU filters · Loader · Tweens · Input', '#34415c', '#fff'],
  ];
  rows.forEach((r, i) => { const y = 24 + i * 80; s += box(40, y, 640, 62, r[0], r[1], r[2], r[3]); if (i) s += arrow(360, y, 360, y - 18, C.line, false, i === 1 ? 'builds-on' : ''); });
  s += `<text x="700" y="20" text-anchor="end" font-size="9" fill="${C.mut}">base ↓ at the bottom · games ↑ on top</text>`;
  return s;
})(), 'Fig 1 — The stack. Studio is an additive convention layer over a Phaser 4 fork; games are data at the very top.');

// D2 — vanilla RAF loop vs the deterministic stepper
const D2 = svg(720, 300, (() => {
  let s = `<text x="180" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="${C.mut}">VANILLA PHASER</text>`;
  s += `<text x="540" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="${C.accent}">STUDIO — stepped + deterministic</text>`;
  s += `<line x1="360" y1="30" x2="360" y2="280" stroke="${C.line}" stroke-dasharray="2 4"/>`;
  s += box(70, 40, 220, 44, 'requestAnimationFrame', 'wall-clock, variable dt', C.band);
  s += arrow(180, 84, 180, 110); s += box(70, 110, 220, 40, 'game.step(realTime, Δvariable)', '', '#fff');
  s += arrow(180, 150, 180, 176); s += box(70, 176, 220, 40, 'scene.update()', 'frame-rate dependent', '#fff');
  s += `<text x="180" y="244" text-anchor="middle" font-size="9.5" fill="${C.mut}">→ replays differ run-to-run</text>`;
  // right
  s += box(430, 40, 220, 44, 'window.__rec (the stepper)', 'loop.sleep() — RAF parked', '#fff7ec');
  s += arrow(540, 84, 540, 110, C.accent); s += box(430, 110, 220, 40, 'game.step(t += 1000/60, FIXED dt)', '', '#fff7ec');
  s += arrow(540, 150, 540, 176, C.accent); s += box(430, 176, 220, 40, 'headlessStep() — physics, no paint', 'fast gate path', '#fff7ec');
  s += `<text x="540" y="244" text-anchor="middle" font-size="9.5" fill="${C.val}">→ byte-identical every run</text>`;
  s += `<text x="540" y="262" text-anchor="middle" font-size="9.5" fill="${C.val}">→ __run(n)/__gate(maxF) drive it</text>`;
  return s;
})(), 'Fig 2 — The core engine change. Studio parks Phaser\'s RAF loop and drives game.step() with a FIXED dt, so a headless autopilot run is reproducible to the byte — the backbone of the 0-death gate.');

// D3 — one frame, ordered (from the diary flow)
const D3 = svg(720, 250, (() => {
  const steps = (diary.flows.find(f => f.id === 'frame-loop') || { steps: [] }).steps.map(s => s.label);
  let s = `<text x="360" y="18" text-anchor="middle" font-size="10" fill="${C.mut}">one Ember frame — update(time, delta), in order</text>`;
  const cols = 5, w = 120, h = 40, gx = 16, gy = 26;
  steps.slice(0, 10).forEach((lab, i) => {
    const r = Math.floor(i / cols), c = i % cols; const x = 24 + c * (w + gx), y = 36 + r * (h + gy);
    s += box(x, y, w, h, (i + 1) + '. ' + lab, '', i === 5 ? '#fff7ec' : '#fff');
    if (i % cols !== cols - 1 && i < steps.length - 1) s += arrow(x + w, y + h / 2, x + w + gx, y + h / 2);
    else if (i < steps.length - 1 && r === 0) s += `<path d="M${x + w / 2},${y + h} q0,18 -${(c) * (w + gx) + w / 2 - 24 - w / 2 + 1},18" fill="none" stroke="${C.line}" stroke-dasharray="3 3"/>`;
  });
  return s;
})(), 'Fig 3 — The per-frame pipeline the boot() runtime runs every game through (stepped at fixed dt). The same sequence powers the autopilot during the gate.');

// D4 — the Lego dispatch + validator gate
const D4 = svg(720, 290, (() => {
  let s = '';
  s += box(40, 120, 120, 52, 'studio CLI', 'next / run / check', C.tool, '#fff');
  s += arrow(160, 146, 220, 146, C.line, false, 'capability');
  s += box(220, 120, 130, 52, 'dispatcher', 'lookup in registry', '#fff');
  s += arrow(285, 120, 285, 70); s += box(220, 30, 130, 40, 'registry.json', 'gated bricks only', C.band);
  s += arrow(350, 146, 410, 146, C.line, false, 'found?');
  s += box(410, 30, 120, 42, 'forge', 'scaffold w/ validator', C.band);
  s += `<text x="470" y="92" text-anchor="middle" font-size="8.5" fill="${C.mut}">miss → born gated</text>`;
  s += arrow(470, 72, 470, 120, C.line, true);
  s += box(410, 120, 120, 52, 'run the brick', 'produce artifact', '#fff');
  s += arrow(530, 146, 590, 146, C.val, false, 'validate');
  s += box(590, 110, 110, 72, 'VALIDATOR', 'ACCEPT / REJECT', C.val, '#fff');
  s += `<text x="645" y="200" text-anchor="middle" font-size="9" fill="${C.val}">deterministic gate</text>`;
  s += `<text x="360" y="250" text-anchor="middle" font-size="9.5" fill="${C.mut}">8 capabilities today: gate · feel · music · art-cohesion · distinctness · texturing · rules · feedback · sprite-animation · contraption</text>`;
  return s;
})(), 'Fig 4 — The Lego architecture: a tool can only enter the line if it is born with a validator; the registry refuses ungated bricks. "Quality is measured, not asserted."');

// D5 — runner vs vertical archetype
const D5 = svg(720, 250, (() => {
  let s = `<text x="180" y="18" text-anchor="middle" font-size="11" font-weight="700" fill="${C.game}">RUNNER (Ember)</text>`;
  s += `<text x="540" y="18" text-anchor="middle" font-size="11" font-weight="700" fill="${C.sky}">VERTICAL (Nimbus)</text>`;
  s += `<line x1="360" y1="28" x2="360" y2="240" stroke="${C.line}" stroke-dasharray="2 4"/>`;
  // runner: ground line w/ a lava gap + hop arc
  s += `<rect x="30" y="180" width="120" height="30" fill="#8a5a2b"/><rect x="180" y="180" width="150" height="30" fill="#8a5a2b"/>`;
  s += `<rect x="150" y="180" width="30" height="30" fill="#d04000"/>`;
  s += `<path d="M120,180 Q165,120 210,180" fill="none" stroke="${C.accent}" stroke-width="2" stroke-dasharray="4 3" marker-end="url(#ah)"/>`;
  s += `<circle cx="120" cy="172" r="8" fill="${C.game}"/>`;
  s += `<text x="180" y="232" text-anchor="middle" font-size="9" fill="${C.mut}">L→R · lava = GAP · autopilot hops gaps/walls</text>`;
  // vertical: staggered platforms + updraft column + climb
  s += `<rect x="470" y="195" width="80" height="14" fill="#cfe0f5"/><rect x="560" y="150" width="70" height="13" fill="#cfe0f5"/><rect x="455" y="108" width="70" height="13" fill="#bfe8ff"/><rect x="560" y="66" width="80" height="13" fill="#cfe0f5"/>`;
  s += `<rect x="505" y="60" width="36" height="150" fill="#bfe8ff" opacity="0.3"/>`;
  s += `<path d="M523,200 L523,72" fill="none" stroke="${C.sky}" stroke-width="2" stroke-dasharray="4 3" marker-end="url(#ah)"/>`;
  s += `<circle cx="510" cy="188" r="8" fill="${C.sky}"/>`;
  s += `<text x="540" y="232" text-anchor="middle" font-size="9" fill="${C.mut}">climb · storm = death · ride updraft columns</text>`;
  return s;
})(), 'Fig 5 — Two archetypes share one runtime. The geometry rules (rules.json) and the autopilot policy differ; everything else — theming, menu, shell, eval — is identical.');

// D6 — the assembly line + feedback loop
const D6 = svg(720, 250, (() => {
  const v = ['story', 'concept', 'art', 'characters', 'levels', 'feel', 'anim', 'texture', 'sound', 'gate', 'ship'];
  let s = `<text x="360" y="16" text-anchor="middle" font-size="10" fill="${C.mut}">the conductor drives the verticals; each is gated before the next</text>`;
  const w = 56, h = 30, gx = 4; const total = v.length * (w + gx);
  v.forEach((lab, i) => { const x = 18 + i * (w + gx); s += box(x, 40, w, h, lab, '', i === 9 ? C.val : '#fff'); s += `<text x="${x + w / 2}" y="36" text-anchor="middle" font-size="7" fill="${C.mut}">${i + 1}</text>`; if (i < v.length - 1) s += arrow(x + w, 55, x + w + gx, 55); });
  s += box(250, 140, 220, 44, 'live game · /api/notes', 'play → pin a note', C.game, '#fff');
  s += arrow(360, 140, 360, 86, C.line, true);
  s += arrow(470, 162, 560, 162, C.line, false, 'auto-file');
  s += box(560, 140, 140, 44, 'GitHub Issues', 'notes → issues', C.tool, '#fff');
  s += arrow(560, 162, 470, 200, C.line, true, 'triage → backlog');
  s += box(250, 196, 220, 38, 'studio next — surfaces backlog', '', C.band);
  s += `<text x="140" y="166" text-anchor="middle" font-size="9" fill="${C.mut}">play ↻ feedback</text>`;
  return s;
})(), 'Fig 6 — The build pipeline (top) and the closed feedback loop: every deployed game files playtest notes as GitHub issues that re-enter the line as backlog.');

// ───────────────────────────────────────────────── module reference ────────
const MODULES = [
  ['harness', 'engine', 'Parks Phaser\'s RAF (loop.sleep) and exposes window.__rec (fixed-dt stepper), __game (snapshot/setInput/autopilot/reset), __run(n), __gate(maxF). THE change that makes Phaser deterministically steppable.'],
  ['Game.boot', 'engine', 'The declarative runtime. A config of { archetype, levels, theme, hooks } becomes a full game: builds the world, themes it, wires HUD/menu/shell/touch/music, installs the harness, runs win/death. runner + vertical.'],
  ['Level', 'content', 'Data→world DSL. One wide static body per ground slab (no per-tile seams), hazards split out by material, plus springs / movers / contraptions / updrafts / gusts. Returns { platforms, hazards, …, tick(dt) }.'],
  ['Materials', 'content', 'Surfaces as data: colour, friction, deadly, ground. stone/mud/ice/lava + sky set cloud/mist/crystal/storm. Drives footing, the deadly-vs-walkable split, and Feel beats.'],
  ['Platformer', 'engine', 'A deterministic controller carrying the jazz feel — coyote time, jump buffer, variable-jump, asymmetric apex-hang gravity, run-accel/skid, per-surface friction. Driven only by input + a fixed dt.'],
  ['Autopilot', 'eval', 'The 0-death driver. platformer() policy (run, hop gaps/walls, hold through the arc) + vertical() policy (climb a waypoint chain, ride updraft columns, wait out gusts). It is what the gate plays.'],
  ['Contraptions', 'content', 'A registry of KINEMATIC machines — seesaw, launcher, crumble, updraft, gust — each a pure function of a phase clock (no Matter.js; byte-deterministic). Each carries a feeling/lens for Feel.'],
  ['Feel', 'eval', 'A pure FUN predictor ported from jazz: scores a level\'s beat placement (engagement/dynamics/arc/flow) with no pixels. Runner scores along x; vertical scores along the climb axis.'],
  ['Juice', 'feel', 'Tweens, particles + Phaser-4 GPU filters (glow, vignette, colour-grade). Every filter call is guarded — WebGL-only, no-ops on canvas, so the canvas gate path stays clean.'],
  ['Audio', 'feel', 'Procedural WebAudio SFX + a music bed: Studio.Audio.music(url) for a composed loop (Lyria 2) or "proc:<mood>" for a synth bed. setMuted reaches every bed. Gesture-started, so the silent gate is unaffected.'],
  ['Menu', 'feedback', 'The deepfin lockup: full-bleed backdrop, breathing hero, generated wordmark, a zone rail of per-level thumbnail cards (lock + best), level-complete card, win screen. Eval-safe (harness reset bypasses).'],
  ['Shell', 'feedback', 'A DOM overlay: pause (+ music duck), notes pinned to game context → POST /api/notes → GitHub issue, restart, mute, corner links (DIARY/REPO/ENGINE). Inert until clicked.'],
  ['Save', 'feedback', 'Per-game localStorage: unlocked level + best coins/time. Written only on manual clears, so the deterministic gate can never read stale state.'],
  ['Touch', 'platform', 'On-screen analog stick + jump button for mobile, themable per game, auto-hidden on non-touch devices.'],
  ['Cam / Textures / Backdrop', 'platform', 'Deadzone follow camera; a procedural texture bakery (no external art needed to run); a parallax backdrop helper.'],
];

const modRows = MODULES.map(m => `<tr><td><code>Studio.${m[0]}</code></td><td><span class="tier t-${m[1]}">${m[1]}</span></td><td>${m[2]}</td></tr>`).join('');

const caps = (registry.tools || []).map(t => `<tr><td><code>${t.capability}</code></td><td>${t.name}</td><td>${(t.inputs || '').slice(0, 130)}</td></tr>`).join('');

// ───────────────────────────────────────────────── the document ────────────
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font: 10.5pt/1.55 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1b2433; }
  h1,h2,h3 { font-family: Georgia, "Times New Roman", serif; color: #14181f; }
  code { background: #eef1f6; border-radius: 4px; padding: 1px 5px; font-size: 9pt; }
  .pg { padding: 16mm 15mm; page-break-after: always; position: relative; }
  .pg:last-child { page-break-after: auto; }
  h2 { font-size: 16pt; border-bottom: 2.5px solid #e8d9c3; padding-bottom: 2mm; margin: 0 0 4mm; }
  h3 { font-size: 12.5pt; margin: 6mm 0 1.5mm; color: #b3540f; }
  p { margin: 0 0 3mm; } .lead { font-size: 11.5pt; color: #39424f; }
  .muted { color: #5d6b80; } b { color: #14181f; }
  ul { margin: 0 0 3mm; padding-left: 5mm; } li { margin-bottom: 1.4mm; }

  /* full-bleed cover + section dividers using the game backdrops */
  .hero { height: 297mm; color: #fff; display: flex; flex-direction: column; justify-content: flex-end; padding: 20mm 16mm; background-size: cover; background-position: center; position: relative; }
  .hero::after { content:''; position:absolute; inset:0; background: linear-gradient(180deg, rgba(10,14,22,.36), rgba(10,14,22,.86)); }
  .hero > * { position: relative; z-index: 1; }
  .hero .kick { text-transform: uppercase; letter-spacing: .3em; font-size: 10pt; color: #ffd9a0; font-weight: 700; }
  .hero h1 { color: #fff; font-size: 40pt; margin: 3mm 0; line-height: 1.05; text-shadow: 0 2px 14px #000a; }
  .hero .sub { font-size: 13.5pt; max-width: 150mm; color: #e8eef6; }
  .hero .by { margin-top: 8mm; font-size: 9.5pt; color: #c7d2e0; }
  .divider { height: 70mm; margin: 0 0 6mm; border-radius: 9px; overflow: hidden; background-size: cover; background-position: center; display: flex; align-items: flex-end; color: #fff; }
  .divider span { background: linear-gradient(0deg, rgba(10,14,22,.8), transparent); width: 100%; padding: 8mm 8mm 5mm; font-family: Georgia, serif; font-size: 17pt; }

  .nums { display: flex; gap: 5mm; flex-wrap: wrap; margin: 4mm 0; }
  .num { background: rgba(255,255,255,.12); border-left: 3px solid #ffd9a0; border-radius: 5px; padding: 2.5mm 4mm; }
  .num b { display: block; font-size: 15pt; font-family: Georgia, serif; color: #fff; } .num span { font-size: 8pt; color: #cfd9e6; text-transform: uppercase; letter-spacing: .08em; }

  figure.dia { margin: 3mm 0 4mm; border: 1px solid #e2e6ee; border-radius: 8px; padding: 3mm; background: #fbfaf7; page-break-inside: avoid; }
  figure.dia figcaption { font-size: 8.6pt; color: #5d6b80; margin-top: 1.5mm; line-height: 1.4; }
  .shot { width: 100%; border: 1px solid #d8dde6; border-radius: 7px; }
  .two { display: flex; gap: 4mm; } .two figure { flex: 1; margin: 0; } .two img { width: 100%; border: 1px solid #d8dde6; border-radius: 6px; } .two figcaption { font-size: 8.4pt; color: #5d6b80; margin-top: 1mm; }

  table { border-collapse: collapse; width: 100%; font-size: 9pt; margin: 2mm 0 4mm; }
  td, th { border: 1px solid #e2e6ee; padding: 1.5mm 2.4mm; vertical-align: top; text-align: left; }
  th { background: #f4f6fa; } td:first-child { white-space: nowrap; }
  .tier { font-size: 7.5pt; border-radius: 99px; padding: .3mm 2mm; color: #fff; }
  .t-engine{background:#b3540f} .t-content{background:#2e8f5a} .t-eval{background:#b08a20;color:#221} .t-feel{background:#8a4fb0} .t-feedback{background:#2e7fa3} .t-platform{background:#5d6b80}
  .callout { background: #f4f1ea; border-left: 4px solid #b3540f; border-radius: 0 6px 6px 0; padding: 3mm 4mm; margin: 3mm 0; font-size: 9.5pt; }
  .gotcha td:first-child { color: #b3540f; font-weight: 600; }
</style></head><body>

<!-- COVER -->
<div class="hero" style="background-image:url('${FIG.emberBg}')">
  <div class="kick">The Game Engine · Studio on Phaser 4 · ${today}</div>
  <h1>What we changed in Phaser<br>to build a game studio</h1>
  <div class="sub">A detailed look at the Studio layer: a deterministic, steppable engine on top of a Phaser 4 fork, a declarative game runtime, an AI-gated assembly line, and the family of games it ships.</div>
  <div class="nums">
    <div class="num"><b>${sdkLines}</b><span>SDK lines</span></div>
    <div class="num"><b>${MODULES.length}</b><span>engine modules</span></div>
    <div class="num"><b>${(registry.tools || []).length}</b><span>gated capabilities</span></div>
    <div class="num"><b>${diary.graph.nodes.length}</b><span>systems mapped</span></div>
    <div class="num"><b>2</b><span>archetypes</span></div>
    <div class="num"><b>5</b><span>games in the family</span></div>
  </div>
  <div class="by">Reproducible: <code>node docs/engine-report.mjs</code> · live map: studio-sysmap-production.up.railway.app</div>
</div>

<!-- 1. THESIS + STACK -->
<div class="pg">
  <h2>1 · The one-sentence engine</h2>
  <p class="lead">Phaser 4 is a renderer + physics + input library. It is <i>not</i> a game studio, and crucially its loop is wall-clock driven — the same inputs replay differently run to run. The Studio layer turns Phaser into something you can <b>clone, gate, and grow</b>:</p>
  <div class="callout"><b>Clone a game, then apply rules over and over — ask what's next, call the right tool, forge it if it's missing, gate the output, and let every playtest note improve the engine.</b></div>
  <p>That sentence is the whole architecture. Three changes make it real, each detailed in this paper:</p>
  <ul>
    <li><b>A deterministic, steppable engine</b> (§2) — the single most important change to Phaser. Without it there is no gate.</li>
    <li><b>A declarative runtime + a 16-module SDK</b> (§3–4) — games become ~70 lines of data; everything reusable lives once in the engine.</li>
    <li><b>An AI-gated assembly line + feedback loop</b> (§5–6) — quality is measured by validators, and play flows back as GitHub issues.</li>
  </ul>
  ${D1}
  <p class="muted">The fork (<code>phaser-private</code>) keeps Studio purely additive — <code>sdk/studio.js</code> rides on top of an unmodified Phaser 4 core, so upstream merges stay trivial and the engine conventions never fight the renderer.</p>
</div>

<!-- 2. DETERMINISM -->
<div class="pg">
  <h2>2 · The core change — a deterministic, steppable engine</h2>
  <p class="lead">Phaser drives <code>game.step()</code> from <code>requestAnimationFrame</code> with a variable delta. Studio's <code>harness</code> parks that loop (<code>game.loop.sleep()</code>) and drives stepping itself with a <b>fixed dt of 1000/60</b>, advancing a virtual clock. A run becomes a pure function of (level data + inputs).</p>
  ${D2}
  <p>This unlocks the contract every game inherits via <code>Studio.harness.install</code>:</p>
  <ul>
    <li><code>window.__rec</code> — the stepper: <code>begin()</code> sleeps the RAF loop; <code>step(n)</code> renders n frames; <code>tick(n)</code> runs <code>headlessStep</code> (physics only, no paint) for a fast gate.</li>
    <li><code>window.__game</code> — observability: <code>snapshot()</code> (x/y/v/coins/deaths/won/level), <code>setInput</code>, <code>autopilot(on)</code>, <code>reset()</code>.</li>
    <li><code>window.__run(n)</code> — reset, autopilot on, step n frames. <code>window.__gate(maxF)</code> — run headless until won/dead, return the verdict.</li>
  </ul>
  <div class="callout">Because two <code>__run(700)</code> snapshots must match byte-for-byte, the gate doubles as a <b>determinism test</b> — it is how we caught that enemy stomp-bounces and phase-clocked gusts were perturbing the path, and why those are kinematic/decorative until provably pure.</div>
  <h3>What the engine added to support it</h3>
  <p>Beyond parking the loop, the fork formalises <b>physics-only stepping</b> (<code>headlessStep</code>): integrate Arcade bodies and run overlaps without touching the WebGL pipeline, so a five-tower climb gates in ~2,400 ticks in well under a second.</p>
</div>

<!-- 3. RUNTIME + a play figure -->
<div class="pg">
  <h2>3 · The declarative runtime — games as data</h2>
  <p class="lead"><code>Studio.Game.boot(config)</code> is where ~500 lines of per-game glue went to live once. A game is now a config of <b>archetype + levels + theme tokens + a few hooks</b>; the runtime builds the world, themes every surface, wires the HUD/menu/shell/touch/music, installs the eval harness, and runs the win/death flow.</p>
  ${D3}
  <div class="two">
    <figure><img class="shot" src="${FIG.emberPlay}"><figcaption>Ember Depths — runner archetype, same runtime.</figcaption></figure>
    <figure><img class="shot" src="${FIG.nimbusPlay}"><figcaption>Nimbus Climb — vertical archetype, same runtime.</figcaption></figure>
  </div>
  <p>Porting Ember to <code>boot()</code> cut its <code>game.js</code> from <b>513 lines to ~70</b> with the 0-death gate and FUN score unchanged — the abstraction is correct when the numbers don't move. The template runs on zero bespoke assets (procedural textures + styled-text menu).</p>
</div>

<!-- 4. SDK MODULES -->
<div class="pg">
  <h2>4 · The SDK — 16 engine modules</h2>
  <p class="lead">Each module builds on a Phaser primitive and adds a studio convention. Tier colours match the system map.</p>
  <table><tr><th>module</th><th>tier</th><th>what it adds on top of Phaser 4</th></tr>${modRows}</table>
</div>

<!-- 5. ARCHETYPES + GOTCHAS -->
<div class="pg">
  <h2>5 · Two archetypes, one engine — and the Phaser-4 gotchas</h2>
  <p class="lead">A runner and a vertical climber share the entire runtime; only the geometry contract (<code>rules.json</code>) and the autopilot policy differ.</p>
  ${D5}
  <h3>Hard-won Phaser-4 + Arcade conventions (baked into the engine)</h3>
  <table class="gotcha"><tr><th>convention</th><th>why</th></tr>
    <tr><td>one wide static body per ground slab</td><td>per-tile bodies make the player catch on seams and spoof <code>blocked.right</code>, breaking the autopilot.</td></tr>
    <tr><td>detect walls with <code>blocked.right</code> only</td><td>overlaps (coins/enemies) spuriously set <code>touching.*</code>.</td></tr>
    <tr><td>lava/storm = a GAP filled with a deadly slab</td><td>routes to the existing gap-jump autopilot; walking-into-deadly-ground would need a smarter driver.</td></tr>
    <tr><td>GPU filters are WebGL-only → guard every call</td><td>so the deterministic canvas gate path renders cleanly.</td></tr>
    <tr><td><code>getChildren()</code>, not <code>children.iterate</code></td><td>Phaser-4 static-group API.</td></tr>
    <tr><td>clear keyboard <i>captures</i> for DOM typing</td><td>Phaser preventDefault's Space/arrows at the manager level even with the plugin off — it ate spaces in the notes box.</td></tr>
    <tr><td><code>preserveDrawingBuffer</code> + pixelArt off</td><td>readback for the non-black gate; linear filtering keeps painterly art from turning to pixel soup.</td></tr>
  </table>
</div>

<!-- 6. THE GATED LINE + FEEDBACK -->
<div class="pg" style="background:#fbfaf7">
  <h2>6 · The assembly line is gated; play feeds back</h2>
  <p class="lead">Every tool is a "brick" that <b>cannot enter the line without a validator</b>. The registry refuses ungated bricks; the dispatcher runs the validator and returns ACCEPT/REJECT. <code>studio check</code> runs them all into one scorecard.</p>
  ${D4}
  <table><tr><th>capability</th><th>brick</th><th>what it gates</th></tr>${caps}</table>
  ${D6}
  <p>Both shipped games score <b>7/7 ACCEPT</b>. Playtest notes posted in-game auto-file as GitHub issues (label <code>playtest-note</code>, a <code>note-id</code> back-reference) on the game's own repo, then re-enter as backlog — closing the loop the user asked for.</p>
</div>

<!-- 7. THE FAMILY + SYSMAP -->
<div class="pg">
  <h2>7 · The family + the living map</h2>
  <p class="lead">The two new games join the engine family (the-platformer, jazz, deepfin) — each a standalone repo, registered in <code>game-engine/hub/games.json</code>, sharing the deepfin notes→issues convention and menu polish. The lineage is real: the FUN model came from jazz, the menu bar from deepfin.</p>
  <img class="shot" src="${FIG.sysmap}" style="margin:3mm 0">
  <p class="muted">Fig 7 — The live system map (<code>tools/sysmap</code>), rendered from the build diary (${diary.entries.length} entries · ${diary.graph.nodes.length} nodes · ${diary.graph.edges.length} edges · ${(diary.flows || []).length} ordered flows). Per-game lens + steppable call-order flows; this PDF and that map read the same source of truth.</p>
  <div class="two">
    <figure><img class="shot" src="${FIG.emberMenu}"><figcaption>Ember Depths — the menu, the deepfin lockup.</figcaption></figure>
    <figure><img class="shot" src="${FIG.nimbusMenu}"><figcaption>Nimbus Climb — same engine menu, cloud theme.</figcaption></figure>
  </div>
</div>

<!-- DIVIDER / back cover -->
<div class="hero" style="background-image:url('${FIG.nimbusBg}'); justify-content:center; text-align:center">
  <div class="kick" style="align-self:center">fin</div>
  <h1 style="font-size:30pt">Clone · Apply rules · Gate · Grow</h1>
  <div class="sub" style="align-self:center">Phaser draws the frame. The engine makes it reproducible, declarative, gated, and alive.</div>
</div>

</body></html>`;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
const pdf = path.join(OUT, 'studio-on-phaser.pdf');
await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('📄 ' + path.relative(STUDIO, pdf) + '  (' + (fs.statSync(pdf).size / 1024 / 1024).toFixed(2) + ' MB)');
