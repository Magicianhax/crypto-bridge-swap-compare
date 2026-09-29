import type { Address, Chain, Token, VenueId } from '../types';
import { CHAINS, TOKENS } from './catalog';

export { CHAINS, TOKENS };
export type { Chain };

export const NATIVE: Address = '0x0000000000000000000000000000000000000000';
export const EEEE: Address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

/** Whether a venue lists the chain (Jumper Advanced shares Jumper's chains). */
export function venueSupports(venue: VenueId, chainId: number): boolean {
  const key = venue === 'jumper-advanced' ? 'jumper' : venue;
  const venues: readonly string[] = CHAINS.find((c) => c.id === chainId)?.venues ?? [];
  return venues.includes(key);
}

export function isNative(address: string): boolean {
  const a = address.toLowerCase();
  return a === NATIVE || a === EEEE;
}

export function sameToken(a: string, b: string): boolean {
  return (isNative(a) && isNative(b)) || a.toLowerCase() === b.toLowerCase();
}

export const chainById = (id: number): Chain | undefined => CHAINS.find((c) => c.id === id);

export const tokensFor = (chainId: number): Token[] => TOKENS.filter((x) => x.chainId === chainId);

export const findToken = (chainId: number, address: string): Token | undefined =>
  TOKENS.find((x) => x.chainId === chainId && sameToken(x.address, address));

/** The address form a venue expects: its own native placeholder for the gas token, else unchanged. */
export const venueAddress = (address: Address, native: Address): Address => (isNative(address) ? native : address);

/** USDC when the chain has it, else its first dollar stablecoin, else the gas token. */
export const defaultToToken = (chainId: number): Address => {
  const tokens = tokensFor(chainId);
  return (tokens.find((x) => x.symbol === 'USDC') ?? tokens.find((x) => x.symbol.startsWith('USD')))?.address ?? NATIVE;
};

/** Case-insensitive match on symbol or name, or an exact address; best matches first. */
export function searchTokens(chainId: number, query: string): Token[] {
  const q = query.trim().toLowerCase();
  const tokens = tokensFor(chainId);
  if (!q) return tokens;
  const rank = (x: Token): number => {
    const symbol = x.symbol.toLowerCase();
    if (symbol === q || x.address.toLowerCase() === q) return 0;
    if (symbol.startsWith(q)) return 1;
    if (symbol.includes(q) || (x.name ?? '').toLowerCase().includes(q)) return 2;
    return 3;
  };
  return tokens
    .map((x, i) => ({ x, i, r: rank(x) }))
    .filter((e) => e.r < 3)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((e) => e.x);
}

/** Chain search: name or Relay slug prefix first, then any substring; an exact chain id also matches. */
export function searchChains(query: string): Chain[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...CHAINS];
  const rank = (c: Chain): number => {
    const name = c.name.toLowerCase();
    if (String(c.id) === q || name.startsWith(q) || (c.relaySlug ?? '').startsWith(q)) return 0;
    if (name.includes(q) || (c.relaySlug ?? '').includes(q)) return 1;
    return 2;
  };
  return CHAINS.map((c, i) => ({ c, i, r: rank(c) }))
    .filter((e) => e.r < 2)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((e) => e.c);
}
