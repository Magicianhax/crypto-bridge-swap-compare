import { describe, expect, it, vi } from 'vitest';
import { spoofVisibility } from '../../src/capture/visibility';

describe('spoofVisibility', () => {
  function setup() {
    const doc = Object.assign(new EventTarget(), { visibilityState: 'hidden', hidden: true, hasFocus: () => false }) as unknown as Document;
    const win = new EventTarget() as unknown as Window;
    return { doc, win };
  }

  it('reports visible and focused', () => {
    const { doc, win } = setup();
    spoofVisibility(doc, win);
    expect(doc.visibilityState).toBe('visible');
    expect(doc.hidden).toBe(false);
    expect(doc.hasFocus()).toBe(true);
  });

  it('tells a page that paused while hidden that it is visible again, once', () => {
    const { doc, win } = setup();
    const seen: string[] = [];
    doc.addEventListener('visibilitychange', () => seen.push(`visibility:${doc.visibilityState}`));
    win.addEventListener('focus', () => seen.push('focus'));
    spoofVisibility(doc, win);
    expect(seen).toEqual(['visibility:visible', 'focus']);
  });

  it('swallows later real visibility and blur events', () => {
    const { doc, win } = setup();
    spoofVisibility(doc, win);
    const onVisibility = vi.fn();
    doc.addEventListener('visibilitychange', onVisibility);
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(onVisibility).not.toHaveBeenCalled();
    const onBlur = vi.fn();
    win.addEventListener('blur', onBlur);
    win.dispatchEvent(new Event('blur'));
    expect(onBlur).not.toHaveBeenCalled();
  });
});
