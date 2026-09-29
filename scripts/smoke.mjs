// Live end-to-end check: loads the built extension, runs two comparisons, prints the rows.
// Not part of `pnpm verify` (needs network and the real venue sites).
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const EXT = resolve('.output/chrome-mv3');
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const NATIVE = '0x0000000000000000000000000000000000000000';
const TRADES = [
  { name: '0.1 ETH Arbitrum -> ETH Base', mode: 'bridge', from: '42161', fromToken: NATIVE, to: '8453', toToken: NATIVE },
  { name: '0.1 ETH -> USDC on Base', mode: 'swap', from: '8453', fromToken: NATIVE, to: '8453', toToken: USDC_BASE },
];

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
await page.goto(`chrome-extension://${id}/sidepanel.html`);

let failed = false;
for (const t of TRADES) {
  await page.check(`input[name="mode"][value="${t.mode}"]`, { force: true });
  await page.selectOption('#fromChain', t.from);
  await page.selectOption('#fromToken', t.fromToken);
  if (t.mode === 'bridge') await page.selectOption('#toChain', t.to);
  await page.selectOption('#toToken', t.toToken);
  await page.fill('#amount', '0.1');
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => {
      const items = [...document.querySelectorAll('#results li')];
      return items.length > 0 && !items.some((li) => li.textContent?.includes('Loading…'));
    },
    null,
    { timeout: 60_000 },
  );
  const rows = await page.$$eval('#results li', (items) => items.map((li) => li.textContent?.replace(/\s+/g, ' ').trim()));
  const venues = new Set(await page.$$eval('#results li.quote .venue', (els) => els.map((e) => e.textContent)));
  console.log(`\n== ${t.name}: ${venues.size} venues quoted`);
  for (const row of rows) console.log('  ', row);
  if (venues.size < 4) failed = true;
}
await context.close();
process.exit(failed ? 1 : 0);
