import { isRecord, isUint, num } from '../lib/json';
import { EEEE, isNative, NATIVE, sameToken, venueAddress } from '../lib/tokens';
import type { Address, Capture, Quote, Trade, VenueId } from '../types';
import type { VenueAdapter } from './types';
import { compact, sellAmountMatches } from './url';

/** Chain -> kyberswap.com path segment, each confirmed by loading kyberswap.com/swap/<slug> (2026-09-29). */
const CHAINS: ReadonlyMap<number, string> = new Map([
  [1, 'ethereum'],
  [56, 'bnb'],
  [137, 'polygon'],
  [42161, 'arbitrum'],
  [10, 'optimism'],
  [43114, 'avalanche'],
  [8453, 'base'],
  [59144, 'linea'],
  [2020, 'ronin'],
  [130, 'unichain'],
  [999, 'hyperevm'],
  [9745, 'plasma'],
  [4326, 'megaeth'],
  [4663, 'robinhood'],
]);
/** The routes API names BNB Chain "bsc" while the page says "bnb". */
const API_SLUG: Record<string, string> = { bnb: 'bsc' };

interface KyberHop { exchange?: string }
interface KyberRoute {
  data?: { routeSummary?: { amountIn?: string; amountOut?: string; amountOutUsd?: string; gasUsd?: string; route?: KyberHop[][]; extraFee?: { feeAmount?: string } } };
}

/**
 * Reads a KyberSwap routes response for this trade: null when it is for another trade, [] when it has no route.
 * Shared with LlamaSwap, whose page asks KyberSwap too; `prefix` names the source in the route label.
 */
export function readKyberRoutes(capture: Capture, trade: Trade, venue: VenueId, prefix = ''): Quote[] | null {
  const url = new URL(capture.url);
  const slug = CHAINS.get(trade.toChainId);
  if (trade.fromChainId !== trade.toChainId || !slug) return null;
  if (url.pathname.split('/')[1] !== (API_SLUG[slug] ?? slug)) return null;
  const p = url.searchParams;
  if (!sameToken(p.get('tokenIn') ?? '', trade.fromToken.address) || !sameToken(p.get('tokenOut') ?? '', trade.toToken.address)) return null;
  if (!sellAmountMatches(p.get('amountIn'), trade)) return null;
  const decimals = trade.toToken.decimals;
  if (decimals === null) return null;
  const body = JSON.parse(capture.text) as unknown;
  if (!isRecord(body)) throw new Error('KyberSwap: unexpected response');
  const summary = (body as KyberRoute).data?.routeSummary;
  const amount = summary?.amountOut;
  if (!summary || !isUint(amount)) return [];
  const exchanges = [...new Set((summary.route ?? []).flat().map((hop) => hop.exchange).filter((e): e is string => typeof e === 'string'))];
  const fee = summary.extraFee?.feeAmount;
  return [
    {
      venue,
      route: prefix + (exchanges.slice(0, 3).join(' + ') || 'KyberSwap'),
      toAmount: amount,
      toDecimals: decimals,
      toAmountUsd: num(summary.amountOutUsd),
      gasUsd: num(summary.gasUsd),
      venueFee: fee ? { label: 'KyberSwap fee' } : { label: 'None', usd: 0 },
    },
  ];
}

const asAddress = (s: string | undefined): Address | undefined => (s && /^0x[0-9a-fA-F]{40}$/.test(s) ? ((isNative(s) ? NATIVE : s) as Address) : undefined);

export const kyberswap: VenueAdapter = {
  id: 'kyberswap',
  label: 'KyberSwap',
  host: 'kyberswap.com',
  timeoutMs: 30_000,
  swapOnly: true,
  chains: CHAINS,
  // The amount field starts at 1 and ignores URL amounts, so the extension types the real amount over it.
  amountInput: { selector: 'input[inputmode="decimal"]', afterMs: 3_000, overwrite: true },

  buildUrl(trade: Trade): string {
    const slug = CHAINS.get(trade.fromChainId);
    if (!slug) throw new Error(`KyberSwap does not list chain ${trade.fromChainId}`);
    return `https://kyberswap.com/swap/${slug}/${venueAddress(trade.fromToken.address, EEEE)}-to-${venueAddress(trade.toToken.address, EEEE)}`;
  },

  parseUrl(url: URL) {
    if (url.hostname !== 'kyberswap.com') return null;
    const match = /^\/swap\/([a-z0-9-]+)(?:\/(0x[0-9a-fA-F]{40})-to-(0x[0-9a-fA-F]{40}))?\/?$/.exec(url.pathname);
    if (!match) return null;
    const chainId = [...CHAINS].find(([, s]) => s === match[1])?.[0];
    return compact({ fromChainId: chainId, toChainId: chainId, fromToken: asAddress(match[2]), toToken: asAddress(match[3]) });
  },

  matches(url: URL) {
    return url.hostname === 'aggregator-api.kyberswap.com' && /^\/[a-z0-9-]+\/api\/v1\/routes$/.test(url.pathname);
  },

  parse(capture: Capture, trade: Trade) {
    return readKyberRoutes(capture, trade, 'kyberswap');
  },
};
