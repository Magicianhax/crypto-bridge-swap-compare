import type { FillRequest } from '../messages';

/** Sets a React-controlled input the way typing would. False when the input is missing or already filled. */
export function fillAmount(doc: Document, selector: string, value: string): boolean {
  const input = doc.querySelector<HTMLInputElement>(selector);
  if (!input || input.value !== '') return false;
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input) as object, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/** After fill.afterMs, fills the input once it exists and is still empty; retries every second, `tries` times. */
export function scheduleFill(doc: Document, fill: FillRequest, tries = 20): () => void {
  let handle: ReturnType<typeof setTimeout> | undefined;
  let left = tries;
  const attempt = () => {
    left -= 1;
    const input = doc.querySelector<HTMLInputElement>(fill.selector);
    if (input && input.value !== '') return;
    if (fillAmount(doc, fill.selector, fill.value)) return;
    if (left > 0) handle = setTimeout(attempt, 1000);
  };
  handle = setTimeout(attempt, fill.afterMs);
  return () => clearTimeout(handle);
}
