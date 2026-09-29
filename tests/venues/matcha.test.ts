import { describe, expect, it } from 'vitest';
import { findToken, NATIVE } from '../../src/lib/tokens';
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
    expect(matcha.matches(new URL('https://matcha.xyz/api/tokens/info'))).toBe(false);
  });

  it('types the amount when the URL value does not take', () => {
    expect(matcha.amountInput).toEqual({ selector: 'input[placeholder="0.0"]', afterMs: 8000 });
    expect(matcha.timeoutMs).toBe(120_000);
  });

  it('reads a swap price net of the 0x fee', () => {
    const [quote] = matcha.parse(loadCapture('matcha', 'swap'), swapTrade()) ?? [];
    expect(quote).toMatchObject({ venue: 'matcha', route: 'BaiBai', toAmount: '271649175', toDecimals: 6 });
    expect(quote?.venueFee?.label).toBe('Matcha fee');
    expect(quote?.venueFee?.pct).toBeCloseTo(0.25, 3);
  });

  it('reads a cross-chain quote and its integrator fee', () => {
    const [quote] = matcha.parse(loadCapture('matcha', 'bridge'), bridgeTrade()) ?? [];
    expect(quote).toMatchObject({ route: 'Across V4', toAmount: '99569767892156631', toDecimals: 18, etaSec: 3 });
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

describe('Matcha intents (gasless) quotes', () => {
  const stableSwap = () => {
    const usdt = findToken(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7');
    const usdc = findToken(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    if (!usdt || !usdc) throw new Error('missing built-in token');
    return { fromChainId: 1, toChainId: 1, fromToken: { ...usdt }, toToken: { ...usdc }, amount: '4000' };
  };

  it('matches the intents and gasless endpoints', () => {
    expect(matcha.matches(new URL('https://matcha.xyz/api/intents/price?chainId=1'))).toBe(true);
    expect(matcha.matches(new URL('https://matcha.xyz/api/intents/quote?chainId=1'))).toBe(true);
    expect(matcha.matches(new URL('https://matcha.xyz/api/gasless/price?chainId=1'))).toBe(true);
  });

  it('reads the net amount Matcha quotes after taking gas from the output', () => {
    const [quote] = matcha.parse(loadCapture('matcha', 'intents'), stableSwap()) ?? [];
    expect(quote).toMatchObject({ venue: 'matcha', route: 'Uniswap_V4', toAmount: '3997160496', toDecimals: 6, venueFee: { label: 'None', usd: 0 } });
  });
});
