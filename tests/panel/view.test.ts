// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildCards, renderCards, summarize } from '../../src/panel/view';
import type { Quote, VenueResult } from '../../src/types';

const quote = (over: Partial<Quote>): Quote => ({ venue: 'jumper', route: 'AcrossV4', toAmount: '1000000', toDecimals: 6, ...over });

const results: VenueResult[] = [
  { venue: 'jumper', status: 'ok', updatedAt: 1, quotes: [quote({ route: 'A', toAmount: '1000000', etaSec: 1 }), quote({ route: 'B', toAmount: '2000000', etaSec: 20 })] },
  { venue: 'jumper-advanced', status: 'idle', quotes: [], updatedAt: 0 },
  { venue: 'bungee', status: 'ok', updatedAt: 1, quotes: [quote({ venue: 'bungee', route: 'C', toAmount: '3000000', toAmountUsd: 3 })] },
  { venue: 'relay', status: 'loading', quotes: [], updatedAt: 1 },
  { venue: 'matcha', status: 'error', quotes: [], error: 'HTTP 500', updatedAt: 1 },
];

describe('buildCards', () => {
  it('gives each venue one card with its best route, winner first', () => {
    const cards = buildCards(results);
    expect(cards.map((c) => `${c.venue}:${c.state}`)).toEqual(['bungee:quote', 'jumper:quote', 'relay:loading', 'matcha:error']);
    expect(cards[0]).toMatchObject({ best: true, route: 'C', receive: '3', usd: '$3.00', delta: 'Best', routes: 1, label: 'Bungee' });
    expect(cards[1]).toMatchObject({ best: false, route: 'B', receive: '2', delta: '-33.333%', routes: 2 });
    expect(cards[3]).toMatchObject({ note: 'Failed: HTTP 500' });
  });

  it('says which chain a venue does not support', () => {
    const [card] = buildCards([{ venue: 'matcha', status: 'unsupported', quotes: [], error: 'Berachain', updatedAt: 1 }]);
    expect(card).toMatchObject({ state: 'unsupported', note: 'Not available on Berachain' });
  });

  it('explains a timeout', () => {
    const [card] = buildCards([{ venue: 'jumper', status: 'timeout', quotes: [], error: 'Page never asked for a quote', updatedAt: 1 }]);
    expect(card).toMatchObject({ state: 'timeout', note: 'No quote: Page never asked for a quote' });
  });
});

describe('buildCards by time', () => {
  it('shows each venue at its fastest route, fastest venue first', () => {
    const cards = buildCards(results, 'time');
    expect(cards.map((c) => `${c.venue}:${c.route ?? c.state}`)).toEqual(['jumper:A', 'bungee:C', 'relay:loading', 'matcha:error']);
    expect(cards[0]).toMatchObject({ best: true, badge: 'Fastest', eta: '1s', receive: '1', delta: '-66.667%' });
    expect(cards[1]).toMatchObject({ best: false, badge: undefined, delta: 'Best' });
  });
});

describe('summarize', () => {
  it('names the winner and how much it beats Jumper by', () => {
    expect(summarize(buildCards(results), 'USDC')).toBe('Bungee pays most: 3 USDC, 50% more than Jumper.');
  });
  it('names the fastest venue and what it gives up', () => {
    expect(summarize(buildCards(results, 'time'), 'USDC', 'time')).toBe('Jumper is fastest (1s): 1 USDC, 66.667% less than the best amount.');
  });
  it('stays quiet until a venue has quoted', () => {
    expect(summarize(buildCards([{ venue: 'relay', status: 'loading', quotes: [], updatedAt: 1 }]), 'ETH')).toBe('');
  });
});

describe('renderCards', () => {
  it('renders one card per venue with an Open button on quotes', () => {
    const list = document.createElement('ol');
    renderCards(list, buildCards(results));
    expect(list.children).toHaveLength(4);
    expect(list.querySelector('li.card.best .amount')?.textContent).toContain('3');
    expect(list.querySelector('li.card.best .badge')?.textContent).toBe('Best');
    expect(list.querySelector<HTMLButtonElement>('li.card button.open')?.dataset.venue).toBe('bungee');
    expect(list.querySelector('li.card.error .note')?.textContent).toBe('Failed: HTTP 500');
    expect(list.querySelector<HTMLImageElement>('li.card img.venue-logo')?.getAttribute('src')).toBe('/logos/venues/bungee.webp');
  });

  it('animates an amount only when it changes', () => {
    const list = document.createElement('ol');
    renderCards(list, buildCards(results));
    expect(list.querySelector('li.card.best .amount')?.classList.contains('fresh')).toBe(true);
    renderCards(list, buildCards(results));
    expect(list.querySelector('li.card.best .amount')?.classList.contains('fresh')).toBe(false);
  });

  it('renders venue text as text', () => {
    const list = document.createElement('ol');
    const hostile: VenueResult[] = [{ venue: 'relay', status: 'ok', updatedAt: 1, quotes: [quote({ venue: 'relay', route: '<img src=x onerror=alert(1)>' })] }];
    renderCards(list, buildCards(hostile));
    expect(list.querySelector('img:not(.venue-logo)')).toBeNull();
    expect(list.querySelector('.route')?.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('summarize ties', () => {
  it('says "about the same" when the gap to Jumper rounds to zero', () => {
    const tie: VenueResult[] = [
      { venue: 'bungee', status: 'ok', updatedAt: 1, quotes: [quote({ venue: 'bungee', toAmount: '100000001' })] },
      { venue: 'jumper', status: 'ok', updatedAt: 1, quotes: [quote({ toAmount: '100000000' })] },
    ];
    expect(summarize(buildCards(tie), 'USDC')).toBe('Bungee pays most: 100.000001 USDC, about the same as Jumper.');
  });
});
