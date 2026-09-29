import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { relay } from '../../src/venues/relay';
import { bridgeTrade, loadCapture, swapTrade } from '../helpers';

describe('Relay', () => {
  it('puts the destination chain slug in the path', () => {
    expect(relay.buildUrl(bridgeTrade())).toBe(
      'https://relay.link/bridge/base?fromChainId=42161&fromCurrency=0x0000000000000000000000000000000000000000&toCurrency=0x0000000000000000000000000000000000000000&amount=0.1',
    );
  });

  it('refuses chains Relay does not list', () => {
    const trade = { ...bridgeTrade(), toChainId: 999 };
    expect(() => relay.buildUrl(trade)).toThrow('Relay does not list chain 999');
  });

  it('reads the destination from the slug and treats missing currencies as native', () => {
    expect(relay.parseUrl(new URL('https://relay.link/bridge/base?fromChainId=42161&amount=0.1'))).toEqual({
      fromChainId: 42161,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: NATIVE,
      amount: '0.1',
    });
    expect(relay.parseUrl(new URL('https://relay.link/transactions'))).toBeNull();
  });

  it('matches the quote endpoint only', () => {
    expect(relay.matches(new URL('https://relay.link/api/relay/quote/v2'))).toBe(true);
    expect(relay.matches(new URL('https://relay.link/api/relay/chains'))).toBe(false);
  });

  it('reads the bridge quote and app fee', () => {
    expect(relay.parse(loadCapture('relay', 'bridge'), bridgeTrade())).toEqual([
      {
        venue: 'relay',
        route: 'Relay',
        toAmount: '99919666228766998',
        toDecimals: 18,
        toAmountUsd: 272.191762,
        gasUsd: 0.002258,
        venueFee: { label: 'None', usd: 0 },
        etaSec: 2,
      },
    ]);
  });

  it('reads a same-chain swap', () => {
    expect(relay.parse(loadCapture('relay', 'swap'), swapTrade())?.[0]).toMatchObject({ toAmount: '272420034', toDecimals: 6 });
  });

  it('ignores a quote for another trade', () => {
    expect(relay.parse(loadCapture('relay', 'bridge'), swapTrade())).toBeNull();
  });

  it('throws on a body that is not JSON', () => {
    const capture = { ...loadCapture('relay', 'bridge'), text: '<html>' };
    expect(() => relay.parse(capture, bridgeTrade())).toThrow();
  });
});

describe('Relay sell-side check', () => {
  it('ignores a quote for a different amount or origin chain', () => {
    expect(relay.parse(loadCapture('relay', 'bridge'), { ...bridgeTrade(), amount: '0.2' })).toBeNull();
    expect(relay.parse(loadCapture('relay', 'bridge'), { ...bridgeTrade(), fromChainId: 10 })).toBeNull();
  });
});
