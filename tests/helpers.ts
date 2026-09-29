import { readFileSync } from 'node:fs';
import { findToken, NATIVE } from '../src/lib/tokens';
import type { Capture, Token, Trade } from '../src/types';

export function loadCapture(venue: string, kind: 'bridge' | 'swap'): Capture {
  const path = new URL(`./fixtures/${venue}/${kind}.json`, import.meta.url);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Omit<Capture, 'id' | 'done'>;
  return { id: 1, done: true, ...raw };
}

export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

function mustToken(chainId: number, address: string): Token {
  const token = findToken(chainId, address);
  if (!token) throw new Error(`No built-in token ${chainId}:${address}`);
  return { ...token };
}

/** The trade recorded in tests/fixtures/<venue>/bridge.json: 0.1 ETH Arbitrum -> ETH Base. */
export const bridgeTrade = (): Trade => ({
  fromChainId: 42161,
  toChainId: 8453,
  fromToken: mustToken(42161, NATIVE),
  toToken: mustToken(8453, NATIVE),
  amount: '0.1',
});

/** The trade recorded in tests/fixtures/<venue>/swap.json: 0.1 ETH -> USDC on Base. */
export const swapTrade = (): Trade => ({
  fromChainId: 8453,
  toChainId: 8453,
  fromToken: mustToken(8453, NATIVE),
  toToken: mustToken(8453, USDC_BASE),
  amount: '0.1',
});
