/*
 * __NAME__ — the RUN step for capability "__CAPABILITY__".
 *
 * A brick's run step CONSUMES an input and PRODUCES the artifact(s) declared in
 * manifest.outputs. This is a stub: it writes a minimal, well-formed result.json
 * so the brick is born runnable AND validatable. Replace the TODO with the real
 * generator; keep writing every declared output.
 *
 *   node tool.mjs            # produce out/result.json
 *   node tool.mjs --game DIR  # (per-game caps) operate on a game dir
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });

const gameArg = (() => {
  const i = process.argv.indexOf('--game');
  return i >= 0 ? process.argv[i + 1] : null;
})();

// ── TODO: replace with the real generator for "__CAPABILITY__" ───────────────
// Read your input (a prompt, a sheet, the game dir in `gameArg`, ...) and write
// the declared output(s). The result MUST satisfy validate.mjs's structural check.
const result = {
  capability: '__CAPABILITY__',
  name: '__NAME__',
  game: gameArg || null,
  producedAt: new Date().toISOString(),
  // a real brick fills this with its actual artifact metadata:
  ok: true,
};
// ─────────────────────────────────────────────────────────────────────────────

const outFile = path.join(OUT, 'result.json');
fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n');
console.log(`__NAME__: wrote ${path.relative(HERE, outFile)}`);
