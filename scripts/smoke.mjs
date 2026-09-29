// Live end-to-end check: loads the built extension, runs two comparisons through the real UI, prints each
// venue's card. Not part of `pnpm verify` (needs network and the real venue sites).
// SMOKE_HEADFUL=1 shows the browser; SMOKE_SHOTS=<dir> saves screenshots at panel and pop-out widths.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const EXT = resolve('.output/chrome-mv3');
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const NATIVE = '0x0000000000000000000000000000000000000000';
const TRADES = [
  { name: '0.1 ETH Arbitrum -> ETH Base', from: [42161, NATIVE], to: [8453, NATIVE] },
  { name: '0.1 ETH -> USDC on Base', from: [8453, NATIVE], to: [8453, USDC_BASE] },
];
const SHOTS = process.env.SMOKE_SHOTS;

const context = await chromium.launchPersistentContext('', {
  channel: process.env.SMOKE_CHANNEL ?? 'chrome',
  headless: !process.env.SMOKE_HEADFUL,
  // Playwright disables Chrome's background throttling by default; real users have it on.
  ignoreDefaultArgs: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--disable-features=DisableLoadExtensionCommandLineSwitch'],
});
let [worker] = context.serviceWorkers();
worker ??= await context.waitForEvent('serviceworker', { timeout: 15_000 }).catch(() => undefined);
if (!worker) {
  console.error('Extension did not load. Retry with: pnpm exec playwright install chromium && SMOKE_CHANNEL=chromium pnpm smoke');
  await context.close();
  process.exit(2);
}
const id = new URL(worker.url()).host;
const page = await context.newPage();
await page.setViewportSize({ width: 380, height: 900 });
await page.goto(`chrome-extension://${id}/sidepanel.html`);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

async function pick(side, [chainId, address]) {
  await page.click(`#${side}Pick`);
  await page.click('#chainButton');
  await page.click(`#chainList [data-chain="${chainId}"]`);
  await page.click(`#tokenList button.token[data-address="${address}" i]`);
}

let failed = false;
for (const [i, t] of TRADES.entries()) {
  await pick('from', t.from);
  await pick('to', t.to);
  await page.fill('#amount', '0.1');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.querySelectorAll('#cards li.card').length > 0 && !document.querySelector('#cards li.card.loading'), null, { timeout: 60_000 });
  const cards = await page.$$eval('#cards li.card', (items) => items.map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
  const quoted = await page.$$eval('#cards li.card.quote', (items) => items.length);
  console.log(`\n== ${t.name}: ${quoted} venues quoted`);
  console.log('   summary:', await page.textContent('#summary'));
  for (const card of cards) console.log('  ', card);
  if (quoted < 4) failed = true;
  if (SHOTS) {
    await page.setViewportSize({ width: 380, height: 900 });
    await page.screenshot({ path: `${SHOTS}/panel-${i}.png`, fullPage: true });
    await page.setViewportSize({ width: 1000, height: 780 });
    await page.screenshot({ path: `${SHOTS}/popout-${i}.png`, fullPage: true });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: `${SHOTS}/popout-dark-${i}.png`, fullPage: true });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 380, height: 900 });
  }
}
if (SHOTS) {
  await page.click('#fromPick');
  await page.fill('#tokenSearch', 'usd');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/picker.png` });
  await page.keyboard.press('Escape');
}
await context.close();
process.exit(failed ? 1 : 0);
