import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { uniswap } from '../../src/venues/uniswap';
import { bridgeTrade, loadCapture, swapTrade, USDC_BASE } from '../helpers';

describe('Uniswap', () => {
  it('prefills app.uniswap.org', () => {
    expect(uniswap.buildUrl(swapTrade())).toBe(
      'https://app.uniswap.org/swap?chain=base&inputCurrency=NATIVE&outputCurrency=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&value=0.1&field=input',
    );
  });

  it('reads its own URL back as a hint', () => {
    expect(uniswap.parseUrl(new URL(uniswap.buildUrl(swapTrade())))).toEqual({
      fromChainId: 8453,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: USDC_BASE,
      amount: '0.1',
    });
    expect(uniswap.parseUrl(new URL('https://app.uniswap.org/explore'))).toBeNull();
  });

  it('only swaps, on the chains it serves', () => {
    expect(uniswap.swapOnly).toBe(true);
    expect(uniswap.chains?.get(1)).toBe('mainnet');
    expect(uniswap.chains?.has(59144)).toBe(false);
  });

  it('matches its quote endpoint only', () => {
    expect(uniswap.matches(new URL('https://entry-gateway.backend-prod.api.uniswap.org/quote'))).toBe(true);
    expect(uniswap.matches(new URL('https://entry-gateway.backend-prod.api.uniswap.org/data.v1.DataApiService/GetTokenPrices'))).toBe(false);
  });

  it('reads the output paid to the swapper', () => {
    expect(uniswap.parse(loadCapture('uniswap', 'swap'), swapTrade())).toEqual([
      {
        venue: 'uniswap',
        route: 'Uniswap v3',
        toAmount: '267239492',
        toDecimals: 6,
        gasUsd: 0.003113245091082469,
        venueFee: { label: 'None', usd: 0 },
      },
    ]);
  });

  it('counts an interface fee paid to another recipient', () => {
    const capture = loadCapture('uniswap', 'swap');
    const body = JSON.parse(capture.text);
    const swapper = body.quote.swapper;
    body.quote.aggregatedOutputs = [
      { amount: '997500', token: USDC_BASE, recipient: swapper, bps: 9975 },
      { amount: '2500', token: USDC_BASE, recipient: '0x000000000000000000000000000000000000fee5', bps: 25 },
    ];
    const [quote] = uniswap.parse({ ...capture, text: JSON.stringify(body) }, swapTrade()) ?? [];
    expect(quote).toMatchObject({ toAmount: '997500', venueFee: { label: 'Uniswap fee', pct: 0.25 } });
  });

  it('ignores quotes for other trades', () => {
    expect(uniswap.parse(loadCapture('uniswap', 'swap'), { ...swapTrade(), amount: '1' })).toBeNull();
    expect(uniswap.parse(loadCapture('uniswap', 'swap'), bridgeTrade())).toBeNull();
  });
});
