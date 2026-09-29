import { describe, expect, it } from 'vitest';
import { installInterceptor } from '../../src/capture/interceptor';
import type { Capture } from '../../src/types';

const BODY = 'event: a\ndata: 1\n\nevent: b\ndata: 2\n\n';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function setup(fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>, active: () => boolean = () => true) {
  // A fresh class per test: the interceptor patches the prototype.
  class FakeXhr extends EventTarget {
    status = 0;
    responseType = '';
    responseText = '';
    response: unknown = null;
    open(_method: string, _url: string | URL) {}
    send(_body?: unknown) {
      setTimeout(() => {
        this.status = 200;
        this.responseText = '{"details":{}}';
        this.dispatchEvent(new Event('loadend'));
      }, 0);
    }
  }
  const captures: Capture[] = [];
  const fetchCalls: unknown[][] = [];
  const env = {
    fetch:
      fetchImpl ??
      (async (input: RequestInfo | URL, init?: RequestInit) => {
        fetchCalls.push([input, init]);
        return new Response(streamOf(BODY.match(/[^]*?\n\n/g) ?? []), { status: 200 });
      }),
    XMLHttpRequest: FakeXhr,
    location: { href: 'https://relay.link/bridge/base' },
  };
  installInterceptor(env, (url) => url.includes('/quote'), (c) => captures.push(c), 0, active);
  return { env, captures, fetchCalls };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !predicate(); i++) await new Promise((r) => setTimeout(r, 5));
}

describe('installInterceptor', () => {
  it('captures a matching streamed fetch and leaves the page response intact', async () => {
    const { env, captures } = setup();
    const response = await env.fetch('https://api.example/quote/stream', { method: 'post', body: '{"a":1}' });
    expect(await response.text()).toBe(BODY);
    await waitFor(() => captures.some((c) => c.done));
    expect(captures.at(-1)).toEqual({ id: 1, url: 'https://api.example/quote/stream', method: 'POST', reqBody: '{"a":1}', status: 200, text: BODY, done: true });
  });

  it('passes other requests straight through', async () => {
    const { env, captures, fetchCalls } = setup();
    await env.fetch('https://api.example/tokens');
    await new Promise((r) => setTimeout(r, 20));
    expect(captures).toEqual([]);
    expect(fetchCalls[0]?.[0]).toBe('https://api.example/tokens');
  });

  it('resolves relative URLs against the page', async () => {
    const { env, captures } = setup();
    await env.fetch('/api/quote');
    await waitFor(() => captures.length > 0);
    expect(captures[0]?.url).toBe('https://relay.link/api/quote');
  });

  it('reads method and URL from a Request object', async () => {
    const { env, captures } = setup();
    await env.fetch(new Request('https://x.test/quote', { method: 'PUT', body: 'z' }));
    await waitFor(() => captures.length > 0);
    expect(captures[0]).toMatchObject({ url: 'https://x.test/quote', method: 'PUT', reqBody: '' });
  });

  it('lets fetch failures reach the page without a capture', async () => {
    const { env, captures } = setup(async () => {
      throw new TypeError('network down');
    });
    await expect(env.fetch('https://api.example/quote')).rejects.toThrow('network down');
    expect(captures).toEqual([]);
  });

  it('numbers captures in request order', async () => {
    const { env, captures } = setup();
    await env.fetch('https://a.test/quote');
    await env.fetch('https://b.test/quote');
    await waitFor(() => captures.filter((c) => c.done).length === 2);
    expect(captures.filter((c) => c.done).map((c) => c.id).sort()).toEqual([1, 2]);
  });

  it('captures a matching XHR when it finishes', async () => {
    const { env, captures } = setup();
    const xhr = new env.XMLHttpRequest();
    xhr.open('post', '/api/relay/quote/v2');
    xhr.send('{"x":1}');
    await waitFor(() => captures.length > 0);
    expect(captures[0]).toEqual({ id: 1, url: 'https://relay.link/api/relay/quote/v2', method: 'POST', reqBody: '{"x":1}', status: 200, text: '{"details":{}}', done: true });
  });

  it('stays passive until armed', async () => {
    const { env, captures } = setup(undefined, () => false);
    const response = await env.fetch('https://api.example/quote/stream');
    expect(await response.text()).toBe(BODY);
    const xhr = new env.XMLHttpRequest();
    xhr.open('post', '/api/relay/quote/v2');
    xhr.send('{}');
    await new Promise((r) => setTimeout(r, 20));
    expect(captures).toEqual([]);
  });

  it('ignores non-matching XHR', async () => {
    const { env, captures } = setup();
    const xhr = new env.XMLHttpRequest();
    xhr.open('get', '/api/relay/chains');
    xhr.send();
    await new Promise((r) => setTimeout(r, 20));
    expect(captures).toEqual([]);
  });
});
