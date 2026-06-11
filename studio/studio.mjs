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
 *   studio lens <game>               diagnose FUN through the design lenses (MDA + Schell) → prescriptions
 *   studio check <game>              EVERY applicable validator -> scorecard (--validate-all)
 *   studio ship <game>               railway up from the game dir
 *   studio publish <game> [--public] ENSURE the game's GitHub repo exists (private
 *                                    by default) + push it — every game IS a repo
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
  case 'lens': run(path.join(STUDIO, 'tools', 'design-lens', 'lens.mjs'), [gameDir(args[0]), ...args.slice(1)]); break;
  case 'ship': { const g = gameDir(args[0]); const r = spawnSync('npx', ['--yes', '@railway/cli', 'up', '--detach'], { stdio: 'inherit', cwd: g }); process.exitCode = r.status ?? 1; break; }
  case 'notes': run(path.join(STUDIO, 'tools', 'notes-loop', 'tool.mjs'), args); break;
  case 'publish': {
    // push the game's subtree to its OWN GitHub repo (the deepfin convention:
    // every game is a standalone repo the hub + issues point at). EVERY new game
    // MUST have a repo — so this ENSURES it exists (creates it, private by
    // default) before pushing, rather than assuming someone made it by hand.
    const g = gameDir(args[0]);
    const slug = path.basename(g);
    const meta = JSON.parse(fs.readFileSync(path.join(g, 'GAME_META.json'), 'utf8'));
    const repo = meta.repo || ('agadabanka/' + slug);
    const tok = process.env.GH_TOKEN;
    if (!tok) { console.error('set GH_TOKEN'); process.exit(2); }
    // visibility: private unless the meta opts out or --public is passed (the
    // studio convention is private game repos; deepfin is the public showcase).
    const wantPublic = args.includes('--public') || meta.private === false;
    const [owner, name] = repo.split('/');
    // ghApi(method, apiPath, body?) -> { code, json } via curl (sync, dep-free)
    const ghApi = (method, apiPath, body) => {
      const a = ['-s', '-w', '\n%{http_code}', '-X', method, '-H', 'Authorization: Bearer ' + tok, '-H', 'Accept: application/vnd.github+json'];
      if (body) { a.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body)); }
      a.push('https://api.github.com' + apiPath);
      const r = spawnSync('curl', a, { encoding: 'utf8' });
      const out = (r.stdout || '').trim(); const nl = out.lastIndexOf('\n');
      const code = +out.slice(nl + 1); let json = {}; try { json = JSON.parse(out.slice(0, nl)); } catch {}
      return { code, json };
    };
    // 1) ENSURE the repo exists (create private-by-default on 404)
    const exists = ghApi('GET', '/repos/' + repo).code;
    if (exists === 404) {
      console.log('repo ' + repo + ' missing — creating (' + (wantPublic ? 'public' : 'private') + ')…');
      const me = ghApi('GET', '/user').json.login;
      const create = owner && me && owner.toLowerCase() !== me.toLowerCase()
        ? ghApi('POST', '/orgs/' + owner + '/repos', { name, private: !wantPublic, has_issues: true, description: meta.tagline || meta.name })
        : ghApi('POST', '/user/repos', { name, private: !wantPublic, has_issues: true, description: meta.tagline || meta.name });
      if (create.code >= 300) { console.error('create failed (HTTP ' + create.code + '): ' + (create.json.message || '')); process.exit(1); }
      console.log('✅ created https://github.com/' + repo + ' (' + (create.json.private ? 'private' : 'public') + ')');
    } else if (exists >= 400) { console.error('cannot reach ' + repo + ' (HTTP ' + exists + ')'); process.exit(1); }
    else console.log('repo ' + repo + ' exists — refreshing.');
    // 2) subtree split + force-push the game as its own clean history
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
