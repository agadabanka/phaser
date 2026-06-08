// Poll a URL until it contains a marker string (new-build detector). No sleep.
// usage: node waitlive.mjs <url> <marker> [maxSeconds]
const url = process.argv[2], marker = process.argv[3] || '', maxS = +(process.argv[4] || 200);
const t0 = Date.now();
async function poll() {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const txt = await r.text();
    if (!marker || txt.includes(marker)) { console.log('OK: marker present after', Math.round((Date.now() - t0) / 1000), 's'); process.exit(0); }
  } catch (e) { /* not reachable yet */ }
  if ((Date.now() - t0) / 1000 > maxS) { console.log('TIMEOUT after', maxS, 's'); process.exit(1); }
  setTimeout(poll, 5000);
}
poll();
