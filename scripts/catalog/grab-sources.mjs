// Saves the chain and token lists the venues' own pages load, as input for build-catalog.mjs.
// Jumper and Bungee sit behind bot protection, so their lists are captured from a real (headless) page load.
// Run: node scripts/catalog/grab-sources.mjs   (writes scripts/catalog/sources/, which is git-ignored)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'scripts/catalog/sources';
mkdirSync(OUT, { recursive: true });

const relay = await fetch('https://api.relay.link/chains');
writeFileSync(`${OUT}/relay-chains.json`, await relay.text());

const targets = [
  ['https://jumper.xyz/', /api\.jumper\.xyz\/pipeline\/v1\/chains/, 'jumper-v1-chains.json'],
  ['https://jumper.xyz/', /api\.jumper\.xyz\/pipeline\/v1\/tokens(\?|$)/, 'jumper-v1-tokens.json'],
  ['https://app.bungee.exchange/', /backend\.socket\.tech\/v3\/swap\/supported-chains/, 'bungee-swap-supported-chains.json'],
  ['https://app.bungee.exchange/', /backend\.socket\.tech\/v3\/swap\/tokens\/list/, 'bungee-tokens-list.json'],
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const url of new Set(targets.map((t) => t[0]))) {
  const page = await browser.newPage();
  const sizes = new Map();
  page.on('response', async (res) => {
    for (const [, re, file] of targets) {
      if (!re.test(res.url())) continue;
      const text = await res.text().catch(() => '');
      // Pages fetch some lists more than once (e.g. per chain); keep the largest.
      if (text.length > (sizes.get(file) ?? 0)) {
        sizes.set(file, text.length);
        writeFileSync(`${OUT}/${file}`, text);
      }
    }
  });
  await page.goto(url, { waitUntil: 'commit', timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(30_000);
  console.log(url, [...sizes].map(([f, n]) => `${f} ${n}B`).join(', ') || '(nothing captured)');
  await page.close();
}
await browser.close();
