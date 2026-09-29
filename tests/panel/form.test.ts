import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { buildTrade, DEFAULT_STATE, resolveToken, stateFromHint, type FormState } from '../../src/panel/form';
import { USDC_BASE } from '../helpers';

const state = (over: Partial<FormState>): FormState => ({ ...DEFAULT_STATE, amount: '0.1', ...over });

describe('buildTrade', () => {
  it('builds a bridge trade from built-in tokens', () => {
    const r = buildTrade(state({ mode: 'bridge', fromChainId: 42161, toChainId: 8453, fromToken: NATIVE, toToken: USDC_BASE }));
    expect(r.ok && r.trade).toMatchObject({ fromChainId: 42161, toChainId: 8453, amount: '0.1', toToken: { symbol: 'USDC', decimals: 6 } });
  });

  it('keeps swaps on one chain', () => {
    const r = buildTrade(state({ mode: 'swap', fromChainId: 8453, toChainId: 42161, fromToken: NATIVE, toToken: USDC_BASE }));
    expect(r.ok && r.trade.toChainId).toBe(8453);
  });

  it('normalises the amount', () => {
    const r = buildTrade(state({ amount: ' .5 ' }));
    expect(r.ok && r.trade.amount).toBe('0.5');
  });

  it.each([
    [{ amount: '0' }, 'Enter an amount greater than 0.'],
    [{ amount: 'abc' }, 'Enter an amount greater than 0.'],
    [{ mode: 'bridge' as const, fromChainId: 8453, toChainId: 8453 }, 'Pick a different destination chain, or switch to Swap.'],
    [{ mode: 'swap' as const, fromChainId: 8453, fromToken: NATIVE, toToken: NATIVE }, 'Pick two different tokens.'],
    [{ toToken: '0x123' }, 'Enter a valid "To" token address: 0x followed by 40 hex characters.'],
  ])('rejects %j', (over, error) => {
    expect(buildTrade(state(over))).toEqual({ ok: false, error });
  });
});

describe('resolveToken', () => {
  it('turns a pasted address into a token with unknown decimals', () => {
    expect(resolveToken(8453, '0x1234567890abcdef1234567890abcdef1234abcd')).toEqual({
      chainId: 8453,
      address: '0x1234567890abcdef1234567890abcdef1234abcd',
      symbol: '0x1234…abcd',
      decimals: null,
    });
  });
});

describe('stateFromHint', () => {
  it('fills the form from a venue URL hint', () => {
    expect(stateFromHint({ fromChainId: 42161, toChainId: 8453, fromToken: NATIVE, toToken: NATIVE, amount: '0.2' }, DEFAULT_STATE)).toEqual({
      mode: 'bridge',
      fromChainId: 42161,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: NATIVE,
      amount: '0.2',
    });
  });

  it('falls back for unknown chains and missing fields', () => {
    const s = stateFromHint({ fromChainId: 999 }, { ...DEFAULT_STATE, amount: '3' });
    expect(s).toMatchObject({ fromChainId: DEFAULT_STATE.fromChainId, amount: '3', mode: 'swap' });
  });
});
