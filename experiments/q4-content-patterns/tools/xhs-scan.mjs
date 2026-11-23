// In the login Chrome: search Xiaohongshu (most popular), open the top notes, read likes / collects / comments.
// Usage: node tools/xhs-scan.mjs "<keyword>" [n]   → prints JSON lines
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const [kw, n = '8'] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = await browser.contexts()[0].newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto('https://www.xiaohongshu.com/search_result?keyword=' + encodeURIComponent(kw) + '&sort=popularity_descending', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
const cards = await page.evaluate(() => [...document.querySelectorAll('section.note-item')].map(s => ({
  title: s.querySelector('.title span, .title')?.innerText?.trim(),
  author: s.querySelector('.author .name, .name')?.innerText?.trim(),
  likes: s.querySelector('.like-wrapper .count, .count')?.innerText?.trim(),
  href: [...s.querySelectorAll('a')].map(a => a.href).find(h => h.includes('xsec_token')) || s.querySelector('a')?.href,
})).filter(c => c.href));
for (const c of cards.slice(0, +n)) {
  await page.goto(c.href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const stats = await page.evaluate(() => {
    const t = (sel) => document.querySelector(sel)?.innerText?.trim();
    return { like: t('.engage-bar .like-wrapper .count'), collect: t('.engage-bar .collect-wrapper .count'), comment: t('.engage-bar .chat-wrapper .count'),
             date: t('.note-content .date, .bottom-container .date'), isVideo: !!document.querySelector('video') };
  });
  console.log(JSON.stringify({ ...c, ...stats, url: page.url().split('?')[0] }));
}
await page.close();
await browser.close().catch(() => {});
