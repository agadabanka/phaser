/*
 * shots — capture gameplay screenshots for the live games that have no video, so
 * the hub's Play-Store-style page has real imagery (not a blank hero). Generic:
 * loads each live game, nudges it to start (gesture + autopilot if present), hops
 * levels via gotoLevel when available, and writes N PNGs into the hub's
 * public/shots/<game>/ folder. One-off retro cleanup for pre-pipeline games.
 */
import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';

const SHOTS_ROOT = process.env.SHOTS_ROOT || path.join(process.cwd(), 'shots');
const SIZE = { width: 960, height: 540 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// game id → live url (the no-video games)
const GAMES = JSON.parse(process.env.GAMES_JSON || '{}');
const N = +(process.env.SHOTS_N || 4);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--ignore-certificate-errors'] });

for (const [id, url] of Object.entries(GAMES)) {
  const dir = path.join(SHOTS_ROOT, id);
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: SIZE, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  try {
    await page.goto(url + '/?r=webgl', { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('canvas', { timeout: 20000 });
    // wait for the engine's ready flag if it has one, else just settle
    await page.waitForFunction(() => window.__ready === true || true, { timeout: 8000 }).catch(() => {});
    await sleep(1500);
    await page.mouse.click(SIZE.width / 2, SIZE.height / 2);     // dismiss a title / unlock
    await page.keyboard.press('Space').catch(() => {});
    await page.evaluate(() => { try { window.__game && window.__game.autopilot && window.__game.autopilot(true); } catch (e) {} });
    const hasGoto = await page.evaluate(() => !!(window.__game && window.__game.gotoLevel));
    let made = 0;
    for (let i = 0; i < N; i++) {
      if (hasGoto) { await page.evaluate((lv) => { try { window.__game.gotoLevel(lv); window.__game.autopilot(true); } catch (e) {} }, i); await sleep(2600); }
      else await sleep(i === 0 ? 2500 : 3500);
      await page.screenshot({ path: path.join(dir, (i + 1) + '.png') });
      made++;
    }
    console.log('  ✔', id, '→', made, 'shots', hasGoto ? '(level-hopped)' : '(timed)');
  } catch (e) {
    console.log('  ✗', id, e.message.slice(0, 80));
  }
  await ctx.close();
}
await browser.close();
console.log('shots done');
