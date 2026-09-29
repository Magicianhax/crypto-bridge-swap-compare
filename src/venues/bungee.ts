import { isRecord, isUint, num, safeJson } from '../lib/json';
import { parseSse } from '../lib/sse';
import { EEEE, sameToken, venueAddress } from '../lib/tokens';
import type { Capture, Quote, Trade } from '../types';
import type { VenueAdapter } from './types';
import { addrParam, amountParam, compact, intParam, sellAmountMatches } from './url';

interface BungeeProtocol { protocol?: { displayName?: string } | null }
interface BungeeRoute {
  output?: { amount?: string; valueInUsd?: number; token?: { decimals?: number } };
  estimatedTime?: number;
  routeTags?: unknown[];
  gasFee?: { feeInUsd?: number } | null;
  routeDetails?: { bridgeDetails?: BungeeProtocol | null; dexDetails?: BungeeProtocol | null } | null;
}

function routeName(r: BungeeRoute): string {
  const bridge = r.routeDetails?.bridgeDetails?.protocol?.displayName;
  const dex = r.routeDetails?.dexDetails?.protocol?.displayName;
  if (bridge && dex) return `${bridge} (${dex})`;
  return bridge ?? dex ?? 'Bungee';
}

function toQuote(raw: unknown): Quote | null {
  if (!isRecord(raw)) return null;
  const r = raw as BungeeRoute;
  const amount = r.output?.amount;
  const decimals = r.output?.token?.decimals;
  if (!isUint(amount) || typeof decimals !== 'number') return null;
  return {
    venue: 'bungee',
    route: routeName(r),
    toAmount: amount,
    toDecimals: decimals,
    toAmountUsd: num(r.output?.valueInUsd),
    gasUsd: num(r.gasFee?.feeInUsd),
    etaSec: num(r.estimatedTime),
    tags: Array.isArray(r.routeTags) ? r.routeTags.filter((x): x is string => typeof x === 'string') : undefined,
  };
}

export const bungee: VenueAdapter = {
  id: 'bungee',
  label: 'Bungee',
  host: 'app.bungee.exchange',
  timeoutMs: 30_000,

  buildUrl(trade: Trade): string {
    const p = new URLSearchParams({
      originChainId: String(trade.fromChainId),
      destinationChainId: String(trade.toChainId),
      inputToken: venueAddress(trade.fromToken.address, EEEE),
      outputToken: venueAddress(trade.toToken.address, EEEE),
      amount: trade.amount,
    });
    return `https://app.bungee.exchange/?${p}`;
  },

  parseUrl(url: URL) {
    if (url.hostname !== 'app.bungee.exchange') return null;
    const p = url.searchParams;
    return compact({
      fromChainId: intParam(p, 'originChainId'),
      toChainId: intParam(p, 'destinationChainId'),
      fromToken: addrParam(p, 'inputToken'),
      toToken: addrParam(p, 'outputToken'),
      amount: amountParam(p, 'amount'),
    });
  },

  matches(url: URL) {
    return url.hostname === 'backend.socket.tech' && url.pathname === '/v3/swap/quote/stream';
  },

  parse(capture: Capture, trade: Trade) {
    const p = new URL(capture.url).searchParams;
    if (intParam(p, 'destinationChainId') !== trade.toChainId || intParam(p, 'originChainId') !== trade.fromChainId) return null;
    const input = p.get('inputToken');
    if (input !== null && !sameToken(input, trade.fromToken.address)) return null;
    if (!sellAmountMatches(p.get('inputAmount'), trade)) return null;
    const output = p.get('outputToken');
    if (output !== null && !sameToken(output, trade.toToken.address)) return null;
    // Snapshots are cumulative: the latest complete one is the current route list.
    let routes: unknown[] = [];
    for (const event of parseSse(capture.text)) {
      if (event.event !== 'snapshot') continue;
      const data = safeJson(event.data);
      const result = isRecord(data) && isRecord(data.result) ? data.result : null;
      if (result && Array.isArray(result.routes)) routes = result.routes;
    }
    return routes.map(toQuote).filter((q): q is Quote => q !== null);
  },
};
