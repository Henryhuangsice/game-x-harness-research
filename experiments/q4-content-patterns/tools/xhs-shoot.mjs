// In the login Chrome: search Xiaohongshu, screenshot the result grid, then open chosen notes (by id) and screenshot them.
// Usage: node tools/xhs-shoot.mjs "<keyword>" <grid-name|-> [<noteId>=<name> ...]
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const out = resolve(fileURLToPath(new URL('../../../answers/media/q4', import.meta.url)));
const [kw, grid, ...picks] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = await browser.contexts()[0].newPage();
await page.setViewportSize({ width: 1280, height: 900 });
const search = async () => {
  await page.goto('https://www.xiaohongshu.com/search_result?keyword=' + encodeURIComponent(kw) + '&sort=popularity_descending', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
};
await search();
if (grid !== '-') { await page.screenshot({ path: join(out, grid + '.png') }); console.log(grid); }
for (const p of picks) {
  const [id, name] = p.split('=');
  const card = page.locator(`section.note-item a[href*="${id}"]:visible`).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.waitForTimeout(4500);
  await page.screenshot({ path: join(out, name + '.png') });
  console.log(name, page.url().split('?')[0]);
  await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
  if (!page.url().includes('search_result')) await search();
}
await page.close();
await browser.close().catch(() => {});
