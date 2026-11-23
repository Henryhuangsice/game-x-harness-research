// In the login Chrome: open each URL and screenshot the viewport. Usage: node tools/cdp-shoot.mjs <url>=<name> ... (saved to media/q4/<name>.png)
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const out = resolve(fileURLToPath(new URL('../../../answers/media/q4', import.meta.url)));
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = await browser.contexts()[0].newPage();
await page.setViewportSize({ width: 1280, height: 900 });
for (const arg of process.argv.slice(2)) {
  const i = arg.lastIndexOf('='); const url = arg.slice(0, i), name = arg.slice(i + 1);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => document.querySelectorAll('video').forEach(v => v.pause()));
  await page.screenshot({ path: join(out, name + '.png') });
  console.log(name, '|', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300));
}
await page.close();
await browser.close().catch(() => {});
