import { isNative, NATIVE } from '../lib/tokens';
import { normalizeAmount } from '../lib/units';
import type { Address, TradeHint } from '../types';

export function intParam(p: URLSearchParams, key: string): number | undefined {
  const v = p.get(key);
  return v !== null && /^\d+$/.test(v) ? Number(v) : undefined;
}

export function addrParam(p: URLSearchParams, key: string): Address | undefined {
  const v = p.get(key);
  if (v === null || !/^0x[0-9a-fA-F]{40}$/.test(v)) return undefined;
  return isNative(v) ? NATIVE : (v as Address);
}

export function amountParam(p: URLSearchParams, key: string): string | undefined {
  const v = p.get(key);
  return v === null ? undefined : (normalizeAmount(v) ?? undefined);
}

/** Drops undefined fields; null when nothing is left. */
export function compact(hint: TradeHint): TradeHint | null {
  const entries = Object.entries(hint).filter(([, v]) => v !== undefined);
  return entries.length ? (Object.fromEntries(entries) as TradeHint) : null;
}
