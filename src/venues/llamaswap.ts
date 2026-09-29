import { isRecord, isUint, num } from '../lib/json';
import { isNative, NATIVE, sameToken, venueAddress } from '../lib/tokens';
import type { Address, Capture, Quote, Trade } from '../types';
import { readKyberRoutes } from './kyberswap';
import type { VenueAdapter } from './types';
import { compact, intParam, sellAmountMatches } from './url';

/** Chain -> swap.defillama.com `chain` parameter, each confirmed on the page's chain picker (2026-09-29). */
const CHAINS: ReadonlyMap<number, string> = new Map([
  [1, 'ethereum'],
  [56, 'bsc'],
  [137, 'polygon'],
  [10, 'optimism'],
  [42161, 'arbitrum'],
  [43114, 'avax'],
  [8453, 'base'],
  [59144, 'linea'],
  [534352, 'scroll'],
  [146, 'sonic'],
  [80094, 'berachain'],
  [130, 'unichain'],
  [999, 'hyperevm'],
  [143, 'monad'],
  [9745, 'plasma'],
]);

interface ParaSwapPrice {
  priceRoute?: {
    destAmount?: string;
    destUSD?: string;
    gasCostUSD?: string;
    partnerFee?: number;
    bestRoute?: { swaps?: { swapExchanges?: { exchange?: string }[] }[] }[];
  };
}

const asAddress = (s: string | null): Address | undefined => (s && /^0x[0-9a-fA-F]{40}$/.test(s) ? ((isNative(s) ? NATIVE : s) as Address) : undefined);

/** A ParaSwap (Velora) price the LlamaSwap page fetched: null when it is for another trade. */
function readParaSwapPrice(capture: Capture, trade: Trade): Quote[] | null {
  const p = new URL(capture.url).searchParams;
  if (trade.fromChainId !== trade.toChainId || intParam(p, 'network') !== trade.toChainId || p.get('side') !== 'SELL') return null;
  if (!sameToken(p.get('srcToken') ?? '', trade.fromToken.address) || !sameToken(p.get('destToken') ?? '', trade.toToken.address)) return null;
  if (!sellAmountMatches(p.get('amount'), trade)) return null;
  const decimals = trade.toToken.decimals ?? intParam(p, 'destDecimals');
  if (decimals === undefined) return null;
  const body = JSON.parse(capture.text) as unknown;
  if (!isRecord(body)) throw new Error('ParaSwap: unexpected response');
  const route = (body as ParaSwapPrice).priceRoute;
  const amount = route?.destAmount;
  if (!route || !isUint(amount)) return [];
  const exchanges = [
    ...new Set((route.bestRoute ?? []).flatMap((r) => r.swaps ?? []).flatMap((s) => s.swapExchanges ?? []).map((e) => e.exchange).filter((e): e is string => typeof e === 'string')),
  ];
  const partnerFee = route.partnerFee ?? 0;
  return [
    {
      venue: 'llamaswap',
      route: `ParaSwap: ${exchanges.slice(0, 3).join(' + ') || 'route'}`,
      toAmount: amount,
      toDecimals: decimals,
      toAmountUsd: num(route.destUSD),
      gasUsd: num(route.gasCostUSD),
      venueFee: partnerFee > 0 ? { label: 'Partner fee', pct: partnerFee } : { label: 'None', usd: 0 },
    },
  ];
}

/**
 * LlamaSwap (DefiLlama) asks several aggregators from the browser and shows the best. Its page calls KyberSwap and
 * ParaSwap (Velora) directly, so its card reads those responses; the controller keeps one per endpoint.
 */
export const llamaswap: VenueAdapter = {
  id: 'llamaswap',
  label: 'LlamaSwap',
  host: 'swap.defillama.com',
  timeoutMs: 40_000,
  swapOnly: true,
  chains: CHAINS,
  // The page ignores an amount in its URL; the sell field starts empty.
  amountInput: { selector: 'input[placeholder="0"]', afterMs: 6_000 },

  buildUrl(trade: Trade): string {
    const chain = CHAINS.get(trade.fromChainId);
    if (!chain) throw new Error(`LlamaSwap does not list chain ${trade.fromChainId}`);
    const p = new URLSearchParams({ chain, from: venueAddress(trade.fromToken.address, NATIVE), to: venueAddress(trade.toToken.address, NATIVE), tab: 'swap' });
    return `https://swap.defillama.com/?${p}`;
  },

  parseUrl(url: URL) {
    if (url.hostname !== 'swap.defillama.com') return null;
    const p = url.searchParams;
    const chainId = [...CHAINS].find(([, s]) => s === p.get('chain'))?.[0];
    return compact({ fromChainId: chainId, toChainId: chainId, fromToken: asAddress(p.get('from')), toToken: asAddress(p.get('to')) });
  },

  matches(url: URL) {
    const kyber = url.hostname === 'aggregator-api.kyberswap.com' && /^\/[a-z0-9-]+\/api\/v1\/routes$/.test(url.pathname);
    const paraswap = url.hostname === 'apiv5.paraswap.io' && /^\/prices\/?$/.test(url.pathname);
    return kyber || paraswap;
  },

  parse(capture: Capture, trade: Trade) {
    const host = new URL(capture.url).hostname;
    if (host === 'apiv5.paraswap.io') return readParaSwapPrice(capture, trade);
    return readKyberRoutes(capture, trade, 'llamaswap', 'KyberSwap: ');
  },
};
