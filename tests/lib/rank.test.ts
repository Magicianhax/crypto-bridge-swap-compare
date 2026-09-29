import { describe, expect, it } from 'vitest';
import { rankQuotes } from '../../src/lib/rank';
import type { Quote, VenueId } from '../../src/types';

const q = (venue: VenueId, toAmount: string, toDecimals = 6, etaSec?: number): Quote => ({
  venue,
  route: `${venue}-${toAmount}`,
  toAmount,
  toDecimals,
  ...(etaSec === undefined ? {} : { etaSec }),
});

describe('rankQuotes', () => {
  it('returns an empty list for no quotes', () => {
    expect(rankQuotes([])).toEqual([]);
  });

  it('sorts by amount received, then by ETA', () => {
    const ranked = rankQuotes([q('jumper', '100'), q('bungee', '300'), q('relay', '200', 6, 5), q('matcha', '200', 6, 2)]);
    expect(ranked.map((r) => r.venue)).toEqual(['bungee', 'matcha', 'relay', 'jumper']);
    expect(ranked[0]?.best).toBe(true);
    expect(ranked[0]?.deltaPct).toBe(0);
    expect(ranked[3]?.deltaPct).toBeCloseTo(-66.6666, 3);
  });

  it('marks ties with the top amount as best', () => {
    const ranked = rankQuotes([q('jumper', '5'), q('bungee', '5')]);
    expect(ranked.every((r) => r.best)).toBe(true);
  });

  it('compares quotes reported with different decimals', () => {
    const ranked = rankQuotes([q('relay', '1000000', 6), q('jumper', '2000000000000000000', 18)]);
    expect(ranked.map((r) => r.venue)).toEqual(['jumper', 'relay']);
    expect(ranked[1]?.deltaPct).toBe(-50);
  });
});
