import type { Quote } from '../types';

export interface RankedQuote extends Quote {
  best: boolean;
  /** percent vs the best quote, 0 for the best, negative otherwise */
  deltaPct: number;
}

export type RankBy = 'value' | 'time';

const eta = (q: Quote) => q.etaSec ?? Number.MAX_SAFE_INTEGER;

/** Fastest first; equal times keep the amount order rankQuotes gave them, unknown times last. */
export const byTime = (quotes: RankedQuote[]): RankedQuote[] => [...quotes].sort((a, b) => eta(a) - eta(b));

/** One venue's pick: its highest amount ('value') or its fastest route ('time'). */
export function pickVenueBest(quotes: Quote[], by: RankBy): RankedQuote | undefined {
  const ranked = rankQuotes(quotes);
  return (by === 'time' ? byTime(ranked) : ranked)[0];
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
