/*
 * Studio Sysmap — an interactive node/edge visualizer of how the Studio's systems
 * interact, rendered FROM the build diary (../../diary/diary.json) + the Lego
 * registry (../../lego/registry.json). Vanilla JS + SVG, no deps.
 *
 * - nodes colored by `kind`, grouped/positioned by `tier`
 * - edges styled by `rel`
 * - HOVER a node -> tooltip (details + which diary entries touched it + validator ✓/✗)
 * - CLICK a node -> focus it + highlight its neighbors (dim the rest)
 * - layout toggle: "tier-stack" (layered by tier order) vs "force graph" (self-rolled)
 * - TIMELINE strip of diary phases; click a phase -> highlight the systems it touched
 * - legend for kinds + relations; per-node validator ✓/✗ badge from the registry
 */
'use strict';

const SVGNS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);

// ---- palettes (kept in sync with the CSS legend swatches) -------------------
const KIND_COLOR = {
  tier: '#5a6b7a', sdk: '#4aa3c8', tool: '#b07ad6', game: '#e0703a',
  validator: '#e0b341', orchestrator: '#5fd08a', concept: '#8893a6'
};
const KIND_LABEL = {
  tier: 'tier (stack layer)', sdk: 'SDK module', tool: 'tool / brick', game: 'game',
  validator: 'validator / gate', orchestrator: 'orchestrator', concept: 'concept / doc'
};
// edge styling by relation: color + dash
const REL_STYLE = {
  'depends-on':   { color: '#7f8db0', dash: '' },
  'validated-by': { color: '#e0b341', dash: '5 4' },
  'dispatched-by':{ color: '#5fd08a', dash: '2 4' },
  'feeds':        { color: '#4aa3c8', dash: '' },
  'produces':     { color: '#e0703a', dash: '7 5' },
  'builds-on':    { color: '#5a6b7a', dash: '1 5' }
};
const REL_LABEL = {
  'depends-on': 'depends-on', 'validated-by': 'validated-by', 'dispatched-by': 'dispatched-by',
  'feeds': 'feeds', 'produces': 'produces', 'builds-on': 'builds-on (tier)'
};

// ---- state ------------------------------------------------------------------
const S = {
  diary: null, registry: null,
  nodes: [], edges: [], tiers: [],
  byId: new Map(),
  entriesByNode: new Map(),     // nodeId -> [entry,...]
  capStatus: new Map(),         // capability -> { known, pass, name }
  layout: 'tier',
  focusId: null,                // clicked/focused node
  activePhase: null,            // highlighted timeline phase
  kindOff: new Set(),           // hidden kinds (legend toggles)
  relOff: new Set(),            // hidden relations
  // view transform (pan/zoom)
  tx: 0, ty: 0, scale: 1,
  W: 0, H: 0,
  sim: null                     // force sim handle (raf id)
};

// ===========================================================================
// load
// ===========================================================================
async function load() {
  try {
    const [d, r] = await Promise.all([
      fetch('../../diary/diary.json').then(okJson),
      fetch('../../lego/registry.json').then(okJson).catch(() => ({ tools: [] }))
    ]);
    S.diary = d; S.registry = r || { tools: [] };
  } catch (e) {
    return fail('Failed to load diary.json / registry.json: ' + e.message);
  }
  if (!S.diary || !S.diary.graph || !Array.isArray(S.diary.graph.nodes)) {
    return fail('diary.json has no graph.nodes');
  }

  S.tiers = (S.diary.tiers || []).slice().sort((a, b) => a.order - b.order);
  S.nodes = S.diary.graph.nodes.map((n) => ({ ...n, x: 0, y: 0, vx: 0, vy: 0 }));
  // edges: drop any whose endpoints are missing (defensive), keep rel
  const ids = new Set(S.nodes.map((n) => n.id));
  S.edges = (S.diary.graph.edges || []).filter((e) => ids.has(e.from) && ids.has(e.to));
  S.byId = new Map(S.nodes.map((n) => [n.id, n]));

  // entries-by-node (for the tooltip)
  for (const e of (S.diary.entries || [])) {
    for (const sid of (e.systems || [])) {
      if (!S.entriesByNode.has(sid)) S.entriesByNode.set(sid, []);
      S.entriesByNode.get(sid).push(e);
    }
  }

  // capability status from the registry: a capability is "pass" if it has a brick
  // with hasValidator !== false (the registry only admits gated bricks).
  for (const t of (S.registry.tools || [])) {
    S.capStatus.set(t.capability, { known: true, pass: t.hasValidator !== false, name: t.name, deterministic: !!t.deterministic });
  }

  // expose for the headless checker (assert node count > 0)
  window.__sysmap = {
    ready: true,
    nodeCount: () => S.nodes.length,
    edgeCount: () => S.edges.length,
    rendered: () => $('#svg').querySelectorAll('g.node').length,
    focus: (id) => focusNode(id),
    setLayout
  };

  buildLegend();
  buildTimeline();
  sizeSvg();
  setLayout('tier', true);
  wireControls();
  window.__ready = true;   // headless ready flag (mirrors the studio eval pattern)
}
function okJson(res) { if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + res.url); return res.json(); }
function fail(msg) { const el = $('#err'); el.textContent = msg; el.style.display = 'block'; window.__ready = true; window.__sysmap = { ready: false, nodeCount: () => 0, rendered: () => 0 }; console.error(msg); }

// ===========================================================================
// validator badge resolution
//   node.validator is a CAPABILITY -> look it up in the registry.
//   ✓ = registered + gated, ✗ = registered but ungated, ? = unknown/no validator
// ===========================================================================
function validatorBadge(node) {
  if (!node.validator) return { glyph: '', cls: 'unk', text: 'no validator' };
  const st = S.capStatus.get(node.validator);
  if (!st) return { glyph: '?', cls: 'unk', text: `capability "${node.validator}" (not in registry)` };
  return st.pass
    ? { glyph: '✓', cls: 'ok', text: `${node.validator} — gated by ${st.name}${st.deterministic ? ' (deterministic)' : ''}` }
    : { glyph: '✗', cls: 'bad', text: `${node.validator} — ${st.name} has no validator` };
}

// ===========================================================================
// layouts
// ===========================================================================
function sizeSvg() {
  const m = $('main').getBoundingClientRect();
  S.W = Math.max(640, m.width); S.H = Math.max(360, m.height);
  $('#svg').setAttribute('viewBox', `0 0 ${S.W} ${S.H}`);
}

function setLayout(which, force) {
  if (!force && which === S.layout) return;
  S.layout = which;
  if (S.sim) { cancelAnimationFrame(S.sim); S.sim = null; }
  document.querySelectorAll('#layoutSeg button').forEach((b) => b.classList.toggle('on', b.dataset.layout === which));
  // reset view transform on a layout switch
  S.tx = 0; S.ty = 0; S.scale = 1;
  if (which === 'tier') layoutTier(); else layoutForce();
  render();
  if (which === 'force') runForce();
}

// TIER-STACK: a vertical band per tier (base at the BOTTOM, like the book's stack),
// nodes spread horizontally within their band. Deterministic + readable.
function layoutTier() {
  const order = S.tiers.map((t) => t.id);
  const bandH = S.H / Math.max(1, order.length);
  const padX = 130, padTop = 26;
  const groups = new Map(order.map((id) => [id, []]));
  for (const n of S.nodes) { (groups.get(n.tier) || groups.set(n.tier, []).get(n.tier)).push(n); }
  order.forEach((tid, i) => {
    const arr = groups.get(tid) || [];
    // base tier (order 1) at the bottom -> invert the row index
    const rowFromBottom = order.length - 1 - i;
    const cy = padTop + rowFromBottom * bandH + bandH / 2;
    const span = S.W - padX - 40;
    arr.forEach((n, j) => {
      const t = arr.length > 1 ? j / (arr.length - 1) : 0.5;
      n.x = padX + t * span;
      // stagger two rows inside a band so labels don't collide
      n.y = cy + (j % 2 ? 1 : -1) * (arr.length > 6 ? 16 : 0);
      n._tierIndexFromBottom = rowFromBottom;
    });
  });
  S._bandH = bandH; S._padTop = padTop; S._orderLen = order.length;
}

// FORCE GRAPH: a self-rolled force-directed layout (repulsion + spring + gravity).
// Seeded from a circle so it converges deterministically enough to be useful.
function layoutForce() {
  const cx = S.W / 2, cy = S.H / 2, R = Math.min(S.W, S.H) * 0.36;
  S.nodes.forEach((n, i) => {
    const a = (i / S.nodes.length) * Math.PI * 2;
    n.x = cx + Math.cos(a) * R; n.y = cy + Math.sin(a) * R; n.vx = 0; n.vy = 0;
  });
}
function runForce() {
  const cx = S.W / 2, cy = S.H / 2;
  const K_REP = 5200, K_SPRING = 0.012, REST = 96, DAMP = 0.86, K_GRAV = 0.015;
  let ticks = 0, MAX = 460;
  const step = () => {
    for (const a of S.nodes) { a.fx = 0; a.fy = 0; }
    // repulsion (O(n^2), fine for ~45 nodes)
    for (let i = 0; i < S.nodes.length; i++) {
      const a = S.nodes[i];
      for (let j = i + 1; j < S.nodes.length; j++) {
        const b = S.nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y; let d2 = dx * dx + dy * dy || 0.01;
        const f = K_REP / d2; const d = Math.sqrt(d2);
        const ux = dx / d, uy = dy / d;
        a.fx += ux * f; a.fy += uy * f; b.fx -= ux * f; b.fy -= uy * f;
      }
    }
    // springs along edges
    for (const e of S.edges) {
      const a = S.byId.get(e.from), b = S.byId.get(e.to);
      let dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - REST) * K_SPRING; const ux = dx / d, uy = dy / d;
      a.fx += ux * f * d * 0.04; a.fy += uy * f * d * 0.04;
      b.fx -= ux * f * d * 0.04; b.fy -= uy * f * d * 0.04;
    }
    // mild gravity to center + integrate
    for (const a of S.nodes) {
      if (a === S._dragNode) continue;
      a.fx += (cx - a.x) * K_GRAV; a.fy += (cy - a.y) * K_GRAV;
      a.vx = (a.vx + a.fx) * DAMP; a.vy = (a.vy + a.fy) * DAMP;
      // clamp speed
      const sp = Math.hypot(a.vx, a.vy); if (sp > 24) { a.vx = a.vx / sp * 24; a.vy = a.vy / sp * 24; }
      a.x += a.vx; a.y += a.vy;
      a.x = Math.max(60, Math.min(S.W - 30, a.x)); a.y = Math.max(40, Math.min(S.H - 30, a.y));
    }
    positionAll();
    if (++ticks < MAX) S.sim = requestAnimationFrame(step);
    else S.sim = null;
  };
  S.sim = requestAnimationFrame(step);
}

// ===========================================================================
// render
// ===========================================================================
const NODE_R = 9;
function nodeRadius(n) { return n.kind === 'tier' ? 0 : (n.kind === 'game' ? 12 : (n.kind === 'validator' ? 10 : NODE_R)); }

function render() {
  const svg = $('#svg');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // a pan/zoom group everything lives in
  const root = el('g', { id: 'vp' });
  applyTransform(root);
  svg.appendChild(root);

  // tier bands (only meaningful in tier layout) ------------------------------
  if (S.layout === 'tier') {
    const bands = el('g', { class: 'bands' });
    for (let r = 0; r < S._orderLen; r++) {
      const tier = S.tiers[S._orderLen - 1 - r];
      const y = S._padTop + r * S._bandH;
      if (r % 2 === 0) bands.appendChild(el('rect', { class: 'tierband', x: 0, y, width: S.W, height: S._bandH }));
      const tx = el('text', { class: 'tierband-label', x: 14, y: y + 16 });
      tx.textContent = `${tier.order}· ${tier.label}`;
      if (tier.color) tx.setAttribute('fill', tier.color);
      bands.appendChild(tx);
    }
    root.appendChild(bands);
  }

  // edges --------------------------------------------------------------------
  const eg = el('g', { class: 'edges' });
  S.edges.forEach((e, i) => {
    const st = REL_STYLE[e.rel] || { color: '#888', dash: '' };
    const p = el('path', { class: 'edge', 'data-i': i, stroke: st.color });
    if (st.dash) p.setAttribute('stroke-dasharray', st.dash);
    e._el = p;
    eg.appendChild(p);
  });
  root.appendChild(eg);

  // nodes --------------------------------------------------------------------
  const ng = el('g', { class: 'nodes' });
  for (const n of S.nodes) {
    const g = el('g', { class: 'node ' + n.kind, 'data-id': n.id });
    const color = (n.kind === 'tier' && n.tierColor) || KIND_COLOR[n.kind] || '#9aa';
    if (n.kind === 'tier') {
      // a soft pill for tier nodes (the stack backbone)
      const w = Math.max(70, (n.label.length) * 7 + 18);
      g.appendChild(el('rect', { x: -w / 2, y: -12, width: w, height: 24, fill: tierColor(n), 'fill-opacity': .9 }));
      const t = el('text', { x: 0, y: 4, 'text-anchor': 'middle' }); t.textContent = n.label;
      g.appendChild(t);
    } else {
      const r = nodeRadius(n);
      g.appendChild(el('circle', { r, fill: color }));
      // validator badge ring
      const vb = validatorBadge(n);
      if (vb.glyph) {
        const bt = el('text', { class: 'badge', x: r + 1, y: -r + 1, 'text-anchor': 'start' });
        bt.textContent = vb.glyph;
        bt.setAttribute('fill', vb.cls === 'ok' ? '#7ef0a8' : vb.cls === 'bad' ? '#ff7b7b' : '#9aa6bb');
        g.appendChild(bt);
      }
      const t = el('text', { x: r + 5, y: 4, 'text-anchor': 'start' }); t.textContent = n.label;
      g.appendChild(t);
    }
    n._el = g;
    g.addEventListener('mouseenter', (ev) => showTip(n, ev));
    g.addEventListener('mousemove', moveTip);
    g.addEventListener('mouseleave', hideTip);
    g.addEventListener('click', (ev) => { ev.stopPropagation(); focusNode(S.focusId === n.id ? null : n.id); });
    ng.appendChild(g);
  }
  root.appendChild(ng);

  positionAll();
  applyHighlight();
  updateCounts();
}

function tierColor(n) {
  const t = S.tiers.find((x) => x.id === (n.tier || n.id));
  return (t && t.color) || KIND_COLOR.tier;
}

function positionAll() {
  for (const n of S.nodes) if (n._el) n._el.setAttribute('transform', `translate(${n.x},${n.y})`);
  for (const e of S.edges) {
    if (!e._el) continue;
    const a = S.byId.get(e.from), b = S.byId.get(e.to);
    // gentle curve so parallel edges separate a little
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y; const nx = -dy, ny = dx;
    const len = Math.hypot(nx, ny) || 1; const bow = 14;
    const cx = mx + (nx / len) * bow, cy = my + (ny / len) * bow;
    e._el.setAttribute('d', `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`);
  }
}

// ===========================================================================
// highlight (focus + neighbors, phase, legend filters)
// ===========================================================================
function neighborsOf(id) {
  const set = new Set([id]);
  for (const e of S.edges) { if (e.from === id) set.add(e.to); if (e.to === id) set.add(e.from); }
  return set;
}

function applyHighlight() {
  const hiddenKinds = S.kindOff, hiddenRels = S.relOff;
  // phase set
  const phaseNodes = S.activePhase ? phaseNodeSet(S.activePhase) : null;
  // focus set
  const focusSet = S.focusId ? neighborsOf(S.focusId) : null;

  for (const n of S.nodes) {
    if (!n._el) continue;
    let dim = false;
    if (hiddenKinds.has(n.kind)) dim = true;
    if (phaseNodes && !phaseNodes.has(n.id)) dim = true;
    if (focusSet && !focusSet.has(n.id)) dim = true;
    n._el.classList.toggle('dim', dim);
    n._el.classList.toggle('focus', S.focusId === n.id || (phaseNodes && phaseNodes.has(n.id) && !focusSet));
  }
  for (const e of S.edges) {
    if (!e._el) continue;
    let hot = false, dim = false;
    if (hiddenRels.has(e.rel)) { dim = true; }
    if (hiddenKinds.has(S.byId.get(e.from).kind) || hiddenKinds.has(S.byId.get(e.to).kind)) dim = true;
    if (focusSet) {
      if (e.from === S.focusId || e.to === S.focusId) hot = true; else dim = true;
    }
    if (phaseNodes) {
      if (phaseNodes.has(e.from) && phaseNodes.has(e.to)) hot = hot || true; else dim = true;
    }
    e._el.classList.toggle('hot', hot && !dim);
    e._el.classList.toggle('dim', dim && !hot);
  }
}

function phaseNodeSet(phase) {
  const set = new Set();
  for (const en of (S.diary.entries || [])) if (en.phase === phase) for (const s of (en.systems || [])) set.add(s);
  return set;
}

function focusNode(id) {
  S.focusId = id;
  // focusing clears the phase highlight for clarity
  if (id) setActivePhase(null, true);
  applyHighlight();
}

// ===========================================================================
// tooltip
// ===========================================================================
function showTip(n, ev) {
  const tip = $('#tip');
  const vb = validatorBadge(n);
  const ents = (S.entriesByNode.get(n.id) || []);
  const tier = S.tiers.find((t) => t.id === n.tier);
  let html = `<h4>${esc(n.label)}</h4>`;
  html += `<div class="kindline">${KIND_LABEL[n.kind] || n.kind}${tier ? ' · ' + esc(tier.label) + ' tier' : ''}</div>`;
  if (n.desc) html += `<div class="desc">${esc(n.desc)}</div>`;
  html += `<div class="sec">validator</div><div class="val ${vb.cls}">${vb.glyph ? vb.glyph + ' ' : ''}${esc(vb.text)}</div>`;
  if (ents.length) {
    html += `<div class="sec">touched by ${ents.length} ${ents.length === 1 ? 'entry' : 'entries'}</div><ul>`;
    for (const e of ents.slice(0, 6)) html += `<li>${esc(e.phase)}: ${esc(e.title)}</li>`;
    if (ents.length > 6) html += `<li>…and ${ents.length - 6} more</li>`;
    html += `</ul>`;
  } else {
    html += `<div class="sec">touched by</div><div class="desc" style="color:var(--muted)">no diary entries reference this node yet</div>`;
  }
  tip.innerHTML = html; tip.style.display = 'block';
  moveTip(ev);
}
function moveTip(ev) {
  const tip = $('#tip'); if (tip.style.display !== 'block') return;
  const pad = 16, r = tip.getBoundingClientRect(); const mw = $('main').getBoundingClientRect();
  let x = ev.clientX - mw.left + pad, y = ev.clientY - mw.top + pad;
  if (x + r.width > mw.width) x = ev.clientX - mw.left - r.width - pad;
  if (y + r.height > mw.height) y = ev.clientY - mw.top - r.height - pad;
  tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px';
}
function hideTip() { $('#tip').style.display = 'none'; }

// ===========================================================================
// legend
// ===========================================================================
function buildLegend() {
  const L = $('#legend');
  const usedKinds = [...new Set(S.nodes.map((n) => n.kind))];
  const usedRels = [...new Set(S.edges.map((e) => e.rel))];
  let h = `<h3>Kinds <span style="font-weight:400;text-transform:none">(click to toggle)</span></h3>`;
  for (const k of ['tier', 'sdk', 'tool', 'game', 'validator', 'orchestrator', 'concept']) {
    if (!usedKinds.includes(k)) continue;
    h += `<div class="row k" data-kind="${k}"><span class="sw" style="background:${KIND_COLOR[k]}"></span>${KIND_LABEL[k]}</div>`;
  }
  h += `<hr><h3>Relations</h3>`;
  for (const r of ['depends-on', 'builds-on', 'feeds', 'validated-by', 'dispatched-by', 'produces']) {
    if (!usedRels.includes(r)) continue;
    const st = REL_STYLE[r];
    h += `<div class="row r" data-rel="${r}"><span class="ln" style="border-color:${st.color};${st.dash ? 'border-top-style:dashed' : ''}"></span>${REL_LABEL[r]}</div>`;
  }
  h += `<hr><div class="row" style="cursor:default"><span class="sw" style="background:transparent;border:0;color:#7ef0a8">✓</span> validator gated</div>`;
  h += `<div class="row" style="cursor:default"><span class="sw" style="background:transparent;border:0;color:#9aa6bb">?</span> unknown / none</div>`;
  h += `<div class="hint">hover a node for details · click to focus its neighbors · click empty space to clear</div>`;
  L.innerHTML = h;
  L.querySelectorAll('.row.k').forEach((row) => row.addEventListener('click', () => {
    const k = row.dataset.kind; if (S.kindOff.has(k)) S.kindOff.delete(k); else S.kindOff.add(k);
    row.classList.toggle('off', S.kindOff.has(k)); applyHighlight();
  }));
  L.querySelectorAll('.row.r').forEach((row) => row.addEventListener('click', () => {
    const r = row.dataset.rel; if (S.relOff.has(r)) S.relOff.delete(r); else S.relOff.add(r);
    row.classList.toggle('off', S.relOff.has(r)); applyHighlight();
  }));
}

// ===========================================================================
// timeline strip
// ===========================================================================
const STATUS_DOT = { shipped: '#b0476a', green: '#5fd08a', done: '#4aa3c8', wip: '#e0b341', spike: '#8893a6' };
function buildTimeline() {
  const tl = $('#timeline');
  // one cell per PHASE (first entry's date + count); preserves entry order
  const phases = [];
  const seen = new Map();
  const sorted = (S.diary.entries || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const e of sorted) {
    if (!seen.has(e.phase)) { const o = { phase: e.phase, date: e.date, entries: [] }; seen.set(e.phase, o); phases.push(o); }
    seen.get(e.phase).entries.push(e);
  }
  S._phases = phases;
  let h = '';
  for (const p of phases) {
    const last = p.entries[p.entries.length - 1];
    h += `<div class="ph" data-phase="${esc(p.phase)}">
      <div class="p">${esc(p.phase)}</div>
      <div class="t"><span class="dot" style="background:${STATUS_DOT[last.status] || '#888'}"></span>${esc(p.entries[0].title.slice(0, 46))}${p.entries[0].title.length > 46 ? '…' : ''}</div>
      <div class="d">${esc(p.date)} · ${p.entries.length} ${p.entries.length === 1 ? 'entry' : 'entries'}</div>
    </div>`;
  }
  tl.innerHTML = h;
  tl.querySelectorAll('.ph').forEach((cell) => cell.addEventListener('click', () => {
    const ph = cell.dataset.phase;
    setActivePhase(S.activePhase === ph ? null : ph);
  }));
}
function setActivePhase(ph, silent) {
  S.activePhase = ph;
  if (ph) S.focusId = null;   // phase highlight supersedes a node focus
  document.querySelectorAll('#timeline .ph').forEach((c) => c.classList.toggle('on', c.dataset.phase === ph));
  const hint = $('#tlhint');
  if (ph) {
    const n = phaseNodeSet(ph).size;
    hint.textContent = `— "${ph}" touched ${n} system${n === 1 ? '' : 's'} (highlighted)`;
  } else hint.textContent = '— click a phase to highlight the systems it touched';
  if (!silent) applyHighlight();
}

// ===========================================================================
// controls: layout toggle, reset, pan/zoom, drag, dblclick empty -> clear
// ===========================================================================
function wireControls() {
  document.querySelectorAll('#layoutSeg button').forEach((b) =>
    b.addEventListener('click', () => setLayout(b.dataset.layout)));
  $('#resetBtn').addEventListener('click', () => {
    S.focusId = null; setActivePhase(null, true);
    S.kindOff.clear(); S.relOff.clear();
    document.querySelectorAll('.legend .row').forEach((r) => r.classList.remove('off'));
    setLayout(S.layout, true);
  });

  const svg = $('#svg');
  svg.addEventListener('click', (e) => { if (e.target === svg || e.target.id === 'vp') { focusNode(null); setActivePhase(null); } });

  // pan
  let dragging = false, sx = 0, sy = 0, otx = 0, oty = 0;
  svg.addEventListener('mousedown', (e) => {
    if (e.target.closest('g.node')) return;     // node drag handled below
    dragging = true; svg.classList.add('dragging'); sx = e.clientX; sy = e.clientY; otx = S.tx; oty = S.ty;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return; S.tx = otx + (e.clientX - sx) / S.scale; S.ty = oty + (e.clientY - sy) / S.scale; applyTransform();
  });
  window.addEventListener('mouseup', () => { dragging = false; svg.classList.remove('dragging'); S._dragNode = null; });

  // zoom
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    S.scale = Math.max(0.35, Math.min(3, S.scale * f));
    applyTransform();
  }, { passive: false });

  // node drag (force layout): grab a node and move it
  svg.addEventListener('mousedown', (e) => {
    const g = e.target.closest('g.node'); if (!g) return;
    const n = S.byId.get(g.dataset.id); if (!n || n.kind === 'tier') return;
    S._dragNode = n; e.stopPropagation();
    const move = (ev) => {
      const pt = toWorld(ev); n.x = pt.x; n.y = pt.y; n.vx = 0; n.vy = 0; positionAll();
    };
    const up = () => { S._dragNode = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  });

  window.addEventListener('resize', () => { sizeSvg(); setLayout(S.layout, true); });
}

function applyTransform(rootEl) {
  const root = rootEl || $('#vp'); if (!root) return;
  root.setAttribute('transform', `translate(${S.tx * S.scale},${S.ty * S.scale}) scale(${S.scale})`);
}
function toWorld(ev) {
  const svg = $('#svg'); const r = svg.getBoundingClientRect();
  const vx = (ev.clientX - r.left) / r.width * S.W, vy = (ev.clientY - r.top) / r.height * S.H;
  return { x: vx / S.scale - S.tx, y: vy / S.scale - S.ty };
}

function updateCounts() {
  $('#counts').textContent = `${S.nodes.length} systems · ${S.edges.length} edges · ${(S.diary.entries || []).length} diary entries`;
}

// ---- tiny helpers -----------------------------------------------------------
function el(name, attrs) { const e = document.createElementNS(SVGNS, name); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

load();
