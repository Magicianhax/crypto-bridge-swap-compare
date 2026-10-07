import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { bungee } from '../../src/venues/bungee';
import { bridgeTrade, loadCapture, swapTrade } from '../helpers';

describe('Bungee', () => {
  it('prefills www.bungee.exchange/swap (app.bungee.exchange now redirects there) with 0xeee for native', () => {
    expect(bungee.buildUrl(bridgeTrade())).toBe(
      'https://www.bungee.exchange/swap?originChainId=42161&destinationChainId=8453&inputToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&outputToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amount=0.1',
    );
  });

  it('round-trips its own URL with native normalised', () => {
    expect(bungee.parseUrl(new URL(bungee.buildUrl(bridgeTrade())))).toEqual({
      fromChainId: 42161,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: NATIVE,
      amount: '0.1',
    });
    expect(bungee.host).toBe('www.bungee.exchange');
    // A link to the old address still prefills the form.
    expect(bungee.parseUrl(new URL('https://app.bungee.exchange/?originChainId=1&destinationChainId=10'))).toMatchObject({ fromChainId: 1, toChainId: 10 });
    expect(bungee.parseUrl(new URL('https://bungee.example/?originChainId=1'))).toBeNull();
  });

  it('matches the quote stream only', () => {
    expect(bungee.matches(new URL('https://backend.socket.tech/v3/swap/quote/stream?originChainId=1'))).toBe(true);
    expect(bungee.matches(new URL('https://backend.socket.tech/v3/swap/tokens/list'))).toBe(false);
  });

  it('reads the last snapshot of a bridge', () => {
    const quotes = bungee.parse(loadCapture('bungee', 'bridge'), bridgeTrade());
    expect(quotes).toHaveLength(7);
    expect(quotes?.[0]).toMatchObject({ venue: 'bungee', route: 'Socket Intents (OpenOcean)', toAmount: '100032234006710150', toDecimals: 18 });
    expect(quotes?.find((q) => q.route === 'Across')).toMatchObject({ toAmount: '99969651405265954', etaSec: 6, gasUsd: 0.0082856057 });
    expect(quotes?.[0]?.venueFee).toBeUndefined();
  });

  it('names swap routes by DEX', () => {
    const quotes = bungee.parse(loadCapture('bungee', 'swap'), swapTrade());
    expect(quotes).toHaveLength(5);
    expect(quotes?.[0]).toMatchObject({ route: '0x', toAmount: '272060462', toDecimals: 6 });
  });

  it('ignores a stream for another trade', () => {
    expect(bungee.parse(loadCapture('bungee', 'bridge'), swapTrade())).toBeNull();
  });

  it('parses a stream that is still arriving', () => {
    const capture = loadCapture('bungee', 'bridge');
    const partial = { ...capture, text: capture.text.slice(0, Math.floor(capture.text.length * 0.6)), done: false };
    expect(bungee.parse(partial, bridgeTrade())?.length ?? 0).toBeLessThanOrEqual(7);
  });
});

describe('Bungee sell-side check', () => {
  it('ignores a quote for a different amount or origin chain', () => {
    expect(bungee.parse(loadCapture('bungee', 'bridge'), { ...bridgeTrade(), amount: '0.2' })).toBeNull();
    expect(bungee.parse(loadCapture('bungee', 'bridge'), { ...bridgeTrade(), fromChainId: 10 })).toBeNull();
  });
});
