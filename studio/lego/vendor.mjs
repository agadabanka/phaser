/*
 * ensure-vendor — restore a brick's runtime deps before validating.
 *
 * GOTCHA this fixes: the tools' vendored phaser.min.js is gitignored in some tool
 * dirs, so a fresh clone / git reset wipes it and the tool's headless validator
 * 404s with "Phaser is not defined". This copies the canonical vendor files from
 * studio/games/ember/src/vendor/ into a tool dir when (and only when) absent — so
 * a brick is runnable from a fresh checkout. Idempotent: present files are left
 * untouched.
 *
 *   import { ensureVendor } from './vendor.mjs';
 *   ensureVendor('/abs/path/to/tools/<name>');
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// studio/lego -> studio root is one level up.
export const STUDIO_ROOT = path.resolve(HERE, '..');
const VENDOR_SRC = path.join(STUDIO_ROOT, 'games', 'ember', 'src', 'vendor');

// the runtime deps a headless brick needs in its own dir to load index.html.
const VENDOR_FILES = ['phaser.min.js', 'studio.js'];

/**
 * Ensure VENDOR_FILES exist in `toolDir`, copying any missing one from the
 * canonical ember vendor. Returns the list of files actually copied (for logging).
 * Skips files the tool doesn't reference and skips when the source is absent.
 */
export function ensureVendor(toolDir) {
  const copied = [];
  // Only web bricks (an index.html that loads phaser/studio.js) need vendored deps.
  // Pure-node bricks (e.g. scorers like feel/gate, or a freshly-forged stub) have
  // no index.html and need NOTHING — never litter them with vendor files.
  const indexHtml = path.join(toolDir, 'index.html');
  if (!fs.existsSync(indexHtml)) return copied;
  const html = fs.readFileSync(indexHtml, 'utf8');
  for (const f of VENDOR_FILES) {
    if (!html.includes(f)) continue;                   // tool doesn't reference it
    const dest = path.join(toolDir, f);
    if (fs.existsSync(dest)) continue;                 // already present — leave it
    const src = path.join(VENDOR_SRC, f);
    if (!fs.existsSync(src)) continue;                 // no canonical source — skip
    fs.copyFileSync(src, dest);
    copied.push(f);
  }
  return copied;
}
