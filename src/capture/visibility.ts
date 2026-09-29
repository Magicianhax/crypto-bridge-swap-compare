/**
 * Makes a background tab look visible and focused to the page, so venues keep refreshing quotes.
 * A page that already paused because it loaded hidden is told once that it is visible again.
 */
export function spoofVisibility(doc: Document, win: Window): void {
  Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' });
  Object.defineProperty(doc, 'hidden', { configurable: true, get: () => false });
  Object.defineProperty(doc, 'hasFocus', { configurable: true, value: () => true });
  let resuming = false;
  const swallow = (event: Event) => {
    if (!resuming) event.stopImmediatePropagation();
  };
  doc.addEventListener('visibilitychange', swallow, true);
  win.addEventListener('blur', swallow, true);
  resuming = true;
  try {
    doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('focus'));
  } finally {
    resuming = false;
  }
}
