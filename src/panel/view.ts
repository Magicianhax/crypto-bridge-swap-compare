import { fmtDelta, fmtEta, fmtFee, fmtGas, fmtUsd } from '../lib/format';
import { rankQuotes } from '../lib/rank';
import { formatUnits } from '../lib/units';
import type { VenueId, VenueResult } from '../types';
import { ADAPTERS } from '../venues';

export type Row =
  | { kind: 'quote'; venue: VenueId; venueLabel: string; route: string; receive: string; usd: string; delta: string; best: boolean; fee: string; gas: string; eta: string }
  | { kind: 'status'; venue: VenueId; venueLabel: string; text: string; tone: 'muted' | 'error' };

const STATUS_TEXT = { loading: 'Loading…', empty: 'No routes for this trade', timeout: 'No quote in time' } as const;

export function buildRows(results: VenueResult[], toSymbol: string): Row[] {
  const ranked = rankQuotes(results.filter((r) => r.status === 'ok').flatMap((r) => r.quotes));
  const rows: Row[] = ranked.map((q) => ({
    kind: 'quote',
    venue: q.venue,
    venueLabel: ADAPTERS[q.venue].label,
    route: q.route,
    receive: `${formatUnits(q.toAmount, q.toDecimals)} ${toSymbol}`,
    usd: fmtUsd(q.toAmountUsd),
    delta: fmtDelta(q.best, q.deltaPct),
    best: q.best,
    fee: fmtFee(q.venueFee),
    gas: fmtGas(q.gasUsd),
    eta: fmtEta(q.etaSec),
  }));
  for (const r of results) {
    if (r.status === 'ok' || r.status === 'idle') continue;
    const venueLabel = ADAPTERS[r.venue].label;
    rows.push(
      r.status === 'error'
        ? { kind: 'status', venue: r.venue, venueLabel, text: `Failed: ${r.error ?? 'unknown error'}`, tone: 'error' }
        : r.status === 'timeout' && r.error
          ? { kind: 'status', venue: r.venue, venueLabel, text: `No quote: ${r.error}`, tone: 'muted' }
          : { kind: 'status', venue: r.venue, venueLabel, text: STATUS_TEXT[r.status], tone: 'muted' },
    );
  }
  return rows;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Venue-supplied strings only ever reach the DOM through textContent. */
export function renderRows(list: HTMLOListElement, rows: Row[]): void {
  const doc = list.ownerDocument;
  list.replaceChildren(
    ...rows.map((row) => {
      if (row.kind === 'status') {
        const item = el(doc, 'li', `status ${row.tone}`);
        item.append(el(doc, 'span', 'venue', row.venueLabel), el(doc, 'span', 'text', row.text));
        return item;
      }
      const item = el(doc, 'li', row.best ? 'quote best' : 'quote');
      const receive = el(doc, 'span', 'receive', row.receive);
      if (row.usd) receive.append(el(doc, 'small', 'usd', row.usd));
      const head = el(doc, 'div', 'line1');
      head.append(el(doc, 'span', 'venue', row.venueLabel), el(doc, 'span', 'route', row.route), receive);
      const open = el(doc, 'button', 'open', 'Open');
      open.type = 'button';
      open.dataset.venue = row.venue;
      open.setAttribute('aria-label', `Open ${row.venueLabel} with this trade`);
      const meta = el(doc, 'div', 'line2');
      meta.append(
        el(doc, 'span', 'delta', row.delta),
        el(doc, 'span', 'fee', `Fee ${row.fee}`),
        el(doc, 'span', 'gas', `Gas ${row.gas}`),
        el(doc, 'span', 'eta', `ETA ${row.eta}`),
        open,
      );
      item.append(head, meta);
      return item;
    }),
  );
}
