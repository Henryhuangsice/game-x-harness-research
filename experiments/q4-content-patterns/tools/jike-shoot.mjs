// In the login Chrome: open a 即刻 topic's 热门 tab, find the post containing <text>, screenshot it, then open it to get its URL.
// Usage: node tools/jike-shoot.mjs <topicId> "<text in post>" <name>
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const out = resolve(fileURLToPath(new URL('../../../answers/media/q4', import.meta.url)));
const [topic, text, name] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = await browser.contexts()[0].newPage();
try {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`https://web.okjike.com/topic/${topic}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await page.getByText('热门', { exact: true }).first().click();
  await page.waitForTimeout(5000);
  const hit = page.getByText(text).first();
  for (let i = 0; i < 12 && !(await hit.count()); i++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(1500); }
  await hit.scrollIntoViewIfNeeded();
  // walk up to the card: the nearest ancestor that also contains the author link
  const card = hit.locator('xpath=ancestor::div[.//a[contains(@href,"/u/")]][1]');
  await card.screenshot({ path: join(out, name + '.png') });
  console.log(name, await card.evaluate(e => e.getBoundingClientRect().height));
  await hit.click(); await page.waitForTimeout(4000);
  console.log('URL', page.url());
} finally { await page.close(); await browser.close().catch(() => {}); }
