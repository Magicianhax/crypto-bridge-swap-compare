import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAINS, EEEE, NATIVE, TOKENS, chainById, defaultToToken, findToken, isNative, sameToken, searchTokens, tokensFor, venueAddress } from '../../src/lib/tokens';

const logo = (dir: string, file: string) => new URL(`../../public/logos/${dir}/${file}`, import.meta.url);

describe('tokens', () => {
  it('covers sixteen chains, each with its gas token first and a dollar stablecoin', () => {
    expect(CHAINS.map((c) => c.id)).toEqual([1, 42161, 8453, 10, 137, 56, 43114, 59144, 324, 534352, 81457, 5000, 100, 146, 130, 80094]);
    for (const chain of CHAINS) {
      const tokens = tokensFor(chain.id);
      expect(tokens[0]?.address, chain.name).toBe(NATIVE);
      expect(tokens.some((t) => t.symbol.startsWith('USD')), chain.name).toBe(true);
    }
  });

  it('uses valid, unique addresses', () => {
    const keys = TOKENS.map((t) => `${t.chainId}:${t.address.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TOKENS) expect(t.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('ships a logo file for every chain and built-in token', () => {
    for (const c of CHAINS) expect(existsSync(logo('chains', c.logo)), c.logo).toBe(true);
    for (const t of TOKENS) expect(existsSync(logo('tokens', t.logo ?? 'missing')), `${t.chainId} ${t.symbol}`).toBe(true);
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
    expect(chainById(8453)?.relaySlug).toBe('base');
    expect(chainById(324)?.relaySlug).toBe('zksync');
    expect(chainById(56)?.relaySlug).toBe('bsc');
    expect(chainById(999)).toBeUndefined();
  });

  it('rewrites native to the venue convention only', () => {
    expect(venueAddress(NATIVE, EEEE)).toBe(EEEE);
    expect(venueAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', EEEE)).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('defaults the destination token to USDC, else a dollar stablecoin', () => {
    expect(defaultToToken(8453)).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(findToken(81457, defaultToToken(81457))?.symbol).toBe('USDB');
    expect(defaultToToken(999)).toBe(NATIVE);
  });

  it('searches by symbol, name or address with exact matches first', () => {
    expect(searchTokens(1, 'usd').map((t) => t.symbol).slice(0, 3)).toEqual(['USDC', 'USDT', 'USDe']);
    expect(searchTokens(1, 'wrapped').map((t) => t.symbol)).toEqual(['WETH', 'WBTC', 'cbBTC', 'wstETH']);
    expect(searchTokens(42161, '0x912ce59144191c1204e64559fe8253a0e49e6548').map((t) => t.symbol)).toEqual(['ARB']);
    expect(searchTokens(1, '')).toHaveLength(tokensFor(1).length);
    expect(searchTokens(1, 'zzz')).toEqual([]);
  });
});
