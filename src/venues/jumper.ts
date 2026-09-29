import { isRecord, isUint, num, safeJson } from '../lib/json';
import { parseSse } from '../lib/sse';
import { NATIVE, sameToken, venueAddress } from '../lib/tokens';
import type { Capture, Quote, Trade, VenueFee, VenueId } from '../types';
import type { VenueAdapter } from './types';
import { addrParam, amountParam, compact, intParam, sellAmountMatches } from './url';

type JumperId = Extract<VenueId, 'jumper' | 'jumper-advanced'>;

interface LifiFee { name?: string; amountUSD?: string; percentage?: string }
interface LifiStep { tool?: string; toolDetails?: { name?: string }; estimate?: { executionDuration?: number; feeCosts?: LifiFee[] } }
interface LifiRoute { id?: string; toAmount?: string; toAmountUSD?: string; gasCostUSD?: string; toToken?: { decimals?: number }; steps?: LifiStep[]; tags?: unknown[] }

const INTEGRATOR: Record<JumperId, string> = { jumper: 'jumper.exchange', 'jumper-advanced': 'jumperadvanced' };
const FEE_NAME = /lifi fixed fee|integrator/i;

export function makeJumper(id: JumperId): VenueAdapter {
  const advanced = id === 'jumper-advanced';

  function venueFee(steps: LifiStep[]): VenueFee | undefined {
    // Top-level steps only: includedSteps repeat the same fee items.
    const items = steps.flatMap((s) => s.estimate?.feeCosts ?? []).filter((f) => FEE_NAME.test(f.name ?? ''));
    if (items.length === 0) return advanced ? { label: 'None', usd: 0 } : undefined;
    return {
      label: items[0]?.name ?? 'Fee',
      usd: items.reduce((sum, f) => sum + (num(f.amountUSD) ?? 0), 0),
      pct: items.reduce((sum, f) => sum + (num(f.percentage) ?? 0) * 100, 0),
    };
  }

  function toQuote(raw: unknown): Quote | null {
    if (!isRecord(raw)) return null;
    const route = raw as LifiRoute;
    const toAmount = route.toAmount;
    const decimals = route.toToken?.decimals;
    if (!isUint(toAmount) || typeof decimals !== 'number') return null;
    const steps = Array.isArray(route.steps) ? route.steps : [];
    return {
      venue: id,
      route: steps.map((s) => s.toolDetails?.name ?? s.tool ?? '?').join(' > ') || 'LI.FI',
      toAmount,
      toDecimals: decimals,
      toAmountUsd: num(route.toAmountUSD),
      gasUsd: num(route.gasCostUSD),
      venueFee: venueFee(steps),
      etaSec: steps.reduce((sum, s) => sum + (num(s.estimate?.executionDuration) ?? 0), 0),
      tags: Array.isArray(route.tags) ? route.tags.filter((x): x is string => typeof x === 'string') : undefined,
    };
  }

  return {
    id,
    label: advanced ? 'Jumper Advanced' : 'Jumper',
    host: 'jumper.xyz',
    timeoutMs: 30_000,

    buildUrl(trade: Trade): string {
      const p = new URLSearchParams();
      if (advanced && trade.fromChainId !== trade.toChainId) p.set('tab', 'bridge-advanced');
      p.set('fromChain', String(trade.fromChainId));
      p.set('fromToken', venueAddress(trade.fromToken.address, NATIVE));
      p.set('toChain', String(trade.toChainId));
      p.set('toToken', venueAddress(trade.toToken.address, NATIVE));
      p.set('fromAmount', trade.amount);
      return `https://jumper.xyz/${advanced ? 'advanced' : ''}?${p}`;
    },

    parseUrl(url: URL) {
      if (url.hostname !== 'jumper.xyz') return null;
      const onAdvanced = url.pathname.startsWith('/advanced');
      if (onAdvanced !== advanced || (!advanced && url.pathname !== '/')) return null;
      const p = url.searchParams;
      return compact({
        fromChainId: intParam(p, 'fromChain'),
        toChainId: intParam(p, 'toChain'),
        fromToken: addrParam(p, 'fromToken'),
        toToken: addrParam(p, 'toToken'),
        amount: amountParam(p, 'fromAmount'),
      });
    },

    matches(url: URL) {
      return url.hostname === 'api.jumper.xyz' && url.pathname.endsWith('/routes/stream');
    },

    parse(capture: Capture, trade: Trade) {
      const req = safeJson(capture.reqBody);
      if (isRecord(req)) {
        const options = isRecord(req.options) ? req.options : {};
        if (typeof options.integrator === 'string' && options.integrator !== INTEGRATOR[id]) return null;
        if (req.fromChainId !== trade.fromChainId || req.toChainId !== trade.toChainId) return null;
        if (typeof req.toTokenAddress === 'string' && !sameToken(req.toTokenAddress, trade.toToken.address)) return null;
        if (typeof req.fromTokenAddress === 'string' && !sameToken(req.fromTokenAddress, trade.fromToken.address)) return null;
        if (!sellAmountMatches(req.fromAmount, trade)) return null;
      }
      const quotes: Quote[] = [];
      const seen = new Set<string>();
      for (const event of parseSse(capture.text)) {
        if (event.event !== 'routes') continue;
        const data = safeJson(event.data);
        const routes = isRecord(data) && Array.isArray(data.routes) ? data.routes : [];
        for (const raw of routes) {
          const key = isRecord(raw) && typeof raw.id === 'string' ? raw.id : '';
          if (key && seen.has(key)) continue;
          const quote = toQuote(raw);
          if (!quote) continue;
          if (key) seen.add(key);
          quotes.push(quote);
        }
      }
      return quotes;
    },
  };
}
