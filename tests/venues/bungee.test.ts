import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { bungee } from '../../src/venues/bungee';
import { bridgeTrade, loadCapture, swapTrade } from '../helpers';

describe('Bungee', () => {
  it('prefills app.bungee.exchange with 0xeee for native', () => {
    expect(bungee.buildUrl(bridgeTrade())).toBe(
      'https://app.bungee.exchange/?originChainId=42161&destinationChainId=8453&inputToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&outputToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amount=0.1',
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
    expect(bungee.parseUrl(new URL('https://www.bungee.exchange/'))).toBeNull();
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
