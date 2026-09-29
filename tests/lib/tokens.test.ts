import { describe, expect, it } from 'vitest';
import { CHAINS, EEEE, NATIVE, TOKENS, chainById, defaultToToken, findToken, isNative, sameToken, tokensFor, venueAddress } from '../../src/lib/tokens';

describe('tokens', () => {
  it('covers the six chains with native, USDC and USDT', () => {
    expect(CHAINS.map((c) => c.id)).toEqual([1, 42161, 8453, 10, 137, 56]);
    for (const chain of CHAINS) {
      const symbols = tokensFor(chain.id).map((t) => t.symbol);
      expect(symbols).toContain('USDC');
      expect(symbols).toContain('USDT');
      expect(tokensFor(chain.id)[0]?.address).toBe(NATIVE);
    }
  });

  it('uses valid, unique addresses', () => {
    const keys = TOKENS.map((t) => `${t.chainId}:${t.address.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TOKENS) expect(t.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('knows BNB Chain stablecoins use 18 decimals', () => {
    expect(TOKENS.filter((t) => t.chainId === 56 && t.symbol.startsWith('USD')).map((t) => t.decimals)).toEqual([18, 18]);
  });

  it('matches addresses case-insensitively and treats 0xeee as native', () => {
    expect(findToken(8453, '0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913')?.symbol).toBe('USDC');
    expect(findToken(42161, EEEE)?.symbol).toBe('ETH');
    expect(isNative(EEEE)).toBe(true);
    expect(sameToken(NATIVE, EEEE)).toBe(true);
    expect(sameToken(NATIVE, '0x4200000000000000000000000000000000000006')).toBe(false);
  });

  it('maps chains to Relay slugs', () => {
    expect(CHAINS.map((c) => c.relaySlug)).toEqual(['ethereum', 'arbitrum', 'base', 'optimism', 'polygon', 'bsc']);
    expect(chainById(999)).toBeUndefined();
  });

  it('rewrites native to the venue convention only', () => {
    expect(venueAddress(NATIVE, EEEE)).toBe(EEEE);
    expect(venueAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', EEEE)).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('defaults the destination token to USDC', () => {
    expect(defaultToToken(8453)).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(defaultToToken(999)).toBe(NATIVE);
  });
});
