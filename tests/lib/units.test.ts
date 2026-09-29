import { describe, expect, it } from 'vitest';
import { formatUnits, normalizeAmount } from '../../src/lib/units';

describe('formatUnits', () => {
  it('truncates to six fraction digits', () => {
    expect(formatUnits('99969599957024680', 18)).toBe('0.099969');
  });
  it('keeps exact small-decimal amounts', () => {
    expect(formatUnits('272060462', 6)).toBe('272.060462');
  });
  it('drops trailing zeros and the point', () => {
    expect(formatUnits('100000000', 6)).toBe('100');
    expect(formatUnits('0', 18)).toBe('0');
  });
  it('respects maxFraction', () => {
    expect(formatUnits('123456789000000000000000', 18, 2)).toBe('123456.78');
  });
  it('formats negatives', () => {
    expect(formatUnits(-1500000n, 6)).toBe('-1.5');
  });
});

describe('normalizeAmount', () => {
  it.each([
    ['0.1', '0.1'],
    [' 1,5 ', '1.5'],
    ['.5', '0.5'],
    ['01.50', '1.50'],
  ])('accepts %j as %j', (input, out) => {
    expect(normalizeAmount(input)).toBe(out);
  });
  it.each(['', '0', '0.000', 'abc', '1e3', '-1', '1.2.3'])('rejects %j', (input) => {
    expect(normalizeAmount(input)).toBeNull();
  });
});
