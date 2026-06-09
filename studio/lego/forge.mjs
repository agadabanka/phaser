/*
 * The Forge — scaffolds a NEW brick from a template that ALREADY INCLUDES A
 * VALIDATOR, then registers it. This is how the architecture guarantees every
 * brick is born gated: there is no path to a tool that lacks a validate.mjs.
 *
 *   node forge.mjs <capability> <name> [--deps a,b]
 *
 *   - REFUSES if registry.has(capability) (a capability is provided once).
 *   - else copies templates/tool/ -> studio/tools/<name>/,
 *     fills the manifest (capability/name/dir/validator="node validate.mjs"/deps),
 *     and registry.register(it) — which itself THROWS without a validator.
 *   - prints the new dir + "validator included".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { has, register } from './registry.mjs';
import { STUDIO_ROOT } from './vendor.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(HERE, 'templates', 'tool');
const TOOLS_DIR = path.join(STUDIO_ROOT, 'tools');

const [, , capability, name, ...rest] = process.argv;
if (!capability || !name) {
  console.error('usage: node forge.mjs <capability> <name> [--deps a,b]');
  process.exit(2);
}
const depsArg = (rest.find((a) => a.startsWith('--deps')) || '');
const deps = depsArg.includes('=')
  ? depsArg.split('=')[1].split(',').filter(Boolean)
  : (rest[rest.indexOf('--deps') + 1] || '').split(',').filter((d) => d && !d.startsWith('--'));

// 1. refuse a duplicate capability (the registry would also refuse, but fail fast + friendly).
if (has(capability)) {
  console.error(`forge: REFUSED — capability "${capability}" is already provided by a registered brick.`);
  console.error(`       Pick a new capability, or dispatch the existing one: node dispatch.mjs ${capability}`);
  process.exit(1);
}

const toolDir = path.join(TOOLS_DIR, name);
if (fs.existsSync(toolDir)) {
  console.error(`forge: REFUSED — ${path.relative(STUDIO_ROOT, toolDir)} already exists. Remove it or choose another name.`);
  process.exit(1);
}

// 2. copy the template (validator INCLUDED) and fill placeholders.
function fill(s) {
  return s.replace(/__CAPABILITY__/g, capability).replace(/__NAME__/g, name);
}
fs.mkdirSync(toolDir, { recursive: true });
for (const entry of fs.readdirSync(TEMPLATE)) {
  const src = path.join(TEMPLATE, entry);
  const raw = fs.readFileSync(src, 'utf8');
  fs.writeFileSync(path.join(toolDir, entry), fill(raw));
}

// 3. build the concrete manifest from the filled template + CLI deps, then register.
//    (the manifest on disk is the source; we layer deps from the CLI on top.)
const manifest = JSON.parse(fs.readFileSync(path.join(toolDir, 'manifest.json'), 'utf8'));
manifest.dir = path.relative(STUDIO_ROOT, toolDir);
manifest.validator = manifest.validator || 'node validate.mjs';
if (deps.length) manifest.deps = deps;
// persist the deps back to the on-disk manifest so it matches the registry.
fs.writeFileSync(path.join(toolDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

let stored;
try {
  stored = register(manifest); // THROWS if validator missing — it isn't, the template ships one.
} catch (e) {
  // roll back the scaffold so a failed forge leaves nothing half-built.
  fs.rmSync(toolDir, { recursive: true, force: true });
  console.error(`forge: registration failed — ${e.message}`);
  process.exit(1);
}

console.log(`🧱 forged "${capability}" -> ${path.relative(STUDIO_ROOT, toolDir)}`);
console.log(`   validator included: ${stored.validator}  (every brick is born gated)`);
console.log(`   deps: ${stored.deps.length ? stored.deps.join(', ') : '—'}`);
console.log(`   next: node dispatch.mjs ${capability}`);
