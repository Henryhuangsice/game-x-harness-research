// Screenshot the real pages cited in q4.md into media/q4/. Run: node tools/shoot-q4.mjs
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const out = resolve(fileURLToPath(new URL('../../../answers/media/q4', import.meta.url)));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, locale: 'zh-CN',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
const go = async (url, wait = 5000) => {
  try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
  catch { await page.waitForTimeout(3000); await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); } // one retry: some blogs drop the first connection
  await page.waitForTimeout(wait);
};

// name → tweet id; names with a folder go there instead of media/q4 (Chollet's tweet is cited in q3)
const tweets = { 'x-karpathy-vibe-coding': '1886192184808149383', 'x-anthropic-pokemon': '1894419011569344978', '../q3/x-chollet-demo-set': '2088254592182305165' };
for (const [name, id] of Object.entries(tweets)) {
  await page.setViewportSize({ width: 560, height: 900 });
  await go(`https://platform.twitter.com/embed/Tweet.html?id=${id}&lang=en`, 6000);
  await page.locator('article').first().screenshot({ path: join(out, name + '.png') });
  console.log(name);
}
await page.setViewportSize({ width: 1280, height: 900 });

// Bilibili video pages (top of page: title, plays, danmaku, likes/coins/favorites/shares)
const vids = { 'bili-doubao-mc': 'BV1EDFezjEdY', 'bili-nine-ai-bridge': 'BV1JkWH64ESy', 'bili-claude-code-8min': 'BV1KjoxBoEQJ', 'bili-retitled-course': 'BV17P411m7Ma' };
for (const [name, bv] of Object.entries(vids)) {
  await go(`https://www.bilibili.com/video/${bv}/`, 7000);
  await page.keyboard.press('Escape').catch(() => {});
  await page.screenshot({ path: join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 860 } });
  console.log(name);
}

// Long-form blog posts: top of the article
for (const [name, url] of Object.entries({ 'blog-anthropic-effective-agents': 'https://www.anthropic.com/engineering/building-effective-agents', 'blog-gemini-plays-pokemon': 'https://blog.jcz.dev/the-making-of-gemini-plays-pokemon' })) {
  await go(url, 9000); await page.mouse.wheel(0, 200); await page.waitForTimeout(2000); await page.mouse.wheel(0, -200); await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, name + '.png'), clip: { x: 0, y: 0, width: 1280, height: 860 } });
  console.log(name);
}
await browser.close();
