// Screenshot a live deployed Studio game. usage: node shotlive.mjs <url> [out.png]
import { chromium } from 'playwright';
const url = process.argv[2];
const out = process.argv[3] || 'live-shot.png';
const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-certificate-errors'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 }, ignoreHTTPSErrors: true });
await p.goto(url, { waitUntil: 'load', timeout: 30000 });
await p.waitForFunction(() => window.__ready === true, { timeout: 20000 });
await p.evaluate(() => window.__run(160));
await p.screenshot({ path: out });
console.log('shot saved', out);
await b.close();
