// Checks every built-in token against its chain: the RPC's chain id, and the contract's symbol() and decimals().
// Dev-time only (public RPCs); not part of `pnpm verify`. Run: node scripts/check-tokens.mjs
import { CHAINS, TOKENS, isNative } from '../src/lib/tokens.ts';

const RPC = {
  1: 'https://ethereum-rpc.publicnode.com',
  42161: 'https://arbitrum-one-rpc.publicnode.com',
  8453: 'https://base-rpc.publicnode.com',
  10: 'https://optimism-rpc.publicnode.com',
  137: 'https://polygon-bor-rpc.publicnode.com',
  56: 'https://bsc-rpc.publicnode.com',
  43114: 'https://avalanche-c-chain-rpc.publicnode.com',
  59144: 'https://linea-rpc.publicnode.com',
  324: 'https://mainnet.era.zksync.io',
  534352: 'https://scroll-rpc.publicnode.com',
  81457: 'https://blast-rpc.publicnode.com',
  5000: 'https://mantle-rpc.publicnode.com',
  100: 'https://gnosis-rpc.publicnode.com',
  146: 'https://sonic-rpc.publicnode.com',
  130: 'https://unichain-rpc.publicnode.com',
  80094: 'https://berachain-rpc.publicnode.com',
  4663: 'https://rpc.mainnet.chain.robinhood.com',
};

async function rpc(chainId, method, params) {
  const res = await fetch(RPC[chainId], {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

const call = (chainId, to, data) => rpc(chainId, 'eth_call', [{ to, data }, 'latest']);

function decodeString(hex) {
  const body = hex.slice(2);
  if (body.length === 64) return Buffer.from(body, 'hex').toString('utf8').replace(/\0+$/, ''); // bytes32 symbols
  const length = parseInt(body.slice(64, 128), 16);
  return Buffer.from(body.slice(128, 128 + length * 2), 'hex').toString('utf8');
}

// Display symbols that differ from the contract's own: bridged USDC shows as USDC.e, Tether's USDT0 rebrand as USDT.
const ALIASES = { 'usdc.e': ['usdc'], usdt: ['usdt0', 'usd₮0'] };
const sameSymbol = (onChain, listed) => onChain.toLowerCase() === listed.toLowerCase() || (ALIASES[listed.toLowerCase()] ?? []).includes(onChain.toLowerCase());

let bad = 0;
for (const chain of CHAINS) {
  try {
    const id = parseInt(await rpc(chain.id, 'eth_chainId', []), 16);
    if (id !== chain.id) {
      bad++;
      console.log(`CHAIN ${chain.name}: rpc reports ${id}`);
    }
  } catch (e) {
    bad++;
    console.log(`CHAIN ${chain.name}: ${e.message}`);
  }
}
await Promise.all(
  TOKENS.filter((t) => !isNative(t.address)).map(async (t) => {
    try {
      const [symbolHex, decimalsHex] = await Promise.all([call(t.chainId, t.address, '0x95d89b41'), call(t.chainId, t.address, '0x313ce567')]);
      const symbol = decodeString(symbolHex);
      const decimals = parseInt(decimalsHex, 16);
      if (decimals !== t.decimals || !sameSymbol(symbol, t.symbol)) {
        bad++;
        console.log(`MISMATCH ${t.chainId} ${t.symbol} ${t.address}: chain says ${symbol} / ${decimals}, list says ${t.symbol} / ${t.decimals}`);
      }
    } catch (e) {
      bad++;
      console.log(`FAIL ${t.chainId} ${t.symbol} ${t.address}: ${e.message}`);
    }
  }),
);
console.log(bad ? `${bad} problem(s)` : `all ${TOKENS.length} tokens and ${CHAINS.length} chains check out`);
process.exit(bad ? 1 : 0);
