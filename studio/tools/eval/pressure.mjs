/*
 * pressure — the engine's SYSTEMATIC tension knob. A level declares a `difficulty`
 * (0..1); this deterministically expands its base schedule with FLANK waves: off-
 * rally units that bypass the centre deathball and pressure the HQ (so the garage
 * actually takes damage = tension, and a flank-aware strategy beats a centre-only
 * one = strategic depth). Higher difficulty ⇒ more & tougher flanks.
 *
 * This is the ONE canonical definition. It is mirrored verbatim by Studio.rtsPressure
 * in the SDK (sdk/studio.js) and imported by the sim + strategy-sweep + balancer, so
 * the runtime and every eval tool always compute the SAME effective schedule. The
 * 0-death gate (which double-runs the real game) is what keeps the mirror honest.
 *
 *   mode: 'lane' (top-down RTS, flank lanes 0/2) | 'lx' (iso, flank lx ∓0.62)
 */
export function effectiveSchedule(spec, mode) {
  const base = (spec.schedule || []).map((e) => ({ ...e }));
  const d = spec.difficulty || 0;
  if (d > 0) {
    const span = base.reduce((m, e) => Math.max(m, e.t), 20);
    const n = Math.round(d * 12);                                  // up to 12 flank waves at full difficulty
    for (let k = 0; k < n; k++) {
      const t = +(6 + (span - 4) * (k / Math.max(1, n - 1))).toFixed(2);
      const left = k % 2 === 0;
      const heavy = d > 0.45 && k % 3 !== 0;                       // tougher (brawler) flanks sooner at higher difficulty
      const e = { t, type: heavy ? 'brawler' : 'scout', flank: true };
      if (mode === 'lane') e.lane = left ? 0 : 2; else e.lx = left ? -0.62 : 0.62;
      base.push(e);
    }
    base.sort((a, b) => a.t - b.t);
  }
  return base;
}
