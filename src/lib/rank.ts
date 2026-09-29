import type { Quote } from '../types';

export interface RankedQuote extends Quote {
  best: boolean;
  /** percent vs the best quote, 0 for the best, negative otherwise */
  deltaPct: number;
}

export function rankQuotes(quotes: Quote[]): RankedQuote[] {
  const first = quotes[0];
  if (!first) return [];
  const maxDecimals = Math.max(...quotes.map((q) => q.toDecimals));
  const scaled = (q: Quote) => BigInt(q.toAmount) * 10n ** BigInt(maxDecimals - q.toDecimals);
  const sorted = [...quotes].sort((a, b) => {
    const diff = scaled(b) - scaled(a);
    if (diff !== 0n) return diff > 0n ? 1 : -1;
    return (a.etaSec ?? Number.MAX_SAFE_INTEGER) - (b.etaSec ?? Number.MAX_SAFE_INTEGER);
  });
  const top = scaled(sorted[0] ?? first);
  return sorted.map((q) => {
    const value = scaled(q);
    const deltaPct = top === 0n ? 0 : Number(((value - top) * 1_000_000n) / top) / 10_000;
    return { ...q, best: value === top, deltaPct };
  });
}
