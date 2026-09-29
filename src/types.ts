export type VenueId = 'jumper' | 'jumper-advanced' | 'bungee' | 'relay' | 'matcha';
export const VENUE_IDS: readonly VenueId[] = ['jumper', 'jumper-advanced', 'bungee', 'relay', 'matcha'];

export type Address = `0x${string}`;

export interface Token {
  chainId: number;
  address: Address;
  symbol: string;
  /** null for a pasted address until a venue reports it */
  decimals: number | null;
  /** display name, built-in tokens only */
  name?: string;
  /** logo file name in public/logos/tokens, built-in tokens only */
  logo?: string;
}

export interface Trade {
  fromChainId: number;
  toChainId: number;
  fromToken: Token;
  toToken: Token;
  /** human units, already normalised by normalizeAmount */
  amount: string;
}

export interface VenueFee {
  label: string;
  usd?: number;
  /** percent: 0.25 means 0.25% */
  pct?: number;
}

export interface Quote {
  venue: VenueId;
  route: string;
  /** raw integer string in toDecimals units */
  toAmount: string;
  toDecimals: number;
  toAmountUsd?: number;
  gasUsd?: number;
  venueFee?: VenueFee;
  etaSec?: number;
  tags?: string[];
}

export type VenueStatus = 'idle' | 'loading' | 'ok' | 'empty' | 'error' | 'timeout';

export interface VenueResult {
  venue: VenueId;
  status: VenueStatus;
  quotes: Quote[];
  error?: string;
  updatedAt: number;
}

/** One quote response as the venue page received it. */
export interface Capture {
  /** increases per page load; a higher id supersedes a lower one */
  id: number;
  url: string;
  method: string;
  reqBody: string;
  status: number;
  text: string;
  done: boolean;
  /** the page cancelled the stream before it finished (a newer request usually follows) */
  aborted?: boolean;
}

/** Partial trade read from a venue page URL. Native tokens use NATIVE. */
export interface TradeHint {
  fromChainId?: number;
  toChainId?: number;
  fromToken?: Address;
  toToken?: Address;
  amount?: string;
}
