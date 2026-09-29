import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { matcha } from '../../src/venues/matcha';
import { bridgeTrade, loadCapture, swapTrade } from '../helpers';

describe('Matcha', () => {
  it('prefills matcha.xyz with lowercase addresses and 0xeee for native', () => {
    expect(matcha.buildUrl(swapTrade())).toBe(
      'https://matcha.xyz/?sellChain=8453&sellAddress=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&buyChain=8453&buyAddress=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&sellAmount=0.1',
    );
  });

  it('round-trips its own URL', () => {
    expect(matcha.parseUrl(new URL(matcha.buildUrl(bridgeTrade())))).toEqual({
      fromChainId: 42161,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: NATIVE,
      amount: '0.1',
    });
    expect(matcha.parseUrl(new URL('https://matcha.xyz/tokens/base/eth'))).toBeNull();
  });

  it('matches price, firm quote and cross-chain quote requests', () => {
    expect(matcha.matches(new URL('https://matcha.xyz/api/swap/price?chainId=8453'))).toBe(true);
    expect(matcha.matches(new URL('https://matcha.xyz/api/swap/quote?chainId=8453'))).toBe(true);
    expect(matcha.matches(new URL('https://matcha.xyz/api/cross-chain/quote?originChain=1'))).toBe(true);
    expect(matcha.matches(new URL('https://matcha.xyz/api/price/usd'))).toBe(false);
  });

  it('types the amount when the URL value does not take', () => {
    expect(matcha.amountInput).toEqual({ selector: 'input[placeholder="0.0"]', afterMs: 8000 });
    expect(matcha.timeoutMs).toBe(40_000);
  });

  it('reads a swap price net of the 0x fee', () => {
    const [quote] = matcha.parse(loadCapture('matcha', 'swap'), swapTrade()) ?? [];
    expect(quote).toMatchObject({ venue: 'matcha', route: 'BaiBai', toAmount: '271649175', toDecimals: 6 });
    expect(quote?.venueFee?.label).toBe('Matcha fee');
    expect(quote?.venueFee?.pct).toBeCloseTo(0.25, 3);
  });

  it('reads a cross-chain quote and its integrator fee', () => {
    const [quote] = matcha.parse(loadCapture('matcha', 'bridge'), bridgeTrade()) ?? [];
    expect(quote).toMatchObject({ route: 'across_v4', toAmount: '99569767892156631', toDecimals: 18, etaSec: 3 });
    expect(quote?.venueFee?.pct).toBeCloseTo(0.4, 3);
  });

  it('waits when the destination token decimals are unknown', () => {
    const trade = swapTrade();
    trade.toToken = { ...trade.toToken, decimals: null };
    expect(matcha.parse(loadCapture('matcha', 'swap'), trade)).toBeNull();
  });

  it('ignores responses for another trade', () => {
    expect(matcha.parse(loadCapture('matcha', 'swap'), bridgeTrade())).toBeNull();
    expect(matcha.parse(loadCapture('matcha', 'bridge'), swapTrade())).toBeNull();
  });
});

describe('Matcha sell-side check', () => {
  it('ignores a quote for a different amount or origin chain', () => {
    expect(matcha.parse(loadCapture('matcha', 'swap'), { ...swapTrade(), amount: '0.2' })).toBeNull();
    expect(matcha.parse(loadCapture('matcha', 'bridge'), { ...bridgeTrade(), fromChainId: 10 })).toBeNull();
  });
});
