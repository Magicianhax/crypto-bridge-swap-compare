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
    installInterceptor(window, matchesAnyVenue, (capture) => {
      const message: PageMessage = { source: MSG_SOURCE, kind: 'capture', capture };
      window.postMessage(message, window.location.origin);
    });
    let spoofed = false;
    window.addEventListener('message', (event) => {
      if (spoofed || event.source !== window || !isPageMessage(event.data) || event.data.kind !== 'spoof-visibility') return;
      spoofed = true;
      spoofVisibility(document, window);
    });
  },
});
