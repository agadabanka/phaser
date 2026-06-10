#!/usr/bin/env node
/*
 * studio — the ONE front door (RFC-001 §3). Every entry point the assembly line
 * had (conductor / dispatcher / forge / per-game evals / notes) behind a single
 * CLI. The modules stay where they are; this is the door.
 *
 *   studio new <name>                clone the data-only template -> games/<name>
 *   studio next <game>               what's next (gate + feel + pipeline + brief)
 *   studio run <capability> [args]   dispatch a brick (lookup -> vendor -> run -> VALIDATE; forge-on-miss)
 *   studio lint <game>               the cheap static geometry gate (rules.json)
 *   studio gate <game>               the deterministic 0-death browser gate
 *   studio feel <game>               the FUN model per level
 *   studio check <game>              EVERY applicable validator -> scorecard (--validate-all)
 *   studio ship <game>               railway up from the game dir
 *   studio notes pull|triage         harvest playtest notes from live games / triage to capabilities
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const STUDIO = path.dirname(fileURLToPath(import.meta.url));
const [, , cmd, ...args] = process.argv;
const run = (file, a, opts) => { const r = spawnSync('node', [file, ...(a || [])], { stdio: 'inherit', cwd: STUDIO, ...(opts || {}) }); process.exitCode = r.status ?? 1; return r.status === 0; };
const gameDir = (g) => {
  if (!g) { console.error('which game? (e.g. games/ember)'); process.exit(2); }
  const p = path.isAbsolute(g) ? g : path.join(STUDIO, g.startsWith('games/') ? g : 'games/' + g);
  if (!fs.existsSync(p)) { console.error('no such game: ' + p); process.exit(2); }
  return p;
};

switch (cmd) {
  case 'new': {
    const name = args[0];
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) { console.error('usage: studio new <kebab-name>'); process.exit(2); }
    const dst = path.join(STUDIO, 'games', name);
    if (fs.existsSync(dst)) { console.error('exists: ' + dst); process.exit(1); }
    fs.cpSync(path.join(STUDIO, 'game-template'), dst, { recursive: true, filter: (s) => !/node_modules|\/out\/|\/data\//.test(s) });
    const metaP = path.join(dst, 'GAME_META.json'), meta = JSON.parse(fs.readFileSync(metaP, 'utf8'));
    meta.name = name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    meta.stages = Object.assign({}, meta.stages, { scaffold: true });
    fs.writeFileSync(metaP, JSON.stringify(meta, null, 2) + '\n');
    const pkgP = path.join(dst, 'package.json'), pkg = JSON.parse(fs.readFileSync(pkgP, 'utf8')); pkg.name = name;
    fs.writeFileSync(pkgP, JSON.stringify(pkg, null, 2) + '\n');
    console.log('🎬 games/' + name + ' scaffolded (data + theme + hooks — the runtime lives in the SDK)');
    console.log('   next: studio next games/' + name);
    break;
  }
  case 'next': run(path.join(STUDIO, 'orchestrator', 'conductor.mjs'), [gameDir(args[0])]); break;
  case 'check': run(path.join(STUDIO, 'orchestrator', 'conductor.mjs'), [gameDir(args[0]), '--validate-all']); break;
  case 'run': run(path.join(STUDIO, 'lego', 'dispatch.mjs'), args); break;
  case 'lint': run(path.join(STUDIO, 'tools', 'level-lint', 'validate.mjs'), ['--game', gameDir(args[0])]); break;
  case 'gate': { const g = gameDir(args[0]); run(path.join(g, 'eval.mjs'), [], { cwd: g }); break; }
  case 'feel': run(path.join(STUDIO, 'tools', 'eval', 'feel.mjs'), [gameDir(args[0])]); break;
  case 'ship': { const g = gameDir(args[0]); const r = spawnSync('npx', ['--yes', '@railway/cli', 'up', '--detach'], { stdio: 'inherit', cwd: g }); process.exitCode = r.status ?? 1; break; }
  case 'notes': run(path.join(STUDIO, 'tools', 'notes-loop', 'tool.mjs'), args); break;
  case 'publish': {
    // push the game's subtree to its OWN GitHub repo (the deepfin convention:
    // every game is a standalone repo the hub + issues point at).
    const g = gameDir(args[0]);
    const slug = path.basename(g);
    const meta = JSON.parse(fs.readFileSync(path.join(g, 'GAME_META.json'), 'utf8'));
    const repo = meta.repo || ('agadabanka/' + slug);
    const tok = process.env.GH_TOKEN;
    if (!tok) { console.error('set GH_TOKEN'); process.exit(2); }
    const prefix = path.relative(path.resolve(STUDIO, '..'), g).replace(/\\/g, '/');
    const root = path.resolve(STUDIO, '..');
    console.log('publishing ' + prefix + ' -> ' + repo);
    const split = spawnSync('git', ['subtree', 'split', '--prefix=' + prefix, 'HEAD'], { cwd: root, encoding: 'utf8' });
    if (split.status !== 0) { console.error(split.stderr || 'subtree split failed'); process.exit(1); }
    const sha = split.stdout.trim();
    const r = spawnSync('git', ['push', '--force', 'https://x-access-token:' + tok + '@github.com/' + repo + '.git', sha + ':refs/heads/main'], { cwd: root, stdio: 'inherit' });
    process.exitCode = r.status ?? 1;
    if (r.status === 0) console.log('✅ https://github.com/' + repo);
    break;
  }
  default:
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].split('\n').filter((l) => /studio [a-z]/.test(l)).map((l) => l.replace(/^\s*\*\s?/, '')).join('\n'));
    process.exit(cmd ? 2 : 0);
}
