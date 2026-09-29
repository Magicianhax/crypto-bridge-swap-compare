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

/** Human amount to raw integer; null when it has more fraction digits than the token allows. */
export function parseUnits(amount: string, decimals: number): bigint | null {
  const [whole = '0', fraction = ''] = amount.split('.');
  if (fraction.length > decimals) return null;
  return BigInt(whole + fraction.padEnd(decimals, '0'));
}

/** Accepts "1,5" and ".5"; returns null for anything that is not a positive decimal. */
export function normalizeAmount(input: string): string | null {
  const trimmed = input.trim();
  // "1,000.5": commas are thousands separators; "1,5": the comma is the decimal point.
  let s = trimmed.includes('.') ? trimmed.replaceAll(',', '') : trimmed.replace(',', '.');
  if (s.startsWith('.')) s = `0${s}`;
  if (!/^\d+(\.\d+)?$/.test(s) || !/[1-9]/.test(s)) return null;
  return s.replace(/^0+(?=\d)/, '');
}
