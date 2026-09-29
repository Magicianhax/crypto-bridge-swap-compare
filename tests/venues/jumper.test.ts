import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { makeJumper } from '../../src/venues/jumper';
import { bridgeTrade, loadCapture, swapTrade } from '../helpers';

const jumper = makeJumper('jumper');
const advanced = makeJumper('jumper-advanced');

describe('Jumper buildUrl', () => {
  it('prefills the bridge trade on jumper.xyz', () => {
    expect(jumper.buildUrl(bridgeTrade())).toBe(
      'https://jumper.xyz/?fromChain=42161&fromToken=0x0000000000000000000000000000000000000000&toChain=8453&toToken=0x0000000000000000000000000000000000000000&fromAmount=0.1',
    );
  });
  it('opens the Bridge tab on /advanced for cross-chain trades', () => {
    expect(advanced.buildUrl(bridgeTrade())).toBe(
      'https://jumper.xyz/advanced?tab=bridge-advanced&fromChain=42161&fromToken=0x0000000000000000000000000000000000000000&toChain=8453&toToken=0x0000000000000000000000000000000000000000&fromAmount=0.1',
    );
  });
  it('uses the default Swap tab on /advanced for same-chain trades', () => {
    expect(advanced.buildUrl(swapTrade())).toBe(
      'https://jumper.xyz/advanced?fromChain=8453&fromToken=0x0000000000000000000000000000000000000000&toChain=8453&toToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&fromAmount=0.1',
    );
  });
});

describe('Jumper parseUrl', () => {
  it('round-trips its own URL', () => {
    expect(jumper.parseUrl(new URL(jumper.buildUrl(bridgeTrade())))).toEqual({
      fromChainId: 42161,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: NATIVE,
      amount: '0.1',
    });
  });
  it('tells the two Jumper pages apart', () => {
    expect(advanced.parseUrl(new URL(jumper.buildUrl(bridgeTrade())))).toBeNull();
    expect(jumper.parseUrl(new URL(advanced.buildUrl(bridgeTrade())))).toBeNull();
    expect(jumper.parseUrl(new URL('https://jumper.xyz/earn'))).toBeNull();
    expect(jumper.parseUrl(new URL('https://jumper.xyz/'))).toBeNull();
  });
});

describe('Jumper matches', () => {
  it('matches the routes stream only', () => {
    expect(jumper.matches(new URL('https://api.jumper.xyz/pipeline/v1/advanced/routes/stream'))).toBe(true);
    expect(jumper.matches(new URL('https://api.jumper.xyz/pipeline/v1/tokens'))).toBe(false);
  });
});

describe('Jumper parse', () => {
  it('reads every route with its LI.FI fee', () => {
    const quotes = jumper.parse(loadCapture('jumper', 'bridge'), bridgeTrade());
    expect(quotes).toHaveLength(9);
    const across = quotes?.find((q) => q.route === 'AcrossV4');
    expect(across).toMatchObject({ venue: 'jumper', toAmount: '99949675480571642', toDecimals: 18, gasUsd: 0.0091, etaSec: 1 });
    expect(across?.venueFee?.label).toBe('LIFI Fixed Fee');
    expect(across?.venueFee?.usd).toBeCloseTo(0.0545, 6);
    expect(across?.venueFee?.pct).toBeCloseTo(0.02, 6);
    expect(quotes?.map((q) => q.route)).toContain('Glacis > Wrapper');
  });

  it('shows no fee on Jumper Advanced', () => {
    const quotes = advanced.parse(loadCapture('jumper-advanced', 'bridge'), bridgeTrade());
    expect(quotes).toHaveLength(9);
    const across = quotes?.find((q) => q.route === 'AcrossV4');
    expect(across).toMatchObject({ venue: 'jumper-advanced', toAmount: '99969663502147578', venueFee: { label: 'None', usd: 0 } });
  });

  it('leaves the fee unknown on Jumper routes without fee items', () => {
    const quotes = jumper.parse(loadCapture('jumper', 'swap'), swapTrade());
    expect(quotes?.find((q) => q.route === 'FYND')?.venueFee).toBeUndefined();
    expect(quotes?.find((q) => q.route === 'Kyberswap')).toMatchObject({ toAmount: '274991543', toDecimals: 6 });
  });

  it('ignores the other Jumper page and other trades', () => {
    expect(jumper.parse(loadCapture('jumper-advanced', 'bridge'), bridgeTrade())).toBeNull();
    expect(jumper.parse(loadCapture('jumper', 'bridge'), swapTrade())).toBeNull();
  });

  it('parses a stream that is still arriving', () => {
    const capture = loadCapture('jumper', 'bridge');
    const partial = { ...capture, text: capture.text.slice(0, Math.floor(capture.text.length / 2)), done: false };
    const quotes = jumper.parse(partial, bridgeTrade());
    expect(Array.isArray(quotes)).toBe(true);
    expect(quotes?.length ?? 0).toBeLessThan(9);
  });
});
