/*
 * lyria.mjs — generate REAL instrumental music with Google Lyria 2 (Vertex AI)
 * and bake it into a game as a seamless, web-sized loop.
 *
 * This is the GENERATOR behind the "music" capability (the validator lives in
 * tools/studio-sound/). It replaces the old procedural-synth bed with composed
 * audio. Pipeline, all in pure JS (no ffmpeg):
 *   1. Lyria 2 predict  -> ~30s 48kHz stereo WAV (per prompt)
 *   2. downmix to mono, trim leading/trailing near-silence
 *   3. CROSSFADE-LOOP the asset itself (tail faded over head) so it loops
 *      seamlessly through a plain <audio loop> — no Web Audio gymnastics
 *   4. MP3-encode (lamejs) -> ~0.5MB
 *   5. write <out>.mp3 + <out>.json sidecar with MEASURED {duration,rms,peak,
 *      model,prompt} so the validator can prove it's real audio, not silence.
 *
 * Auth: GEMINI_SA_JSON (service account) with cloud-platform scope on a project
 * that has Vertex AI enabled (verified working on project three-game-487605).
 *
 *   node tools/art/lyria.mjs --game games/ember \
 *     --out assets/music/cave.mp3 \
 *     --prompt "dark molten lava cave ambient ..." [--samples 1] [--xfade 1.6]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleAuth } from 'google-auth-library';
import lame from '@breezystack/lamejs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

const gameArg = opt('--game', null);
if (!gameArg) { console.error('usage: node lyria.mjs --game games/<name> [--out assets/music/x.mp3] [--prompt "..."]'); process.exit(2); }
const gameDir = path.isAbsolute(gameArg) ? gameArg : path.join(STUDIO, gameArg);
const outRel = opt('--out', 'assets/music/bed.mp3');
const outAbs = path.join(gameDir, 'src', outRel);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
const samples = Math.max(1, +opt('--samples', '1'));
const xfadeSec = +opt('--xfade', '1.6');

const meta = (() => { try { return JSON.parse(fs.readFileSync(path.join(gameDir, 'GAME_META.json'), 'utf8')); } catch (e) { return {}; } })();
const prompt = opt('--prompt',
  `Looping instrumental background music for a 2D platformer called "${meta.name || 'the game'}": ` +
  `dark molten lava-cave ambience, slow brooding cinematic orchestral drone, warm low strings and ` +
  `soft mallet pulses, distant heartbeat percussion, a faint glowing shimmer, tense but heroic, ` +
  `no vocals, seamless and atmospheric, steady tempo.`);

if (!process.env.GEMINI_SA_JSON) { console.error('lyria: GEMINI_SA_JSON not set'); process.exit(1); }
const sa = JSON.parse(process.env.GEMINI_SA_JSON);
const PROJECT = sa.project_id, LOC = 'us-central1';
const auth = new GoogleAuth({ credentials: sa, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const client = await auth.getClient();

async function lyria(p) {
  const token = (await client.getAccessToken()).token;
  const url = `https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/lyria-002:predict`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [{ prompt: p }], parameters: {} }),
  });
  if (!res.ok) throw new Error(`Lyria ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const pred = (j.predictions || [])[0] || {};
  const b64 = pred.bytesBase64Encoded || pred.audioContent || '';
  if (!b64) throw new Error('Lyria returned no audio: ' + JSON.stringify(Object.keys(pred)));
  return Buffer.from(b64, 'base64');
}

// --- WAV (PCM16) parse, defensive about a bogus/inflated data-size field ---
function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV');
  const ch = buf.readUInt16LE(22), rate = buf.readUInt32LE(24), bits = buf.readUInt16LE(34);
  if (bits !== 16) throw new Error('expected 16-bit PCM, got ' + bits);
  let off = 12, dataOff = 0, dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), sz = buf.readUInt32LE(off + 4);
    if (id === 'data') { dataOff = off + 8; dataLen = Math.min(sz, buf.length - dataOff); break; }
    off += 8 + sz + (sz & 1);
  }
  if (!dataOff) throw new Error('no data chunk');
  const frames = Math.floor(dataLen / 2 / ch);
  const mono = new Float32Array(frames);   // downmix to mono
  for (let i = 0; i < frames; i++) {
    let s = 0; for (let c = 0; c < ch; c++) s += buf.readInt16LE(dataOff + (i * ch + c) * 2);
    mono[i] = s / ch / 32768;
  }
  return { mono, rate, ch };
}

function trimSilence(x, thresh = 0.02) {
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < thresh) a++;
  while (b > a && Math.abs(x[b]) < thresh) b--;
  return x.subarray(Math.max(0, a - 64), Math.min(x.length, b + 64));   // keep a hair of headroom
}

// crossfade-loop: fold the tail (length C) over the head so out[L-1] -> out[0]
// is continuous in the ORIGINAL signal (out[0] == src[N-C], preceded by src[N-C-1]).
function crossfadeLoop(x, C) {
  const N = x.length; C = Math.min(C, Math.floor(N / 3)); const L = N - C;
  const out = new Float32Array(L);
  for (let k = 0; k < C; k++) {
    const t = k / C;                                    // tail fades out, head fades in
    out[k] = x[N - C + k] * (1 - t) + x[k] * t;
  }
  for (let k = C; k < L; k++) out[k] = x[k];
  return out;
}

function stats(x) {
  let peak = 0, ss = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; ss += x[i] * x[i]; }
  return { peak, rms: Math.sqrt(ss / x.length) };
}

function encodeMp3(x, rate, kbps = 128) {
  const enc = new lame.Mp3Encoder(1, rate, kbps);
  const pcm = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) { let s = Math.max(-1, Math.min(1, x[i])); pcm[i] = s < 0 ? s * 32768 : s * 32767; }
  const chunks = []; const B = 1152;
  for (let i = 0; i < pcm.length; i += B) { const buf = enc.encodeBuffer(pcm.subarray(i, i + B)); if (buf.length) chunks.push(Buffer.from(buf)); }
  const end = enc.flush(); if (end.length) chunks.push(Buffer.from(end));
  return Buffer.concat(chunks);
}

console.log(`🎼 Lyria 2 (Vertex, project ${PROJECT}) — generating ${samples} sample(s) for ${meta.name || gameArg}`);
console.log(`   prompt: ${prompt.slice(0, 110)}...`);
let best = null;
for (let i = 0; i < samples; i++) {
  process.stdout.write(`   sample ${i + 1}/${samples} ... `);
  const wav = await lyria(prompt);
  const { mono, rate } = parseWav(wav);
  const trimmed = trimSilence(mono);
  const st = stats(trimmed);
  console.log(`ok (${(trimmed.length / rate).toFixed(1)}s, rms ${st.rms.toFixed(3)}, peak ${st.peak.toFixed(2)})`);
  if (!best || st.rms > best.st.rms) best = { mono: trimmed, rate, st };
}

// normalize to a consistent master level (peak -> 0.95) so the bed is reliably
// present under SFX regardless of how hot Lyria rendered the take.
const pk = stats(best.mono).peak || 1;
const gain = Math.min(8, 0.95 / pk);
for (let i = 0; i < best.mono.length; i++) best.mono[i] *= gain;
const loop = crossfadeLoop(best.mono, Math.round(xfadeSec * best.rate));
const lstat = stats(loop);
const mp3 = encodeMp3(loop, best.rate, 128);
fs.writeFileSync(outAbs, mp3);
const duration = +(loop.length / best.rate).toFixed(2);
const manifest = {
  capability: 'music', kind: 'lyria', model: 'lyria-002', provider: 'vertex-ai',
  file: outRel, prompt, generatedAt: new Date().toISOString(),
  duration, sampleRate: best.rate, channels: 1, bitrateKbps: 128, bytes: mp3.length,
  rms: +lstat.rms.toFixed(4), peak: +lstat.peak.toFixed(4), crossfadeSec: xfadeSec,
};
const sidecar = outAbs.replace(/\.mp3$/, '.json');
fs.writeFileSync(sidecar, JSON.stringify(manifest, null, 2) + '\n');
console.log(`📦 ${path.relative(STUDIO, outAbs)}  (${(mp3.length / 1024).toFixed(0)}kB, ${duration}s seamless loop, rms ${manifest.rms})`);
console.log(`   sidecar: ${path.relative(STUDIO, sidecar)}  ·  wire it: Studio.Audio.music('${outRel}', 0.55)`);
