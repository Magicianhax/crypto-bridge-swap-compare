import type { Capture, Quote, Trade, TradeHint, VenueId } from '../types';

export interface AmountInput {
  selector: string;
  afterMs: number;
  /** replace a value the page put there itself (a default amount), not just fill an empty field */
  overwrite?: boolean;
}

export interface VenueAdapter {
  id: VenueId;
  label: string;
  /** hostname of the venue's own page */
  host: string;
  /** ms without a quote before the venue shows as timed out */
  timeoutMs: number;
  buildUrl(trade: Trade): string;
  /** null when the URL is not this venue's trade page */
  parseUrl(url: URL): TradeHint | null;
  /** true for the page's own quote requests */
  matches(url: URL): boolean;
  /** null when the capture is for another trade or cannot be priced yet; throws on a malformed body */
  parse(capture: Capture, trade: Trade): Quote[] | null;
  /** type the amount into this input when the URL value does not take */
  amountInput?: AmountInput;
  /** same-chain swaps only (DEX aggregators); bridges show as unsupported */
  swapOnly?: boolean;
  /** chains the venue serves, chain id -> its URL slug; when absent the catalog's venue lists decide */
  chains?: ReadonlyMap<number, string>;
}
