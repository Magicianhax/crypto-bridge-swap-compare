import { isRecord, isUint, num } from '../lib/json';
import { EEEE, sameToken, venueAddress } from '../lib/tokens';
import type { Capture, Trade, VenueFee } from '../types';
import type { VenueAdapter } from './types';
import { addrParam, amountParam, compact, intParam } from './url';

interface MatchaFee { amount?: string; token?: string }
interface MatchaFees { integratorFee?: MatchaFee | null; zeroExFee?: MatchaFee | null; providerAppFee?: MatchaFee | null }
interface MatchaSwap { buyAmount?: string; route?: { fills?: { source?: string }[] }; fees?: MatchaFees }
interface MatchaCross {
  result?: { quote?: { buyAmount?: string; estimatedTimeSeconds?: number; steps?: { provider?: string }[]; fees?: MatchaFees } };
}

const SWAP_PATHS = new Set(['/api/swap/price', '/api/swap/quote']);
const CROSS_PATH = '/api/cross-chain/quote';

const pctOf = (part: string, whole: bigint): number =>
  whole === 0n ? 0 : Number((BigInt(part) * 1_000_000n) / whole) / 10_000;

/** Fees charged in the sell token are measured against the sell amount; fees in the buy token against the pre-fee output. */
function matchaFee(fees: MatchaFees | undefined, sellToken: string, sellAmount: string, buyToken: string, buyAmount: string): VenueFee {
  let pct = 0;
  for (const fee of [fees?.integratorFee, fees?.zeroExFee, fees?.providerAppFee]) {
    if (!fee || !isUint(fee.amount) || typeof fee.token !== 'string') continue;
    if (sameToken(fee.token, sellToken) && isUint(sellAmount)) pct += pctOf(fee.amount, BigInt(sellAmount));
    else if (sameToken(fee.token, buyToken)) pct += pctOf(fee.amount, BigInt(buyAmount) + BigInt(fee.amount));
  }
  return pct > 0 ? { label: 'Matcha fee', pct } : { label: 'None', usd: 0 };
}

export const matcha: VenueAdapter = {
  id: 'matcha',
  label: 'Matcha',
  timeoutMs: 40_000,
  amountInput: { selector: 'input[placeholder="0.0"]', afterMs: 8_000 },

  buildUrl(trade: Trade): string {
    const p = new URLSearchParams({
      sellChain: String(trade.fromChainId),
      sellAddress: venueAddress(trade.fromToken.address, EEEE).toLowerCase(),
      buyChain: String(trade.toChainId),
      buyAddress: venueAddress(trade.toToken.address, EEEE).toLowerCase(),
      sellAmount: trade.amount,
    });
    return `https://matcha.xyz/?${p}`;
  },

  parseUrl(url: URL) {
    if (url.hostname !== 'matcha.xyz' || url.pathname !== '/') return null;
    const p = url.searchParams;
    return compact({
      fromChainId: intParam(p, 'sellChain'),
      toChainId: intParam(p, 'buyChain'),
      fromToken: addrParam(p, 'sellAddress'),
      toToken: addrParam(p, 'buyAddress'),
      amount: amountParam(p, 'sellAmount'),
    });
  },

  matches(url: URL) {
    return url.hostname === 'matcha.xyz' && (SWAP_PATHS.has(url.pathname) || url.pathname === CROSS_PATH);
  },

  parse(capture: Capture, trade: Trade) {
    const decimals = trade.toToken.decimals;
    if (decimals === null) return null;
    const url = new URL(capture.url);
    const p = url.searchParams;
    const cross = url.pathname === CROSS_PATH;
    const buyToken = p.get('buyToken') ?? '';
    const sellToken = p.get('sellToken') ?? '';
    const sellAmount = p.get('sellAmount') ?? '';
    if (intParam(p, cross ? 'destinationChain' : 'chainId') !== trade.toChainId) return null;
    if (!sameToken(buyToken, trade.toToken.address)) return null;
    if (!cross && trade.fromChainId !== trade.toChainId) return null;

    const body = JSON.parse(capture.text) as unknown;
    if (!isRecord(body)) throw new Error('Matcha: unexpected response');

    if (cross) {
      const quote = (body as MatchaCross).result?.quote;
      const amount = quote?.buyAmount;
      if (!quote || !isUint(amount)) return [];
      return [
        {
          venue: 'matcha',
          route: (quote.steps ?? []).map((s) => s.provider ?? '?').join(' > ') || 'Matcha',
          toAmount: amount,
          toDecimals: decimals,
          venueFee: matchaFee(quote.fees, sellToken, sellAmount, buyToken, amount),
          etaSec: num(quote.estimatedTimeSeconds),
        },
      ];
    }

    const swap = body as MatchaSwap;
    const amount = swap.buyAmount;
    if (!isUint(amount)) return [];
    const sources = [...new Set((swap.route?.fills ?? []).map((f) => f.source).filter((s): s is string => typeof s === 'string'))];
    return [
      {
        venue: 'matcha',
        route: sources.join(' + ') || 'Matcha',
        toAmount: amount,
        toDecimals: decimals,
        venueFee: matchaFee(swap.fees, sellToken, sellAmount, buyToken, amount),
      },
    ];
  },
};
