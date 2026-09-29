import { describe, expect, it } from 'vitest';
import { isPageMessage, MSG_SOURCE } from '../src/messages';

const capture = { id: 1, url: 'https://relay.link/api/relay/quote/v2', method: 'POST', reqBody: '', status: 200, text: '{}', done: true };

describe('isPageMessage', () => {
  it('accepts a well-formed capture and the spoof request', () => {
    expect(isPageMessage({ source: MSG_SOURCE, kind: 'capture', capture })).toBe(true);
    expect(isPageMessage({ source: MSG_SOURCE, kind: 'spoof-visibility' })).toBe(true);
  });
  it('rejects other sources and malformed captures', () => {
    expect(isPageMessage({ source: 'other', kind: 'capture', capture })).toBe(false);
    expect(isPageMessage({ source: MSG_SOURCE, kind: 'capture', capture: { ...capture, text: 42 } })).toBe(false);
    expect(isPageMessage({ source: MSG_SOURCE, kind: 'capture', capture: { ...capture, id: undefined } })).toBe(false);
    expect(isPageMessage(null)).toBe(false);
    expect(isPageMessage('quote-compare')).toBe(false);
  });
});
