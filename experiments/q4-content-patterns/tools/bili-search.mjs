// List top Bilibili search results (title, plays, danmaku, link). Usage: node tools/bili-search.mjs "<keyword>"
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const kw = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ locale: 'zh-CN' });
await page.goto('https://search.bilibili.com/video?order=click&keyword=' + encodeURIComponent(kw), { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const rows = await page.evaluate(() => [...document.querySelectorAll('.bili-video-card')].slice(0, 12).map(c => {
  const a = c.querySelector('a[href*="/video/"]'); const t = c.querySelector('.bili-video-card__info--tit');
  const stats = [...c.querySelectorAll('.bili-video-card__stats--item')].map(s => s.innerText.trim());
  return [stats.join(' / '), (t?.innerText || '').trim(), a?.href.split('?')[0]].join(' | ');
}));
console.log(rows.join('\n'));
await browser.close();
