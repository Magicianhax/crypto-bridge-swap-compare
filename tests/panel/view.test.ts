// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildRows, renderRows } from '../../src/panel/view';
import type { Quote, VenueResult } from '../../src/types';

const quote = (over: Partial<Quote>): Quote => ({ venue: 'jumper', route: 'AcrossV4', toAmount: '1000000', toDecimals: 6, ...over });

const results: VenueResult[] = [
  { venue: 'jumper', status: 'ok', updatedAt: 1, quotes: [quote({ route: 'A', toAmount: '1000000', etaSec: 1 }), quote({ route: 'B', toAmount: '3000000', toAmountUsd: 3 })] },
  { venue: 'jumper-advanced', status: 'idle', quotes: [], updatedAt: 0 },
  { venue: 'bungee', status: 'ok', updatedAt: 1, quotes: [quote({ venue: 'bungee', route: 'C', toAmount: '2000000' })] },
  { venue: 'relay', status: 'loading', quotes: [], updatedAt: 1 },
  { venue: 'matcha', status: 'error', quotes: [], error: 'HTTP 500', updatedAt: 1 },
];

describe('buildRows', () => {
  it('ranks all quotes, then lists venue states', () => {
    const rows = buildRows(results, 'USDC');
    expect(rows.map((r) => (r.kind === 'quote' ? r.route : `${r.venueLabel}: ${r.text}`))).toEqual(['B', 'C', 'A', 'Relay: Loading…', 'Matcha: Failed: HTTP 500']);
    const best = rows[0];
    expect(best?.kind === 'quote' && best).toMatchObject({ best: true, delta: 'Best', receive: '3 USDC', usd: '$3.00', venueLabel: 'Jumper' });
    const last = rows[2];
    expect(last?.kind === 'quote' && last.delta).toBe('-66.667%');
  });
});

describe('renderRows', () => {
  it('renders one list item per row with an Open button on quotes', () => {
    const list = document.createElement('ol');
    renderRows(list, buildRows(results, 'USDC'));
    expect(list.children).toHaveLength(5);
    expect(list.querySelector('li.quote.best .receive')?.textContent).toContain('3 USDC');
    expect(list.querySelector<HTMLButtonElement>('li.quote button.open')?.dataset.venue).toBe('jumper');
    expect(list.querySelector('li.status.error')?.textContent).toContain('Failed: HTTP 500');
  });

  it('renders venue text as text', () => {
    const list = document.createElement('ol');
    const hostile: VenueResult[] = [{ venue: 'relay', status: 'ok', updatedAt: 1, quotes: [quote({ venue: 'relay', route: '<img src=x onerror=alert(1)>' })] }];
    renderRows(list, buildRows(hostile, 'USDC'));
    expect(list.querySelector('img')).toBeNull();
    expect(list.querySelector('.route')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
