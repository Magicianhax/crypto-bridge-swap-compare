import { describe, expect, it } from 'vitest';
import { fmtDelta, fmtEta, fmtFee, fmtGas, fmtPct, fmtUsd } from '../../src/lib/format';

describe('format', () => {
  it('formats venue fees', () => {
    expect(fmtFee(undefined)).toBe('—');
    expect(fmtFee({ label: 'LIFI Fixed Fee', usd: 0.0545, pct: 0.02 })).toBe('$0.05 (0.02%)');
    expect(fmtFee({ label: 'Matcha fee', pct: 0.25 })).toBe('0.25%');
    expect(fmtFee({ label: 'None', usd: 0 })).toBe('None');
  });
  it('formats percents without trailing zeros', () => {
    expect(fmtPct(0.4)).toBe('0.4%');
    expect(fmtPct(1)).toBe('1%');
  });
  it('formats gas', () => {
    expect(fmtGas(undefined)).toBe('—');
    expect(fmtGas(0.0091)).toBe('<$0.01');
    expect(fmtGas(0.0296)).toBe('$0.03');
    expect(fmtGas(0)).toBe('$0.00');
  });
  it('formats ETA', () => {
    expect(fmtEta(undefined)).toBe('—');
    expect(fmtEta(1)).toBe('1s');
    expect(fmtEta(306)).toBe('5m');
    expect(fmtEta(7200)).toBe('2h');
  });
  it('formats delta and USD', () => {
    expect(fmtDelta(true, 0)).toBe('Best');
    expect(fmtDelta(false, -0.0199)).toBe('-0.020%');
    expect(fmtUsd(272.176)).toBe('$272.18');
    expect(fmtUsd(undefined)).toBe('');
  });
});
