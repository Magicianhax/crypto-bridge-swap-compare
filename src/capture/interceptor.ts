import type { Capture } from '../types';

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface XhrLike {
  open(method: string, url: string | URL, ...rest: unknown[]): void;
  send(body?: unknown): void;
  addEventListener(type: string, listener: () => void): void;
  status: number;
  responseType: string;
  responseText: string;
  response: unknown;
}

export interface InterceptorEnv {
  fetch: FetchFn;
  XMLHttpRequest: { prototype: object };
  location: { href: string };
}

const TAG = Symbol('quote-compare');
type TaggedXhr = XhrLike & { [TAG]?: { method: string; url: string } };

/**
 * Wraps the page's fetch and XMLHttpRequest. Requests whose absolute URL passes `matches` are
 * reported through `emit`: streamed bodies as they arrive (at most every `throttleMs`) and once
 * more with done=true. The page always receives its original, untouched response.
 */
export function installInterceptor(
  env: InterceptorEnv,
  matches: (url: string) => boolean,
  emit: (capture: Capture) => void,
  throttleMs = 500,
  /** false until the relay confirms this is an extension-owned tab */
  active: () => boolean = () => true,
): void {
  let nextId = 1;
  const resolve = (input: RequestInfo | URL): string => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      return new URL(raw, env.location.href).href;
    } catch {
      return raw;
    }
  };

  const originalFetch = env.fetch;
  env.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = resolve(input);
    if (!active() || !matches(url)) return originalFetch.call(env, input, init);
    const id = nextId++;
    const response = await originalFetch.call(env, input, init);
    const requestMethod = typeof input === 'object' && 'method' in input ? input.method : 'GET';
    const capture: Capture = {
      id,
      url,
      method: (init?.method ?? requestMethod).toUpperCase(),
      reqBody: typeof init?.body === 'string' ? init.body : '',
      status: response.status,
      text: '',
      done: false,
    };
    try {
      const body = response.clone().body;
      if (body) void pump(body, capture, emit, throttleMs);
      else emit({ ...capture, done: true });
    } catch {
      // Never let capture break the page's own request.
    }
    return response;
  };

  const proto = env.XMLHttpRequest.prototype as XhrLike;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  proto.open = function (this: TaggedXhr, method: string, url: string | URL, ...rest: unknown[]) {
    this[TAG] = { method: String(method).toUpperCase(), url: resolve(url instanceof URL ? url : String(url)) };
    return originalOpen.call(this, method, url, ...rest);
  };
  proto.send = function (this: TaggedXhr, body?: unknown) {
    const tag = this[TAG];
    if (tag && active() && matches(tag.url)) {
      const id = nextId++;
      this.addEventListener('loadend', () => {
        const text =
          this.responseType === '' || this.responseType === 'text'
            ? this.responseText
            : typeof this.response === 'string'
              ? this.response
              : JSON.stringify(this.response ?? null);
        emit({ id, url: tag.url, method: tag.method, reqBody: typeof body === 'string' ? body : '', status: this.status, text, done: true });
      });
    }
    return originalSend.call(this, body);
  };
}

async function pump(stream: ReadableStream<Uint8Array>, capture: Capture, emit: (c: Capture) => void, throttleMs: number): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let last = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      capture.text += decoder.decode(value, { stream: true });
      const now = Date.now();
      if (now - last >= throttleMs) {
        last = now;
        emit({ ...capture });
      }
    }
    capture.text += decoder.decode();
  } catch {
    // The page aborted the stream (a newer quote replaced it): report what arrived.
  }
  emit({ ...capture, done: true });
}
