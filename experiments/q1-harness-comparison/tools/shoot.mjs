// Screenshot every media/evidence/*.html to a PNG (uses the installed Google Chrome via playwright-core).
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const dir = resolve(fileURLToPath(new URL('../evidence-html', import.meta.url)));
const png = resolve(fileURLToPath(new URL('../../../answers/media/q1', import.meta.url)));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 400 }, deviceScaleFactor: 2 });
for (const f of readdirSync(dir).filter((f) => f.endsWith('.html'))) {
  await page.goto('file://' + join(dir, f));
  await page.locator('.win').screenshot({ path: join(png, f.replace('.html', '.png')) });
  console.log(f.replace('.html', '.png'));
}
await browser.close();
