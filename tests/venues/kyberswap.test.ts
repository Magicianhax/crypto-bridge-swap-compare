import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { kyberswap } from '../../src/venues/kyberswap';
import { bridgeTrade, loadCapture, swapTrade, USDC_BASE } from '../helpers';

describe('KyberSwap', () => {
  it('puts the chain and both token addresses in the path', () => {
    expect(kyberswap.buildUrl(swapTrade())).toBe(
      'https://kyberswap.com/swap/base/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee-to-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    );
  });

  it('reads a swap page URL back as a hint', () => {
    expect(kyberswap.parseUrl(new URL(kyberswap.buildUrl(swapTrade())))).toEqual({
      fromChainId: 8453,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: USDC_BASE,
    });
    expect(kyberswap.parseUrl(new URL('https://kyberswap.com/earn'))).toBeNull();
  });

  it('only swaps, on the chains it serves', () => {
    expect(kyberswap.swapOnly).toBe(true);
    expect(kyberswap.chains?.get(4663)).toBe('robinhood');
    expect(kyberswap.chains?.has(80094)).toBe(false);
  });

  it('matches its routes endpoint only', () => {
    expect(kyberswap.matches(new URL('https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0x'))).toBe(true);
    expect(kyberswap.matches(new URL('https://aggregator-api.kyberswap.com/base/api/v1/route/build'))).toBe(false);
  });

  it('overwrites the amount field, which starts at 1', () => {
    expect(kyberswap.amountInput).toMatchObject({ selector: 'input[inputmode="decimal"]', overwrite: true });
  });

  it('reads the route summary', () => {
    expect(kyberswap.parse(loadCapture('kyberswap', 'swap'), swapTrade())).toEqual([
      {
        venue: 'kyberswap',
        route: 'kipseli-prop',
        toAmount: '267396267',
        toDecimals: 6,
        toAmountUsd: 267.6012573242985,
        gasUsd: 0.00832322398472785,
        venueFee: { label: 'None', usd: 0 },
      },
    ]);
  });

  it('ignores the quote for its default 1 ETH and other trades', () => {
    expect(kyberswap.parse(loadCapture('kyberswap', 'swap'), { ...swapTrade(), amount: '1' })).toBeNull();
    expect(kyberswap.parse(loadCapture('kyberswap', 'swap'), bridgeTrade())).toBeNull();
  });
});
