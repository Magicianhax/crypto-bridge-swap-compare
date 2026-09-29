import { isRecord, isUint, num, safeJson } from '../lib/json';
import { isNative, NATIVE, sameToken } from '../lib/tokens';
import type { Address, Capture, Trade, VenueFee } from '../types';
import type { VenueAdapter } from './types';
import { amountParam, compact, sellAmountMatches } from './url';

/** Chain -> app.uniswap.org `chain` parameter, each confirmed by a quote on that chain (2026-09-29). */
const CHAINS: ReadonlyMap<number, string> = new Map([
  [1, 'mainnet'],
  [10, 'optimism'],
  [56, 'bnb'],
  [130, 'unichain'],
  [137, 'polygon'],
  [143, 'monad'],
  [324, 'zksync'],
  [480, 'worldchain'],
  [1868, 'soneium'],
  [8453, 'base'],
  [42161, 'arbitrum'],
  [42220, 'celo'],
  [43114, 'avalanche'],
  [81457, 'blast'],
]);

interface UniOutput { amount?: string; recipient?: string; bps?: number }
interface UniQuote {
  routing?: string;
  quote?: {
    swapper?: string;
    output?: { amount?: string };
    aggregatedOutputs?: UniOutput[];
    orderInfo?: { outputs?: { startAmount?: string; recipient?: string }[] };
    gasFeeUSD?: string;
    routeString?: string;
  };
}

const currency = (address: Address): string => (isNative(address) ? 'NATIVE' : address);
const fromCurrency = (value: string | null): Address | undefined => {
  if (!value) return undefined;
  if (/^(NATIVE|ETH)$/i.test(value)) return NATIVE;
  return /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : undefined;
};

/** Uniswap pays an interface fee as a second output; the swapper's share is what they receive. */
function payout(quote: NonNullable<UniQuote['quote']>): { amount?: string; fee: VenueFee } {
  const outputs = quote.aggregatedOutputs;
  const swapper = quote.swapper?.toLowerCase();
  if (Array.isArray(outputs) && outputs.length > 0 && swapper) {
    const mine = outputs.find((o) => o.recipient?.toLowerCase() === swapper);
    const feeBps = outputs.filter((o) => o !== mine).reduce((sum, o) => sum + (o.bps ?? 0), 0);
    return { amount: mine?.amount, fee: feeBps > 0 ? { label: 'Uniswap fee', pct: feeBps / 100 } : { label: 'None', usd: 0 } };
  }
  return { amount: quote.output?.amount ?? quote.orderInfo?.outputs?.[0]?.startAmount, fee: { label: 'None', usd: 0 } };
}

export const uniswap: VenueAdapter = {
  id: 'uniswap',
  label: 'Uniswap',
  host: 'app.uniswap.org',
  timeoutMs: 30_000,
  swapOnly: true,
  chains: CHAINS,

  buildUrl(trade: Trade): string {
    const chain = CHAINS.get(trade.fromChainId);
    if (!chain) throw new Error(`Uniswap does not list chain ${trade.fromChainId}`);
    const p = new URLSearchParams({
      chain,
      inputCurrency: currency(trade.fromToken.address),
      outputCurrency: currency(trade.toToken.address),
      value: trade.amount,
      field: 'input',
    });
    return `https://app.uniswap.org/swap?${p}`;
  },

  parseUrl(url: URL) {
    if (url.hostname !== 'app.uniswap.org' || !url.pathname.startsWith('/swap')) return null;
    const p = url.searchParams;
    const chainId = [...CHAINS].find(([, s]) => s === p.get('chain'))?.[0];
    return compact({
      fromChainId: chainId,
      toChainId: chainId,
      fromToken: fromCurrency(p.get('inputCurrency')),
      toToken: fromCurrency(p.get('outputCurrency')),
      amount: p.get('field') === 'output' ? undefined : amountParam(p, 'value'),
    });
  },

  matches(url: URL) {
    return url.hostname.endsWith('.uniswap.org') && url.pathname === '/quote';
  },

  parse(capture: Capture, trade: Trade) {
    const req = safeJson(capture.reqBody);
    if (!isRecord(req)) return null;
    if (req.tokenInChainId !== trade.fromChainId || req.tokenOutChainId !== trade.toChainId) return null;
    if (typeof req.tokenIn !== 'string' || !sameToken(req.tokenIn, trade.fromToken.address)) return null;
    if (typeof req.tokenOut !== 'string' || !sameToken(req.tokenOut, trade.toToken.address)) return null;
    // Uniswap re-quotes on every keystroke; only the trade's own amount counts.
    if (req.type !== 'EXACT_INPUT' || !sellAmountMatches(req.amount, trade)) return null;
    const toDecimals = trade.toToken.decimals;
    if (toDecimals === null) return null;
    const body = JSON.parse(capture.text) as unknown;
    if (!isRecord(body)) throw new Error('Uniswap: unexpected response');
    const quote = (body as UniQuote).quote;
    if (!quote) return [];
    const { amount, fee } = payout(quote);
    if (!isUint(amount)) return [];
    const classic = (body as UniQuote).routing === 'CLASSIC';
    const versions = [...new Set((quote.routeString ?? '').match(/\[v\d\]/g) ?? [])].map((v) => v.slice(1, -1));
    return [
      {
        venue: 'uniswap',
        route: classic ? `Uniswap ${versions.join('/') || 'v3'}` : 'UniswapX',
        toAmount: amount,
        toDecimals,
        gasUsd: num(quote.gasFeeUSD),
        venueFee: fee,
      },
    ];
  },
};
