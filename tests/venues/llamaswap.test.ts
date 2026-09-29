import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { llamaswap } from '../../src/venues/llamaswap';
import { bridgeTrade, loadCapture, swapTrade, USDC_BASE } from '../helpers';

describe('LlamaSwap', () => {
  it('prefills swap.defillama.com (the amount is typed in, the page ignores it in the URL)', () => {
    expect(llamaswap.buildUrl(swapTrade())).toBe(
      'https://swap.defillama.com/?chain=base&from=0x0000000000000000000000000000000000000000&to=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&tab=swap',
    );
    expect(llamaswap.amountInput).toMatchObject({ selector: 'input[placeholder="0"]' });
  });

  it('reads its own URL back as a hint', () => {
    expect(llamaswap.parseUrl(new URL(llamaswap.buildUrl(swapTrade())))).toEqual({
      fromChainId: 8453,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: USDC_BASE,
    });
  });

  it('only swaps, on the chains it serves', () => {
    expect(llamaswap.swapOnly).toBe(true);
    expect(llamaswap.chains?.get(43114)).toBe('avax');
  });

  it('matches the aggregator APIs its page asks', () => {
    expect(llamaswap.matches(new URL('https://aggregator-api.kyberswap.com/base/api/v1/routes?x=1'))).toBe(true);
    expect(llamaswap.matches(new URL('https://apiv5.paraswap.io/prices/?network=8453'))).toBe(true);
    expect(llamaswap.matches(new URL('https://apiv5.paraswap.io/transactions/8453'))).toBe(false);
  });

  it('reads the ParaSwap price its page received', () => {
    expect(llamaswap.parse(loadCapture('llamaswap', 'paraswap'), swapTrade())).toEqual([
      {
        venue: 'llamaswap',
        route: 'ParaSwap: metric-v1',
        toAmount: '267627963',
        toDecimals: 6,
        toAmountUsd: 267.6057498791,
        gasUsd: 0.003128,
        venueFee: { label: 'None', usd: 0 },
      },
    ]);
  });

  it('reads the KyberSwap route its page received', () => {
    const [quote] = llamaswap.parse(loadCapture('llamaswap', 'kyberswap'), swapTrade()) ?? [];
    expect(quote).toMatchObject({ venue: 'llamaswap', route: 'KyberSwap: 1010-prop', toAmount: '267643311', toDecimals: 6 });
  });

  it('ignores prices for other trades', () => {
    expect(llamaswap.parse(loadCapture('llamaswap', 'paraswap'), { ...swapTrade(), amount: '1' })).toBeNull();
    expect(llamaswap.parse(loadCapture('llamaswap', 'paraswap'), bridgeTrade())).toBeNull();
  });
});
