import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAINS, EEEE, NATIVE, TOKENS, chainById, defaultToToken, findToken, isNative, sameToken, searchChains, searchTokens, tokensFor, venueAddress, venueSupports } from '../../src/lib/tokens';

const logo = (dir: string, file: string) => new URL(`../../public/logos/${dir}/${file}`, import.meta.url);

describe('tokens', () => {
  it('lists only chains at least two venues support, each with its gas token first', () => {
    expect(CHAINS.length).toBeGreaterThanOrEqual(40);
    for (const id of [1, 42161, 8453, 10, 137, 56, 43114, 59144, 324, 534352, 81457, 5000, 100, 146, 130, 80094, 4663, 143, 999, 9745]) {
      expect(chainById(id), String(id)).toBeDefined();
    }
    for (const chain of CHAINS) {
      expect(chain.venues.length, chain.name).toBeGreaterThanOrEqual(2);
      expect(tokensFor(chain.id)[0]?.address, chain.name).toBe(NATIVE);
    }
  });

  it('keeps USDC and USDT on the big chains', () => {
    for (const id of [1, 42161, 8453, 10, 137, 56, 43114]) {
      const symbols = tokensFor(id).map((t) => t.symbol);
      expect(symbols, String(id)).toContain('USDC');
      expect(symbols.some((s) => /^usd(t|₮)/i.test(s)), String(id)).toBe(true);
    }
  });

  it('knows which venues support which chain', () => {
    expect(venueSupports('matcha', 80094)).toBe(false);
    expect(venueSupports('jumper-advanced', 80094)).toBe(true);
    expect(venueSupports('relay', 4663)).toBe(true);
    expect(venueSupports('bungee', 12345)).toBe(false);
  });

  it('uses valid, unique addresses', () => {
    const keys = TOKENS.map((t) => `${t.chainId}:${t.address.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TOKENS) expect(t.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('ships a logo file for every chain and for every token that names one', () => {
    for (const c of CHAINS) expect(existsSync(logo('chains', c.logo)), c.logo).toBe(true);
    for (const t of TOKENS) if (t.logo) expect(existsSync(logo('tokens', t.logo)), `${t.chainId} ${t.symbol}`).toBe(true);
    expect(TOKENS.filter((t) => !t.logo).length).toBeLessThan(20);
  });

  it('knows BNB Chain stablecoins use 18 decimals', () => {
    expect(TOKENS.filter((t) => t.chainId === 56 && ['USDC', 'USDT'].includes(t.symbol)).map((t) => t.decimals)).toEqual([18, 18]);
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
    expect(chainById(12345)).toBeUndefined();
  });

  it('rewrites native to the venue convention only', () => {
    expect(venueAddress(NATIVE, EEEE)).toBe(EEEE);
    expect(venueAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', EEEE)).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('defaults the destination token to USDC, else a dollar stablecoin', () => {
    expect(defaultToToken(8453).toLowerCase()).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
    expect(findToken(81457, defaultToToken(81457))?.symbol).toBe('USDB');
    expect(defaultToToken(12345)).toBe(NATIVE);
  });

  it('searches by symbol, name or address with exact matches first', () => {
    expect(searchTokens(1, 'usd').map((t) => t.symbol).slice(0, 3)).toEqual(expect.arrayContaining(['USDC', 'USDT']));
    expect(searchTokens(1, 'wrapped').map((t) => t.symbol)).toEqual(expect.arrayContaining(['WETH', 'WBTC']));
    expect(searchTokens(42161, '0x912ce59144191c1204e64559fe8253a0e49e6548').map((t) => t.symbol)).toEqual(['ARB']);
    expect(searchTokens(1, '')).toHaveLength(tokensFor(1).length);
    expect(searchTokens(1, 'zzz')).toEqual([]);
  });
});

describe('searchChains', () => {
  it('matches names, Relay slugs and chain ids, prefix matches first', () => {
    expect(searchChains('ba')[0]?.name).toBe('Base');
    expect(searchChains('robin').map((c) => c.id)).toEqual([4663]);
    expect(searchChains('bsc').map((c) => c.name)).toEqual(['BNB Chain']);
    expect(searchChains('42161').map((c) => c.name)).toEqual(['Arbitrum']);
    expect(searchChains('chain').map((c) => c.name)).toEqual(expect.arrayContaining(['BNB Chain', 'Unichain', 'Berachain', 'Robinhood Chain']));
    expect(searchChains('')).toHaveLength(CHAINS.length);
    expect(searchChains('zzz')).toEqual([]);
  });
});
