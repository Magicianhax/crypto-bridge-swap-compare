import type { VenueFee } from '../types';

const trimZeros = (s: string) => s.replace(/\.?0+$/, '');

export const fmtPct = (pct: number): string => `${trimZeros(pct.toFixed(3))}%`;

export const fmtUsd = (usd: number | undefined): string => (usd === undefined ? '' : `$${usd.toFixed(2)}`);

export function fmtFee(fee: VenueFee | undefined): string {
  if (!fee) return '—';
  const parts: string[] = [];
  if (fee.usd !== undefined && fee.usd > 0) parts.push(`$${fee.usd.toFixed(2)}`);
  if (fee.pct !== undefined && fee.pct > 0) parts.push(parts.length ? `(${fmtPct(fee.pct)})` : fmtPct(fee.pct));
  return parts.length ? parts.join(' ') : 'None';
}

export function fmtGas(usd: number | undefined): string {
  if (usd === undefined) return '—';
  if (usd > 0 && usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}

export function fmtEta(sec: number | undefined): string {
  if (sec === undefined) return '—';
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${Math.round(sec / 3600)}h`;
}

export const fmtDelta = (best: boolean, deltaPct: number): string => (best ? 'Best' : `${deltaPct.toFixed(3)}%`);
