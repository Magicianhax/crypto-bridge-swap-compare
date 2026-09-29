/** Makes a background tab look visible and focused to the page, so venues keep refreshing quotes. */
export function spoofVisibility(doc: Document, win: Window): void {
  Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' });
  Object.defineProperty(doc, 'hidden', { configurable: true, get: () => false });
  Object.defineProperty(doc, 'hasFocus', { configurable: true, value: () => true });
  const swallow = (event: Event) => event.stopImmediatePropagation();
  doc.addEventListener('visibilitychange', swallow, true);
  win.addEventListener('blur', swallow, true);
}
