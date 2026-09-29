import { isRecord } from './lib/json';
import type { Capture, Trade, VenueId, VenueResult } from './types';
import type { AmountInput } from './venues/types';

export const MSG_SOURCE = 'quote-compare' as const;

/** window.postMessage between the MAIN-world interceptor and the ISOLATED relay. */
export type PageMessage =
  | { source: typeof MSG_SOURCE; kind: 'capture'; capture: Capture }
  /** relay -> interceptor, owned tabs only: start capturing and keep the page looking visible */
  | { source: typeof MSG_SOURCE; kind: 'arm' };

/** ISOLATED relay -> service worker. */
export type RuntimeMessage = { type: 'hello' } | { type: 'capture'; generation: number; capture: Capture };

export interface FillRequest extends AmountInput {
  value: string;
}

export interface HelloReply {
  owned: boolean;
  venue?: VenueId;
  generation?: number;
  fill?: FillRequest;
}

/** Side panel <-> service worker over the 'panel' port. */
export type PanelToWorker = { type: 'compare'; trade: Trade } | { type: 'refresh' } | { type: 'ping' };
export type WorkerToPanel = { type: 'results'; results: VenueResult[] } | { type: 'error'; message: string };

export function isCapture(x: unknown): x is Capture {
  return (
    isRecord(x) &&
    typeof x.id === 'number' &&
    typeof x.url === 'string' &&
    typeof x.method === 'string' &&
    typeof x.reqBody === 'string' &&
    typeof x.status === 'number' &&
    typeof x.text === 'string' &&
    typeof x.done === 'boolean'
  );
}

export function isPageMessage(x: unknown): x is PageMessage {
  if (!isRecord(x) || x.source !== MSG_SOURCE) return false;
  if (x.kind === 'arm') return true;
  return x.kind === 'capture' && isCapture(x.capture);
}
