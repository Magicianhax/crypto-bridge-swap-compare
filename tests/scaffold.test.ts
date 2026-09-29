import { describe, expect, it } from 'vitest';
import { VENUE_IDS } from '../src/types';
import { loadCapture } from './helpers';

describe('scaffold', () => {
  it('lists the venues in display order', () => {
    expect(VENUE_IDS).toEqual(['jumper', 'jumper-advanced', 'bungee', 'relay', 'matcha', 'kyberswap', 'uniswap']);
  });

  it('loads a recorded capture', () => {
    const capture = loadCapture('relay', 'bridge');
    expect(capture.url).toBe('https://relay.link/api/relay/quote/v2');
    expect(capture.done).toBe(true);
  });
});
