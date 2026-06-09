/*
 * studio-sound — the RUN step for capability "music".
 *
 * music is a CHECKER brick (like eval-feel / game-gate): its "output" IS the
 * structural verdict — does the game wire SFX for the key events + a music bed.
 * This wrapper delegates to validate.mjs so `node tool.mjs --game DIR` produces
 * out/result.json (the scorecard). (Run + validator both point at validate.mjs.)
 *
 *   node tool.mjs --game DIR   # scan + score -> out/result.json
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync('node', [path.join(HERE, 'validate.mjs'), ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
