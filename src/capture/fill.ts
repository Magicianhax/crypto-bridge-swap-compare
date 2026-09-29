import type { FillRequest } from '../messages';

const sameNumber = (a: string, b: string) => a.trim() !== '' && Number(a.replace(/,/g, '')) === Number(b);

/**
 * Sets a React-controlled input the way typing would. False when the input is missing or already holds a value:
 * any value normally, or with `overwrite` only the right amount (pages that start at a default like 1).
 */
export function fillAmount(doc: Document, selector: string, value: string, overwrite = false): boolean {
  const input = doc.querySelector<HTMLInputElement>(selector);
  if (!input || (overwrite ? sameNumber(input.value, value) : input.value !== '')) return false;
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input) as object, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/**
 * After fill.afterMs, keeps the amount in the input once a second for `tries` seconds, refilling it
 * whenever it is empty: a slow page (Matcha can take over a minute to hydrate) wipes an early fill when it loads.
 * Call the returned function to stop, e.g. once the page has quoted.
 */
export function scheduleFill(doc: Document, fill: FillRequest, tries = 150): () => void {
  let handle: ReturnType<typeof setTimeout> | undefined;
  let left = tries;
  let stopped = false;
  const attempt = () => {
    if (stopped) return;
    left -= 1;
    fillAmount(doc, fill.selector, fill.value, fill.overwrite);
    if (left > 0) handle = setTimeout(attempt, 1000);
  };
  handle = setTimeout(attempt, fill.afterMs);
  return () => {
    stopped = true;
    clearTimeout(handle);
  };
}
