// Screenshot the primary sources quoted in ANSWER.md (real pages, not re-typed).
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const out = resolve(fileURLToPath(new URL('../../../answers/media/q3', import.meta.url)));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });

// 1. VISTA project page: headline claim at the top
await page.goto('https://vista-research.github.io/', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: join(out, '01-vista-headline.png'), clip: { x: 0, y: 0, width: 1100, height: 520 } });

// 2. Same page, last section: the authors' own caveat about the private set
const p = page.locator('p', { hasText: 'the private set remains the real test' });
await p.scrollIntoViewIfNeeded();
await p.evaluate((el) => (el.style.background = '#fff3b0'));
const box = await p.boundingBox();
await page.screenshot({ path: join(out, '02-vista-caveat.png'), clip: { x: 0, y: Math.max(0, box.y - 140), width: 1100, height: box.height + 240 } });

// 3. Chinese media headline
await page.goto('https://m.thepaper.cn/newsDetail_forward_34204446', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.screenshot({ path: join(out, '03-media-headline.png'), clip: { x: 0, y: 0, width: 1100, height: 520 } });
await browser.close();
console.log('ok');
