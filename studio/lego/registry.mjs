/*
 * The Lego Registry — the executable index of bricks (tools).
 *
 * A brick = a manifest + a run step + a REQUIRED validate(). This module is the
 * single gate that enforces the invariant: register() THROWS if a manifest has no
 * validator, so an ungated brick can never enter the registry (and therefore can
 * never be dispatched).
 *
 * Backed by registry.json (next to this file). Writes are atomic (tmp + rename)
 * so a crashed/concurrent write never leaves a half-written registry.
 *
 *   import { lookup, has, list, register } from './registry.mjs';
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REGISTRY_PATH = path.join(HERE, 'registry.json');

function load() {
  if (!fs.existsSync(REGISTRY_PATH)) return { tools: [] };
  const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  if (!Array.isArray(data.tools)) data.tools = [];
  return data;
}

// atomic write: serialize to a sibling tmp file, then rename over the target.
function save(data) {
  const tmp = REGISTRY_PATH + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, REGISTRY_PATH);
}

/** Every registered manifest. */
export function list() {
  return load().tools;
}

/** True iff a brick provides `capability`. */
export function has(capability) {
  return load().tools.some((t) => t.capability === capability);
}

/** The manifest providing `capability`, or null. */
export function lookup(capability) {
  return load().tools.find((t) => t.capability === capability) || null;
}

/**
 * Register a brick. THE INVARIANT LIVES HERE: a manifest is only registerable if
 * it declares a non-empty `validator`. Also requires capability + name + dir, and
 * refuses to double-register a capability (use a fresh capability or remove first).
 * Returns the stored manifest.
 */
export function register(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('register: a manifest object is required');
  }
  const { capability, name, dir } = manifest;
  // ── THE GATE (enforced FIRST — it is the entire point of the architecture) ──
  // No validator => not a brick. Checked before name/dir so the invariant is the
  // reason any unvalidated manifest is refused.
  if (typeof manifest.validator !== 'string' || manifest.validator.trim() === '') {
    throw new Error(
      `register("${capability || '?'}"): REFUSED — a tool is only registerable if it has a ` +
      `validator. manifest.validator is missing/empty. Every brick must be born gated.`
    );
  }
  // ─────────────────────────────────────────────────────────────────────────
  if (!capability || typeof capability !== 'string') {
    throw new Error('register: manifest.capability is required');
  }
  if (!name || typeof name !== 'string') {
    throw new Error(`register("${capability}"): manifest.name is required`);
  }
  if (!dir || typeof dir !== 'string') {
    throw new Error(`register("${capability}"): manifest.dir is required`);
  }
  const data = load();
  if (data.tools.some((t) => t.capability === capability)) {
    throw new Error(
      `register("${capability}"): already registered (by tool "${lookup(capability).name}"). ` +
      `Pick a new capability or remove the existing one first.`
    );
  }
  // normalise: store a full manifest with sane defaults + the gate flag.
  const stored = {
    capability,
    name,
    dir,
    run: manifest.run || '',
    validator: manifest.validator,
    inputs: manifest.inputs || '',
    outputs: Array.isArray(manifest.outputs) ? manifest.outputs : [],
    deps: Array.isArray(manifest.deps) ? manifest.deps : [],
    deterministic: manifest.deterministic === true,
    hasValidator: true,
  };
  data.tools.push(stored);
  save(data);
  return stored;
}
