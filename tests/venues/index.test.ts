import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { VENUE_IDS } from '../../src/types';
import { ADAPTERS, hintFromUrl, matchesAnyVenue, VENUE_MATCHES } from '../../src/venues';
import { bridgeTrade, swapTrade } from '../helpers';

describe('venue registry', () => {
  it('matches every venue quote endpoint and nothing else', () => {
    for (const url of [
      'https://api.jumper.xyz/pipeline/v1/advanced/routes/stream',
      'https://backend.socket.tech/v3/swap/quote/stream?x=1',
      'https://relay.link/api/relay/quote/v2',
      'https://matcha.xyz/api/swap/price?chainId=1',
      'https://matcha.xyz/api/cross-chain/quote?originChain=1',
    ]) {
      expect(matchesAnyVenue(url)).toBe(true);
    }
    expect(matchesAnyVenue('https://example.com/quote')).toBe(false);
    expect(matchesAnyVenue('not a url')).toBe(false);
  });

  it('recognises each venue from its own URL', () => {
    for (const trade of [bridgeTrade(), swapTrade()]) {
      for (const venue of VENUE_IDS) {
        expect(hintFromUrl(ADAPTERS[venue].buildUrl(trade))?.venue).toBe(venue);
      }
    }
  });

  it('reads a Relay page URL as a hint', () => {
    expect(hintFromUrl('https://relay.link/bridge/base?fromChainId=42161&amount=0.1')).toEqual({
      venue: 'relay',
      hint: { fromChainId: 42161, toChainId: 8453, fromToken: NATIVE, toToken: NATIVE, amount: '0.1' },
    });
    expect(hintFromUrl('https://example.com/')).toBeNull();
  });

  it('injects into exactly the venue origins', () => {
    expect(VENUE_MATCHES).toEqual([
      'https://jumper.xyz/*',
      'https://www.bungee.exchange/*',
      'https://relay.link/*',
      'https://matcha.xyz/*',
      'https://kyberswap.com/*',
      'https://app.uniswap.org/*',
      'https://swap.defillama.com/*',
    ]);
  });
});
