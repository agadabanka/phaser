/*
 * auth youtube — mint a long-lived REFRESH TOKEN via the OAuth device flow, once.
 * Prints a URL + code; you approve on any device; it polls, then saves the refresh
 * token to studio/.studio-secrets/youtube.json (gitignored) AND prints it so you
 * can set YT_REFRESH_TOKEN as a permanent env secret. After this, every
 * `studio film <game> --upload` is hands-free (refresh → access, no prompts).
 *
 *   YT_CLIENT_ID=… YT_CLIENT_SECRET=… node tools/video/auth.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CID = process.env.YT_CLIENT_ID, CSEC = process.env.YT_CLIENT_SECRET;
if (!CID || !CSEC) { console.error('set YT_CLIENT_ID and YT_CLIENT_SECRET (a TV/Limited-Input OAuth client)'); process.exit(2); }
const SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

const dc = await (await fetch('https://oauth2.googleapis.com/device/code', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: CID, scope: SCOPE }) })).json();
if (!dc.device_code) { console.error('device flow rejected (is the client "TV and Limited Input"?):', JSON.stringify(dc)); process.exit(1); }
console.log('\n👉 Authorize: open ' + dc.verification_url + '  and enter code  ' + dc.user_code + '\n   (expires in ' + Math.round(dc.expires_in / 60) + ' min)\n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
while (Date.now() - t0 < dc.expires_in * 1000) {
  await sleep((dc.interval || 5) * 1000);
  const r = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: CID, client_secret: CSEC, device_code: dc.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }) })).json();
  if (r.refresh_token) {
    fs.mkdirSync(path.join(STUDIO, '.studio-secrets'), { recursive: true });
    fs.writeFileSync(path.join(STUDIO, '.studio-secrets', 'youtube.json'), JSON.stringify({ client_id: CID, client_secret: CSEC, refresh_token: r.refresh_token }, null, 2));
    console.log('✅ authorized — saved to .studio-secrets/youtube.json');
    console.log('\n   To make it permanent, set this as an environment secret:');
    console.log('   YT_REFRESH_TOKEN=' + r.refresh_token + '\n');
    process.exit(0);
  }
  if (r.error && r.error !== 'authorization_pending' && r.error !== 'slow_down') { console.error('auth failed:', r.error); process.exit(1); }
  process.stdout.write('.');
}
console.error('\nauth timed out'); process.exit(1);
