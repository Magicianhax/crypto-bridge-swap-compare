import type { Address, Token } from '../types';

export const NATIVE: Address = '0x0000000000000000000000000000000000000000';
export const EEEE: Address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export interface Chain {
  id: number;
  name: string;
  relaySlug: string;
}

export const CHAINS: readonly Chain[] = [
  { id: 1, name: 'Ethereum', relaySlug: 'ethereum' },
  { id: 42161, name: 'Arbitrum', relaySlug: 'arbitrum' },
  { id: 8453, name: 'Base', relaySlug: 'base' },
  { id: 10, name: 'Optimism', relaySlug: 'optimism' },
  { id: 137, name: 'Polygon', relaySlug: 'polygon' },
  { id: 56, name: 'BNB Chain', relaySlug: 'bsc' },
];

const t = (chainId: number, address: Address, symbol: string, decimals: number): Token => ({ chainId, address, symbol, decimals });

export const TOKENS: readonly Token[] = [
  t(1, NATIVE, 'ETH', 18),
  t(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'WETH', 18),
  t(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', 6),
  t(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT', 6),
  t(42161, NATIVE, 'ETH', 18),
  t(42161, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 'WETH', 18),
  t(42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 'USDC', 6),
  t(42161, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 'USDT', 6),
  t(8453, NATIVE, 'ETH', 18),
  t(8453, '0x4200000000000000000000000000000000000006', 'WETH', 18),
  t(8453, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'USDC', 6),
  t(8453, '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', 'USDT', 6),
  t(10, NATIVE, 'ETH', 18),
  t(10, '0x4200000000000000000000000000000000000006', 'WETH', 18),
  t(10, '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', 'USDC', 6),
  t(10, '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', 'USDT', 6),
  t(137, NATIVE, 'POL', 18),
  t(137, '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', 'WPOL', 18),
  t(137, '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', 'WETH', 18),
  t(137, '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 'USDC', 6),
  t(137, '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 'USDT', 6),
  t(56, NATIVE, 'BNB', 18),
  t(56, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 'WBNB', 18),
  t(56, '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 'ETH', 18),
  t(56, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 'USDC', 18),
  t(56, '0x55d398326f99059fF775485246999027B3197955', 'USDT', 18),
];

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

export const defaultToToken = (chainId: number): Address =>
  tokensFor(chainId).find((x) => x.symbol === 'USDC')?.address ?? NATIVE;
