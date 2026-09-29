// Builds src/lib/catalog.ts (chains, which venues support them, popular tokens) and downloads their logos.
// Input: scripts/catalog/sources/ from grab-sources.mjs. Every token is checked on-chain (symbol, decimals)
// through the chain's public RPC; tokens that fail are dropped, and on-chain decimals always win.
// Run: node scripts/catalog/build-catalog.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const SRC = 'scripts/catalog/sources';
const read = (f) => JSON.parse(readFileSync(`${SRC}/${f}`, 'utf8'));
const NATIVE = '0x0000000000000000000000000000000000000000';
const isNative = (a) => /^0x0{40}$|^0xe{40}$/i.test(a);
const norm = (a) => (isNative(a) ? NATIVE : a.toLowerCase());

// Matcha has no public chain list; these are the chains its app configures for swaps and cross-chain
// (read from matcha.xyz's bundle on 2026-09-29: mainnet, polygon, bsc, arbitrum, optimism, avalanche, base,
// scroll, linea, mantle, mode, unichain, plasma, monad, abstract, hyperEvm, robinhoodChain, ink, arc).
const MATCHA = [1, 137, 56, 42161, 10, 43114, 8453, 534352, 59144, 5000, 34443, 130, 9745, 143, 2741, 999, 4663, 57073, 5042];
// Pseudo chain ids some venues use for non-EVM networks or exchange ledgers.
const NOT_EVM = new Set([1337, 3586256, 89999, 1110002, 1110006, 8253038, 728126428]);
// Names we prefer over the venues' spellings.
const NAMES = { 1: 'Ethereum', 56: 'BNB Chain', 324: 'zkSync Era', 999: 'HyperEVM', 4663: 'Robinhood Chain', 747474: 'Katana' };
const MAX_TOKENS = 25;
const MIN_VOLUME = 100_000;

// ---------- chains ----------
const relay = read('relay-chains.json').chains.filter((c) => c.vmType === 'evm' && !c.disabled);
const jr = read('jumper-v1-chains.json');
const jumper = (jr.chains ?? jr).filter((c) => (c.chainType ?? 'EVM') === 'EVM');
const br = read('bungee-swap-supported-chains.json');
const bungee = (br.result ?? br).filter((c) => c.chainType !== 'SOLANA');

const chains = new Map();
const chain = (id) => {
  if (!chains.has(id)) chains.set(id, { id, venues: new Set(), names: [], logos: [], rpcs: [] });
  return chains.get(id);
};
for (const c of relay) {
  const x = chain(c.id);
  x.venues.add('relay');
  x.relaySlug = c.name;
  x.names.push(c.displayName);
  x.logos.push(c.iconUrl ?? c.logoUrl);
  x.rpcs.push(c.httpRpcUrl);
  x.nativeSymbol ??= c.currency?.symbol;
}
for (const c of jumper) {
  const x = chain(c.id);
  x.venues.add('jumper');
  x.names.push(c.name);
  x.logos.push(c.logoURI);
  x.rpcs.push(...(c.metamask?.rpcUrls ?? []));
  x.nativeSymbol ??= c.nativeToken?.symbol ?? c.coin;
}
for (const c of bungee) {
  const x = chain(c.chainId);
  x.venues.add('bungee');
  x.names.push(c.name);
  x.logos.push(c.icon);
  x.nativeSymbol ??= c.currency?.symbol;
}
for (const id of MATCHA) chain(id).venues.add('matcha');

const selected = [...chains.values()]
  .filter((c) => !NOT_EVM.has(c.id) && c.venues.size >= 2)
  .sort((a, b) => b.venues.size - a.venues.size || a.id - b.id);

// ---------- RPC ----------
async function rpc(url, method, params) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(15_000) });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}
async function workingRpcs(c) {
  const ok = [];
  for (const url of new Set(c.rpcs.filter(Boolean))) {
    try {
      if (parseInt(await rpc(url, 'eth_chainId', []), 16) === c.id) ok.push(url);
    } catch {}
  }
  return ok;
}
function decodeString(hex) {
  const body = (hex ?? '0x').slice(2);
  if (body.length === 64) return Buffer.from(body, 'hex').toString('utf8').replace(/\0+$/, '');
  const length = parseInt(body.slice(64, 128), 16);
  return Buffer.from(body.slice(128, 128 + length * 2), 'hex').toString('utf8');
}
/** Tries each working RPC in turn: public endpoints rate-limit or refuse calls at random. */
async function onChain(urls, address) {
  let last;
  for (const url of urls) {
    try {
      return await onChainAt(url, address);
    } catch (e) {
      last = e;
    }
  }
  throw last ?? new Error('no rpc');
}
async function onChainAt(url, address) {
  const [s, d] = await Promise.all([rpc(url, 'eth_call', [{ to: address, data: '0x95d89b41' }, 'latest']), rpc(url, 'eth_call', [{ to: address, data: '0x313ce567' }, 'latest'])]);
  const decimals = parseInt(d, 16);
  if (!Number.isInteger(decimals) || decimals > 36) throw new Error('bad decimals');
  return { symbol: decodeString(s), decimals };
}
async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) {
      const item = items[i++];
      out.push(await fn(item));
    }
  }));
  return out;
}

// ---------- tokens ----------
const jt = read('jumper-v1-tokens.json');
const jumperTokens = jt.tokens ?? jt;
const bt = read('bungee-tokens-list.json');
const bungeeTokens = bt.result ?? bt;
const curated = JSON.parse(readFileSync('scripts/catalog/curated-tokens.json', 'utf8'));

function candidates(c) {
  const byAddress = new Map();
  const add = (t, source, extra = {}) => {
    if (!t?.address || !t.symbol) return;
    const key = norm(t.address);
    const cur = byAddress.get(key) ?? { address: key, sources: new Set(), volume: 0, marketCap: 0 };
    cur.sources.add(source);
    // Keep the first source's casing (curated and Jumper addresses are checksummed); match on lowercase.
    cur.display ??= isNative(t.address) ? NATIVE : t.address;
    cur.symbol ??= t.symbol;
    cur.name ??= t.name;
    cur.coinKey ??= t.coinKey;
    cur.logoURI ??= t.logoURI;
    cur.volume = Math.max(cur.volume, Number(t.volumeUSD24H ?? t.totalVolume ?? 0) || 0);
    cur.marketCap = Math.max(cur.marketCap, Number(t.marketCapUSD ?? t.marketCap ?? 0) || 0);
    Object.assign(cur, extra);
    byAddress.set(key, cur);
  };
  // Curated first, so their symbols (e.g. USDC.e) and logos win.
  for (const t of curated.filter((x) => x.chainId === c.id)) add(t, 'curated', { curated: true, logo: t.logo });
  for (const t of jumperTokens[c.id] ?? []) if (t.verificationStatus !== 'unverified') add(t, 'jumper');
  for (const t of bungeeTokens[c.id] ?? []) if (t.isVerified || t.isShortListed) add(t, 'bungee');
  const r = relay.find((x) => x.id === c.id);
  for (const t of [...(r?.featuredTokens ?? []), ...(r?.erc20Currencies ?? [])]) add({ ...t, logoURI: t.metadata?.logoURI }, 'relay', { featured: true });
  const list = [...byAddress.values()].filter(
    (t) =>
      t.address === NATIVE ||
      t.curated ||
      t.featured ||
      (t.sources.size >= 2 && (t.volume >= MIN_VOLUME || t.marketCap >= 10_000_000)) ||
      // One venue's verified list is enough for a token that trades seriously (newer chains only Relay and Jumper serve).
      t.volume >= 1_000_000 ||
      t.marketCap >= 50_000_000,
  );
  const rank = (t) => (t.address === NATIVE ? 0 : t.curated ? 1 : 2);
  return list.sort((a, b) => rank(a) - rank(b) || b.volume - a.volume).slice(0, MAX_TOKENS);
}

const logoKey = (t) => (t.logo ? t.logo.replace(/\.\w+$/, '') : (t.coinKey ?? t.symbol).toLowerCase().replace(/[^a-z0-9]+/g, '-'));

const chainsOut = [];
const tokensOut = [];
const logoJobs = new Map(); // key -> { chainId, address, uri }
for (const c of selected) {
  const urls = await workingRpcs(c);
  if (urls.length === 0) {
    console.log(`skip ${c.id} ${c.names[0]}: no working RPC`);
    continue;
  }
  const list = candidates(c);
  const checked = await pool(list, 4, async (t) => {
    if (t.address === NATIVE) return { ...t, symbol: t.symbol ?? c.nativeSymbol, decimals: 18 };
    try {
      const real = await onChain(urls, t.address);
      return { ...t, decimals: real.decimals, onChainSymbol: real.symbol };
    } catch {
      return null;
    }
  });
  const kept = checked.filter(Boolean);
  if (!kept.some((t) => t.address === NATIVE)) kept.unshift({ address: NATIVE, symbol: c.nativeSymbol ?? 'ETH', name: c.nativeSymbol, decimals: 18, sources: new Set() });
  const order = new Map(list.map((t, i) => [t.address, i]));
  kept.sort((a, b) => (order.get(a.address) ?? -1) - (order.get(b.address) ?? -1));
  const id = c.id;
  chainsOut.push({ id, name: NAMES[id] ?? c.names.find(Boolean), relaySlug: c.relaySlug, venues: [...c.venues].sort(), logo: `${id}` });
  for (const t of kept) {
    const key = logoKey(t);
    if (!logoJobs.has(key)) logoJobs.set(key, { chainId: id, address: t.address, uri: t.logoURI });
    tokensOut.push({ chainId: id, address: t.display ?? t.address, symbol: t.symbol.trim(), name: (t.name ?? t.symbol).trim(), decimals: t.decimals, logo: key });
  }
  console.log(`${id} ${chainsOut.at(-1).name}: ${kept.length} tokens (${checked.filter((t) => t === null).length} failed the on-chain check), venues ${[...c.venues].join('+')}`);
}

// ---------- logos ----------
const TYPES = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' };
async function download(urls, dir, name) {
  mkdirSync(`public/logos/${dir}`, { recursive: true });
  const existing = readdirSync(`public/logos/${dir}`).find((f) => f.replace(/\.\w+$/, '') === name);
  if (existing) return existing;
  for (const u of urls.filter(Boolean)) {
    try {
      const res = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15_000) });
      const ext = TYPES[(res.headers.get('content-type') ?? '').split(';')[0].trim()];
      const buf = Buffer.from(await res.arrayBuffer());
      if (!res.ok || !ext || buf.length < 200) continue;
      writeFileSync(`public/logos/${dir}/${name}.${ext}`, buf);
      return `${name}.${ext}`;
    } catch {}
  }
  return undefined;
}

const tokenLogo = new Map();
await pool([...logoJobs], 8, async ([key, job]) => {
  const small = job.address === NATIVE ? [] : [`https://token-icons.llamao.fi/icons/tokens/${job.chainId}/${job.address}?h=64&w=64`];
  tokenLogo.set(key, await download([...small, job.uri], 'tokens', key));
});
await pool(chainsOut, 8, async (c) => {
  const src = selected.find((x) => x.id === c.id);
  c.logo = (await download([...src.logos], 'chains', String(c.id))) ?? `${c.id}.png`;
});
for (const t of tokensOut) t.logo = tokenLogo.get(t.logo) ?? undefined;

// ---------- write ----------
const lines = [
  '// Generated by scripts/catalog/build-catalog.mjs. Do not edit by hand; re-run the script instead.',
  `// ${chainsOut.length} chains supported by at least two venues, ${tokensOut.length} tokens checked on-chain.`,
  "import type { Chain, Token } from '../types';",
  '',
  `export const CHAINS: readonly Chain[] = ${JSON.stringify(chainsOut, null, 2)};`,
  '',
  `export const TOKENS: readonly Token[] = ${JSON.stringify(tokensOut)};`,
  '',
];
writeFileSync('src/lib/catalog.ts', lines.join('\n').replace(/"(\w+)":/g, '$1:'));
const missing = tokensOut.filter((t) => !t.logo).length;
console.log(`\nwrote src/lib/catalog.ts: ${chainsOut.length} chains, ${tokensOut.length} tokens; ${missing} tokens without a logo (monogram fallback)`);
if (existsSync('public/logos/chains')) console.log('chain logos present:', readdirSync('public/logos/chains').length);
