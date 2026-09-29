import { fmtDelta, fmtEta, fmtFee, fmtGas, fmtPct, fmtUsd } from '../lib/format';
import { byTime, pickVenueBest, rankQuotes, type RankBy, type RankedQuote } from '../lib/rank';
import { formatUnits } from '../lib/units';
import type { VenueId, VenueResult, VenueStatus } from '../types';
import { ADAPTERS } from '../venues';
import { icon } from './icons';
import { logo } from './marks';

export const VENUE_LOGO: Record<VenueId, string> = {
  jumper: 'jumper.png',
  'jumper-advanced': 'jumper.png',
  bungee: 'bungee.webp',
  relay: 'relay.webp',
  matcha: 'matcha.webp',
};

export type CardState = 'quote' | Exclude<VenueStatus, 'ok' | 'idle'>;

export interface VenueCard {
  venue: VenueId;
  label: string;
  logo: string;
  state: CardState;
  /** the winner of the current tab: highest amount, or fastest */
  best: boolean;
  badge?: 'Best' | 'Fastest';
  /** how many routes the venue quoted; the card shows only its pick */
  routes: number;
  route?: string;
  receive?: string;
  usd?: string;
  delta?: string;
  deltaPct?: number;
  fee?: string;
  gas?: string;
  eta?: string;
  note?: string;
}

const STATE_ORDER: Record<CardState, number> = { quote: 0, loading: 1, empty: 2, timeout: 3, error: 4 };

function note(r: VenueResult): string {
  if (r.status === 'loading') return 'Reading the quote…';
  if (r.status === 'empty') return 'No route for this trade';
  if (r.status === 'error') return `Failed: ${r.error ?? 'unknown error'}`;
  return `No quote: ${r.error ?? 'no response in time'}`;
}

/**
 * One card per venue, showing only that venue's pick for the tab: its highest amount ('value') or its
 * fastest route ('time'). Venues are ordered the same way; "vs best" is always against the top amount.
 */
export function buildCards(results: VenueResult[], by: RankBy = 'value'): VenueCard[] {
  const picks = new Map<VenueId, { result: VenueResult; pick: RankedQuote }>();
  for (const result of results) {
    if (result.status !== 'ok') continue;
    const pick = pickVenueBest(result.quotes, by);
    if (pick) picks.set(result.venue, { result, pick });
  }
  const byValue = rankQuotes([...picks.values()].map((p) => p.pick));
  const ranked = by === 'time' ? byTime(byValue) : byValue;
  const fastest = ranked[0]?.etaSec;
  const isWinner = (q: RankedQuote) => (by === 'time' ? fastest !== undefined && q.etaSec === fastest : q.best);
  const cards: VenueCard[] = ranked.map((q) => ({
    venue: q.venue,
    label: ADAPTERS[q.venue].label,
    logo: VENUE_LOGO[q.venue],
    state: 'quote',
    best: isWinner(q),
    badge: isWinner(q) ? (by === 'time' ? 'Fastest' : 'Best') : undefined,
    routes: picks.get(q.venue)?.result.quotes.length ?? 1,
    route: q.route,
    receive: formatUnits(q.toAmount, q.toDecimals),
    usd: fmtUsd(q.toAmountUsd),
    delta: fmtDelta(q.best, q.deltaPct),
    deltaPct: q.deltaPct,
    fee: fmtFee(q.venueFee),
    gas: fmtGas(q.gasUsd),
    eta: fmtEta(q.etaSec),
  }));
  for (const r of results) {
    if (r.status === 'ok' || r.status === 'idle') continue;
    cards.push({ venue: r.venue, label: ADAPTERS[r.venue].label, logo: VENUE_LOGO[r.venue], state: r.status, best: false, routes: 0, note: note(r) });
  }
  return cards.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
}

/** One line naming the tab's winner: by value, how far ahead of Jumper; by time, what speed costs. */
export function summarize(cards: VenueCard[], toSymbol: string, by: RankBy = 'value'): string {
  const winner = cards.find((c) => c.state === 'quote' && c.best);
  if (!winner) return '';
  if (by === 'time') {
    const head = `${winner.label} is fastest (${winner.eta}): ${winner.receive} ${toSymbol}`;
    return winner.deltaPct ? `${head}, ${fmtPct(-winner.deltaPct)} less than the best amount.` : `${head}, also the best amount.`;
  }
  const head = `${winner.label} pays most: ${winner.receive} ${toSymbol}`;
  const jumper = cards.find((c) => c.venue === 'jumper' && c.state === 'quote');
  if (!jumper || jumper.best || jumper.deltaPct === undefined) return `${head}.`;
  const ahead = fmtPct((-jumper.deltaPct / (100 + jumper.deltaPct)) * 100);
  return ahead === '0%' ? `${head}, about the same as Jumper.` : `${head}, ${ahead} more than Jumper.`;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fact(doc: Document, label: string, value: string, className = ''): HTMLDivElement {
  const row = el(doc, 'div', `fact ${className}`.trim());
  row.append(el(doc, 'dt', '', label), el(doc, 'dd', '', value));
  return row;
}

/** Venue-supplied strings only ever reach the DOM through textContent. */
export function renderCards(list: HTMLElement, cards: VenueCard[], toSymbol = ''): void {
  const doc = list.ownerDocument;
  // Live updates re-render every card; only an amount that actually changed gets the settle animation.
  const shown = new Map([...list.querySelectorAll<HTMLElement>('li.card')].map((li) => [li.dataset.venue, li.querySelector('.amount')?.firstChild?.textContent ?? '']));
  list.replaceChildren(
    ...cards.map((card) => {
      const item = el(doc, 'li', `card ${card.state}${card.best ? ' best' : ''}`);
      item.dataset.venue = card.venue;
      const head = el(doc, 'div', 'card-head');
      head.append(logo(doc, `/logos/venues/${card.logo}`, card.label, 'venue-logo'), el(doc, 'span', 'venue', card.label));
      if (card.badge) head.append(el(doc, 'span', 'badge', card.badge));
      item.append(head);

      if (card.state !== 'quote') {
        if (card.state === 'loading') item.append(el(doc, 'span', 'skeleton wide'), el(doc, 'span', 'skeleton'));
        item.append(el(doc, 'p', 'note', card.note ?? ''));
        return item;
      }

      const amount = el(doc, 'p', shown.get(card.venue) === card.receive ? 'amount' : 'amount fresh', card.receive ?? '');
      if (toSymbol) amount.append(el(doc, 'span', 'unit', ` ${toSymbol}`));
      const route = el(doc, 'p', 'route', card.route ?? '');
      route.title = card.route ?? '';
      item.append(amount, el(doc, 'p', 'usd', card.usd || ' '), route);

      const facts = el(doc, 'dl', 'facts');
      facts.append(
        fact(doc, 'vs top amount', card.delta ?? '', 'delta'),
        fact(doc, 'Venue fee', card.fee ?? '—'),
        fact(doc, 'Gas', card.gas ?? '—'),
        fact(doc, 'Time', card.eta ?? '—'),
        fact(doc, 'Routes', String(card.routes)),
      );
      item.append(facts);

      const open = el(doc, 'button', 'open');
      open.type = 'button';
      open.dataset.venue = card.venue;
      open.setAttribute('aria-label', `Open ${card.label} with this trade`);
      open.append(el(doc, 'span', '', 'Open site'), icon(doc, 'arrowUpRight', 14));
      item.append(open);
      return item;
    }),
  );
}
