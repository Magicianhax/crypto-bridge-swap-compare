import { chainById, findToken, NATIVE, sameToken } from '../lib/tokens';
import { normalizeAmount } from '../lib/units';
import type { Address, Token, Trade, TradeHint } from '../types';

export type Mode = 'swap' | 'bridge';

export interface FormState {
  mode: Mode;
  fromChainId: number;
  /** ignored in swap mode */
  toChainId: number;
  /** built-in token address or a pasted address */
  fromToken: string;
  toToken: string;
  amount: string;
}

export const DEFAULT_STATE: FormState = {
  mode: 'bridge',
  fromChainId: 42161,
  toChainId: 8453,
  fromToken: NATIVE,
  toToken: NATIVE,
  amount: '',
};

export function resolveToken(chainId: number, address: string): Token | null {
  const known = findToken(chainId, address.trim());
  if (known) return { ...known };
  const a = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return null;
  return { chainId, address: a as Address, symbol: `${a.slice(0, 6)}…${a.slice(-4)}`, decimals: null };
}

export function buildTrade(s: FormState): { ok: true; trade: Trade } | { ok: false; error: string } {
  const amount = normalizeAmount(s.amount);
  if (!amount) return { ok: false, error: 'Enter an amount greater than 0.' };
  const toChainId = s.mode === 'swap' ? s.fromChainId : s.toChainId;
  if (s.mode === 'bridge' && toChainId === s.fromChainId) {
    return { ok: false, error: 'Pick a different destination chain, or switch to Swap.' };
  }
  const fromToken = resolveToken(s.fromChainId, s.fromToken);
  if (!fromToken) return { ok: false, error: 'Enter a valid "From" token address: 0x followed by 40 hex characters.' };
  const toToken = resolveToken(toChainId, s.toToken);
  if (!toToken) return { ok: false, error: 'Enter a valid "To" token address: 0x followed by 40 hex characters.' };
  if (toChainId === s.fromChainId && sameToken(fromToken.address, toToken.address)) {
    return { ok: false, error: 'Pick two different tokens.' };
  }
  return { ok: true, trade: { fromChainId: s.fromChainId, toChainId, fromToken, toToken, amount } };
}

export function stateFromHint(hint: TradeHint, base: FormState): FormState {
  const fromChainId = hint.fromChainId !== undefined && chainById(hint.fromChainId) ? hint.fromChainId : base.fromChainId;
  const toChainId = hint.toChainId !== undefined && chainById(hint.toChainId) ? hint.toChainId : fromChainId;
  return {
    mode: fromChainId === toChainId ? 'swap' : 'bridge',
    fromChainId,
    toChainId,
    fromToken: hint.fromToken ?? NATIVE,
    toToken: hint.toToken ?? NATIVE,
    amount: hint.amount ?? base.amount,
  };
}
