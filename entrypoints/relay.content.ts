import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { scheduleFill } from '../src/capture/fill';
import { isPageMessage, MSG_SOURCE, type HelloReply, type PageMessage, type RuntimeMessage } from '../src/messages';
import type { Capture } from '../src/types';
import { VENUE_MATCHES } from '../src/venues';

export default defineContentScript({
  matches: VENUE_MATCHES,
  runAt: 'document_start',
  async main() {
    let generation: number | null = null;
    const pending: Capture[] = [];
    const listening = new AbortController();

    const forward = (capture: Capture) => {
      if (generation === null) {
        pending.push(capture);
        return;
      }
      const message: RuntimeMessage = { type: 'capture', generation, capture };
      void browser.runtime.sendMessage(message).catch(() => undefined);
    };

    // Listen before asking, so captures posted during the handshake are buffered, not lost.
    window.addEventListener(
      'message',
      (event) => {
        if (event.source !== window || !isPageMessage(event.data) || event.data.kind !== 'capture') return;
        forward(event.data.capture);
      },
      { signal: listening.signal },
    );

    const hello: RuntimeMessage = { type: 'hello' };
    const reply = (await browser.runtime.sendMessage(hello).catch(() => null)) as HelloReply | null;
    if (!reply?.owned || reply.generation === undefined) {
      // The user's own tab: never forward anything.
      listening.abort();
      pending.length = 0;
      return;
    }
    generation = reply.generation;
    pending.splice(0).forEach(forward);
    const spoof: PageMessage = { source: MSG_SOURCE, kind: 'spoof-visibility' };
    window.postMessage(spoof, window.location.origin);
    if (reply.fill) scheduleFill(document, reply.fill);
  },
});
