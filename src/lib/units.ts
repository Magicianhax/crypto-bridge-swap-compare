/** Formats a raw integer amount, truncating (never rounding up) to maxFraction digits. */
export function formatUnits(raw: string | bigint, decimals: number, maxFraction = 6): string {
  const value = typeof raw === 'bigint' ? raw : BigInt(raw);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '');
  const out = fraction ? `${whole}.${fraction}` : `${whole}`;
  return negative ? `-${out}` : out;
}

/** Accepts "1,5" and ".5"; returns null for anything that is not a positive decimal. */
export function normalizeAmount(input: string): string | null {
  let s = input.trim().replace(',', '.');
  if (s.startsWith('.')) s = `0${s}`;
  if (!/^\d+(\.\d+)?$/.test(s) || !/[1-9]/.test(s)) return null;
  return s.replace(/^0+(?=\d)/, '');
}
