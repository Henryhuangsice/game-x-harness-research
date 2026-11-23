// In the login Chrome: Douyin video search, list results (likes, title, link). Usage: node tools/dy-scan.mjs "<keyword>" [sort_type: 0 综合 / 1 最多点赞]
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const [kw, sort = '1'] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = await browser.contexts()[0].newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`https://www.douyin.com/search/${encodeURIComponent(kw)}?type=video&sort_type=${sort}`, { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(1000);
  if (await page.locator('a[href*="/video/"]').count() > 4) break;
}
await page.waitForTimeout(2000);
const rows = await page.evaluate(() => {
  const seen = new Set();
  return [...document.querySelectorAll('a[href*="/video/"]')].map(a => {
    const id = a.href.match(/video\/(\d+)/)?.[1]; if (!id || seen.has(id)) return null; seen.add(id);
    return id + ' | ' + a.innerText.replace(/\s+/g, ' ').trim().slice(0, 140);
  }).filter(Boolean).slice(0, 20);
});
console.log(rows.join('\n') || '(no results)');
await page.close();
await browser.close().catch(() => {});
