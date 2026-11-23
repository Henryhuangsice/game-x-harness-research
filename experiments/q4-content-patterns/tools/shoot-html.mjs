// Screenshot local HTML files (the .win element) to PNG. Usage: node tools/shoot-html.mjs <file.html> [out.png]  (default: PNG next to the HTML)
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
const { chromium } = createRequire(join(homedir(), 'Desktop/yuhui-station/package.json'))('playwright-core');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 400 }, deviceScaleFactor: 2 });
const [f, outArg] = process.argv.slice(2);
const out = outArg ? resolve(outArg) : resolve(f).replace(/\.html$/, '.png');
await page.goto('file://' + resolve(f));
await page.locator('.win').screenshot({ path: out });
console.log(out);
await browser.close();
