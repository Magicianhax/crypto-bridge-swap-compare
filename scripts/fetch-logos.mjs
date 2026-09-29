// Downloads chain, token and venue logos into public/logos so the extension never loads images remotely.
// Dev-time only; re-run when CHAINS or TOKENS gain a new logo key. Run: node scripts/fetch-logos.mjs
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { CHAINS, TOKENS } from '../src/lib/tokens.ts';

const TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';

const CHAIN_SRC = {
  ethereum: `${TW}/ethereum/info/logo.png`,
  arbitrum: `${TW}/arbitrum/info/logo.png`,
  base: `${TW}/base/info/logo.png`,
  optimism: `${TW}/optimism/info/logo.png`,
  polygon: `${TW}/polygon/info/logo.png`,
  bnb: `${TW}/smartchain/info/logo.png`,
  avalanche: `${TW}/avalanchec/info/logo.png`,
  linea: `${TW}/linea/info/logo.png`,
  zksync: `${TW}/zksync/info/logo.png`,
  scroll: `${TW}/scroll/info/logo.png`,
  blast: `${TW}/blast/info/logo.png`,
  mantle: `${TW}/mantle/info/logo.png`,
  gnosis: `${TW}/xdai/info/logo.png`,
  sonic: `${TW}/sonic/info/logo.png`,
  unichain: `${TW}/unichain/info/logo.png`,
  berachain: `${TW}/berachain/info/logo.png`,
};

const eth = (a) => `${TW}/ethereum/assets/${a}/logo.png`;
const TOKEN_SRC = {
  eth: `${TW}/ethereum/info/logo.png`,
  usdc: eth('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  usdt: eth('0xdAC17F958D2ee523a2206206994597C13D831ec7'),
  dai: eth('0x6B175474E89094C44Da98b954EedeAC495271d0F'),
  wbtc: eth('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'),
  cbbtc: `${TW}/base/assets/0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf/logo.png`,
  wsteth: eth('0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0'),
  usde: eth('0x4c9EDD5852cd905f086C759E8383e09bff1E68B3'),
  link: eth('0x514910771AF9Ca656af840dff83E8264EcF986CA'),
  uni: eth('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'),
  arb: `${TW}/arbitrum/info/logo.png`,
  pol: `${TW}/polygon/info/logo.png`,
  op: `${TW}/optimism/info/logo.png`,
  cbeth: eth('0xBe9895146f7AF43049ca1c1AE358B0541Ea49704'),
  aero: `${TW}/base/assets/0x940181a94A35A4569E4529A3CDfB74e38FD98631/logo.png`,
  bnb: `${TW}/smartchain/info/logo.png`,
  btcb: `${TW}/smartchain/assets/0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c/logo.png`,
  cake: `${TW}/smartchain/assets/0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82/logo.png`,
  avax: `${TW}/avalanchec/info/logo.png`,
  zk: `${TW}/zksync/assets/0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E/logo.png`,
  scr: `${TW}/scroll/info/logo.png`,
  usdb: `${TW}/blast/assets/0x4300000000000000000000000000000000000003/logo.png`,
  blast: `${TW}/blast/info/logo.png`,
  mnt: `${TW}/mantle/info/logo.png`,
  meth: `${TW}/mantle/assets/0xcDA86A272531e8640cD7F1a92c01839911B90bb0/logo.png`,
  xdai: `${TW}/xdai/info/logo.png`,
  gno: eth('0x6810e776880C02933D47DB1b9fc05908e5386b96'),
  s: `${TW}/sonic/info/logo.png`,
  bera: `${TW}/berachain/info/logo.png`,
};

// Venue marks: each site's own icon.
const VENUE_SRC = {
  jumper: ['https://jumper.xyz/favicon.ico', 'https://jumper.xyz/apple-touch-icon.png'],
  bungee: ['https://app.bungee.exchange/favicon.ico', 'https://www.bungee.exchange/apple-touch-icon.png'],
  relay: ['https://relay.link/apple-touch-icon.png', 'https://relay.link/favicon.ico'],
  matcha: ['https://matcha.xyz/apple-touch-icon.png', 'https://matcha.xyz/favicon.svg'],
};

const IMAGE_TYPES = { 'image/png': 'png', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/svg+xml': 'svg', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

async function download(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!res.ok || !IMAGE_TYPES[type]) throw new Error(`${res.status} ${type}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), ext: IMAGE_TYPES[type] };
}

const report = [];
async function save(dir, name, urls) {
  mkdirSync(`public/logos/${dir}`, { recursive: true });
  for (const url of [urls].flat()) {
    try {
      const { bytes, ext } = await download(url);
      writeFileSync(`public/logos/${dir}/${name}.${ext}`, bytes);
      report.push(`ok   ${dir}/${name}.${ext} ${bytes.length}B`);
      return;
    } catch (e) {
      report.push(`miss ${dir}/${name} ${url} (${e.message})`);
    }
  }
}

const needed = new Set(TOKENS.map((t) => t.logo?.replace(/\.\w+$/, '')).filter(Boolean));
await Promise.all([
  ...CHAINS.map((c) => save('chains', c.logo.replace(/\.\w+$/, ''), CHAIN_SRC[c.logo.replace(/\.\w+$/, '')] ?? [])),
  ...[...needed].map((key) => save('tokens', key, TOKEN_SRC[key] ?? [])),
  ...Object.entries(VENUE_SRC).map(([name, urls]) => save('venues', name, urls)),
]);
console.log(report.sort().join('\n'));
const missingKeys = [...needed].filter((k) => !TOKEN_SRC[k]);
if (missingKeys.length) console.log('no source for token logos:', missingKeys.join(', '));
if (!existsSync('public/logos/venues')) process.exit(1);
