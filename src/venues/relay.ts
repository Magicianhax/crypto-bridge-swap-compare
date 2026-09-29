import { isRecord, isUint, num, safeJson } from '../lib/json';
import { CHAINS, chainById, NATIVE, sameToken, venueAddress } from '../lib/tokens';
import type { Capture, Trade, VenueFee } from '../types';
import type { VenueAdapter } from './types';
import { addrParam, amountParam, compact, intParam, sellAmountMatches } from './url';

interface RelayAmount { amount?: string; amountUsd?: string; currency?: { decimals?: number } }
interface RelayQuote {
  details?: { currencyOut?: RelayAmount; timeEstimate?: number };
  fees?: { gas?: RelayAmount; app?: RelayAmount };
}

function appFee(usd: number | undefined): VenueFee | undefined {
  if (usd === undefined) return undefined;
  return usd > 0 ? { label: 'App fee', usd } : { label: 'None', usd: 0 };
}

export const relay: VenueAdapter = {
  id: 'relay',
  label: 'Relay',
  host: 'relay.link',
  timeoutMs: 30_000,

  buildUrl(trade: Trade): string {
    const slug = chainById(trade.toChainId)?.relaySlug;
    if (!slug) throw new Error(`Relay does not list chain ${trade.toChainId}`);
    const p = new URLSearchParams({
      fromChainId: String(trade.fromChainId),
      fromCurrency: venueAddress(trade.fromToken.address, NATIVE),
      toCurrency: venueAddress(trade.toToken.address, NATIVE),
      amount: trade.amount,
    });
    return `https://relay.link/bridge/${slug}?${p}`;
  },

  parseUrl(url: URL) {
    if (url.hostname !== 'relay.link') return null;
    const match = /^\/bridge\/([a-z0-9-]+)\/?$/.exec(url.pathname);
    if (!match) return null;
    const p = url.searchParams;
    return compact({
      fromChainId: intParam(p, 'fromChainId'),
      toChainId: CHAINS.find((c) => c.relaySlug === match[1])?.id,
      // relay.link drops the currency params when they are the native token
      fromToken: addrParam(p, 'fromCurrency') ?? NATIVE,
      toToken: addrParam(p, 'toCurrency') ?? NATIVE,
      amount: amountParam(p, 'amount'),
    });
  },

  matches(url: URL) {
    return url.hostname === 'relay.link' && url.pathname === '/api/relay/quote/v2';
  },

  parse(capture: Capture, trade: Trade) {
    const req = safeJson(capture.reqBody);
    if (isRecord(req)) {
      if (req.destinationChainId !== trade.toChainId || req.originChainId !== trade.fromChainId) return null;
      if (typeof req.originCurrency === 'string' && !sameToken(req.originCurrency, trade.fromToken.address)) return null;
      if (!sellAmountMatches(req.amount, trade)) return null;
      if (typeof req.destinationCurrency === 'string' && !sameToken(req.destinationCurrency, trade.toToken.address)) return null;
    }
    const body = JSON.parse(capture.text) as unknown;
    if (!isRecord(body)) throw new Error('Relay: unexpected response');
    const quote = body as RelayQuote;
    const out = quote.details?.currencyOut;
    const amount = out?.amount;
    const decimals = out?.currency?.decimals;
    if (!isUint(amount) || typeof decimals !== 'number') return [];
    return [
      {
        venue: 'relay',
        route: 'Relay',
        toAmount: amount,
        toDecimals: decimals,
        toAmountUsd: num(out?.amountUsd),
        gasUsd: num(quote.fees?.gas?.amountUsd),
        venueFee: appFee(num(quote.fees?.app?.amountUsd)),
        etaSec: num(quote.details?.timeEstimate),
      },
    ];
  },
};
