// Attach to the login Chrome (port 9333), open a URL in a new tab, print text, optional screenshot. Usage: node tools/cdp-probe.mjs <url> [out.png] [wait]
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const [url, out, wait = '6000'] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('goto', e.message));
await page.waitForTimeout(+wait);
console.log('URL', page.url());
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 3000));
if (out) await page.screenshot({ path: out });
await page.close();
await browser.close().catch(() => {}); // disconnect only
