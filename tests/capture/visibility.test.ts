import { describe, expect, it, vi } from 'vitest';
import { spoofVisibility } from '../../src/capture/visibility';

describe('spoofVisibility', () => {
  it('reports visible and focused and swallows visibility and blur events', () => {
    const doc = Object.assign(new EventTarget(), { visibilityState: 'hidden', hidden: true, hasFocus: () => false }) as unknown as Document;
    const win = new EventTarget() as unknown as Window;
    spoofVisibility(doc, win);
    expect(doc.visibilityState).toBe('visible');
    expect(doc.hidden).toBe(false);
    expect(doc.hasFocus()).toBe(true);

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
