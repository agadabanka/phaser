// Screenshot a live deployed Studio game. usage: node shotlive.mjs <url> [out.png]
import { chromium } from 'playwright';
const url = process.argv[2];
const out = process.argv[3] || 'live-shot.png';
const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-certificate-errors'] });
const vw = (process.argv[4] || '960x540').split('x');
const p = await b.newPage({ viewport: { width: +vw[0] || 960, height: +vw[1] || 540 }, ignoreHTTPSErrors: true });
await p.goto(url, { waitUntil: 'load', timeout: 30000 });
await p.waitForFunction(() => window.__ready === true, { timeout: 20000 });
await p.evaluate(() => window.__run(160));
await p.screenshot({ path: out, timeout: 90000 });
console.log('shot saved', out);
await b.close();
