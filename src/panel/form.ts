import { chainById, findToken, NATIVE, sameToken } from '../lib/tokens';
import { normalizeAmount } from '../lib/units';
import type { Address, Token, Trade, TradeHint } from '../types';

export interface FormState {
  fromChainId: number;
  toChainId: number;
  /** built-in token address or a pasted address */
  fromToken: string;
  toToken: string;
  amount: string;
}

export const DEFAULT_STATE: FormState = {
  fromChainId: 42161,
  toChainId: 8453,
  fromToken: NATIVE,
  toToken: NATIVE,
  amount: '',
};

/** Same chain is a swap, anything else a bridge; there is no separate mode to pick. */
export const tradeKind = (s: FormState): 'Swap' | 'Bridge' => (s.fromChainId === s.toChainId ? 'Swap' : 'Bridge');

export const flipState = (s: FormState): FormState => ({
  fromChainId: s.toChainId,
  toChainId: s.fromChainId,
  fromToken: s.toToken,
  toToken: s.fromToken,
  amount: s.amount,
});

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
  const fromToken = resolveToken(s.fromChainId, s.fromToken);
  if (!fromToken) return { ok: false, error: 'Enter a valid "From" token address: 0x followed by 40 hex characters.' };
  const toToken = resolveToken(s.toChainId, s.toToken);
  if (!toToken) return { ok: false, error: 'Enter a valid "To" token address: 0x followed by 40 hex characters.' };
  if (s.fromChainId === s.toChainId && sameToken(fromToken.address, toToken.address)) {
    return { ok: false, error: 'Pick two different tokens.' };
  }
  return { ok: true, trade: { fromChainId: s.fromChainId, toChainId: s.toChainId, fromToken, toToken, amount } };
}

export function stateFromHint(hint: TradeHint, base: FormState): FormState {
  const fromChainId = hint.fromChainId !== undefined && chainById(hint.fromChainId) ? hint.fromChainId : base.fromChainId;
  const toChainId = hint.toChainId !== undefined && chainById(hint.toChainId) ? hint.toChainId : fromChainId;
  return {
    fromChainId,
    toChainId,
    fromToken: hint.fromToken ?? NATIVE,
    toToken: hint.toToken ?? NATIVE,
    amount: hint.amount ?? base.amount,
  };
}
