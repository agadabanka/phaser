/*
 * studio-art — the RUN step for capability "art-cohesion".
 *
 * art-cohesion is a JUDGE brick (like eval-feel / game-gate): its "output" IS the
 * scored verdict, so the run step and the validator are the same act — capture the
 * game's frames and score visual cohesion. This wrapper simply delegates to
 * validate.mjs so `node tool.mjs --game DIR` produces out/result.json (the
 * scorecard) exactly as the gate does. (The registry's run + validator both point
 * at validate.mjs for this reason.)
 *
 *   node tool.mjs --game DIR   # capture + score -> out/result.json
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync('node', [path.join(HERE, 'validate.mjs'), ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
