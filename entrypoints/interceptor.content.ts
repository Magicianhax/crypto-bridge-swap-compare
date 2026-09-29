import { defineContentScript } from 'wxt/utils/define-content-script';
import { installInterceptor } from '../src/capture/interceptor';
import { spoofVisibility } from '../src/capture/visibility';
import { isPageMessage, MSG_SOURCE, type PageMessage } from '../src/messages';
import { matchesAnyVenue, VENUE_MATCHES } from '../src/venues';

export default defineContentScript({
  matches: VENUE_MATCHES,
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    // The wrapper goes in at document_start so the page never holds an unwrapped fetch,
    // but it stays passive in the user's own tabs: only an owned tab's relay arms it.
    let armed = false;
    installInterceptor(
      window,
      matchesAnyVenue,
      (capture) => {
        const message: PageMessage = { source: MSG_SOURCE, kind: 'capture', capture };
        window.postMessage(message, window.location.origin);
      },
      500,
      () => armed,
    );
    window.addEventListener('message', (event) => {
      if (armed || event.source !== window || !isPageMessage(event.data) || event.data.kind !== 'arm') return;
      armed = true;
      spoofVisibility(document, window);
    });
  },
});
