import { describe, expect, it } from 'vitest';
import { parseSse } from '../../src/lib/sse';
import { loadCapture } from '../helpers';

describe('parseSse', () => {
  it('parses event names, data and ids', () => {
    const text = 'event: routes\ndata: {"a":1}\n\nid: 7\nevent: done\ndata: x\ndata: y\n\n';
    expect(parseSse(text)).toEqual([
      { event: 'routes', data: '{"a":1}' },
      { event: 'done', data: 'x\ny', id: '7' },
    ]);
  });

  it('skips a trailing record that has not finished arriving', () => {
    expect(parseSse('event: a\ndata: 1\n\nevent: b\ndata: {"trunc')).toEqual([{ event: 'a', data: '1' }]);
  });

  it('handles CRLF line endings and comment lines', () => {
    expect(parseSse(': keepalive\r\nevent: a\r\ndata: 1\r\n\r\n')).toEqual([{ event: 'a', data: '1' }]);
  });

  it('defaults the event name to message', () => {
    expect(parseSse('data: 1\n\n')).toEqual([{ event: 'message', data: '1' }]);
  });

  it('reads the recorded Bungee and Jumper streams', () => {
    const bungee = parseSse(loadCapture('bungee', 'bridge').text);
    expect(bungee[0]?.event).toBe('snapshot');
    expect(bungee.at(-1)?.event).toBe('done');
    expect(bungee).toHaveLength(24);
    const jumper = parseSse(loadCapture('jumper', 'bridge').text);
    expect(jumper.map((e) => e.event)).toEqual([...Array(9).fill('routes'), 'done']);
  });
});
