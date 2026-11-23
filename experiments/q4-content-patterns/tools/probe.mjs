// Probe a page: print title + first chars of text, save a screenshot. Usage: node tools/probe.mjs <url> <out.png> [wait-ms]
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const [url, out, wait = '4000'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, locale: 'zh-CN',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('goto', e.message));
await page.waitForTimeout(+wait);
console.log('URL', page.url()); console.log('TITLE', await page.title());
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 2500));
if (out) await page.screenshot({ path: out });
await browser.close();
