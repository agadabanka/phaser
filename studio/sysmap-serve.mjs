// Tiny no-dep static server for the Studio (serves studio/ as web root) so the
// interactive sysmap visualizer + the diary/registry JSON it fetches are reachable.
// Default route -> the sysmap. Used for the studio-sysmap Railway deploy.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const PORT = process.env.PORT || 3000;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.svg': 'image/svg+xml', '.md': 'text/markdown' };
http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}'); }
  // Redirect root to the sysmap dir (with trailing slash) so the page's base URL
  // is /tools/sysmap/ and its relative refs (app.js, ../../diary/diary.json) resolve.
  if (u === '/' || u === '') { res.writeHead(302, { location: '/tools/sysmap/' }); return res.end(); }
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('studio-sysmap on :' + PORT));
