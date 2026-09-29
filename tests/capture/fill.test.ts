// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fillAmount, scheduleFill } from '../../src/capture/fill';

const SELECTOR = 'input[placeholder="0.0"]';
const input = () => document.querySelector<HTMLInputElement>(SELECTOR);

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('fillAmount', () => {
  it('fills the first empty input and fires input', () => {
    document.body.innerHTML = '<input placeholder="0.0"><input placeholder="0.0">';
    const onInput = vi.fn();
    input()?.addEventListener('input', onInput);
    expect(fillAmount(document, SELECTOR, '0.1')).toBe(true);
    expect(input()?.value).toBe('0.1');
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('leaves an input that already has a value', () => {
    document.body.innerHTML = '<input placeholder="0.0" value="0.2">';
    expect(fillAmount(document, SELECTOR, '0.1')).toBe(false);
    expect(input()?.value).toBe('0.2');
  });

  it('returns false when the input is missing', () => {
    expect(fillAmount(document, SELECTOR, '0.1')).toBe(false);
  });
});

describe('scheduleFill', () => {
  it('waits, then fills once the input appears', () => {
    vi.useFakeTimers();
    scheduleFill(document, { selector: SELECTOR, afterMs: 8000, value: '0.1' });
    vi.advanceTimersByTime(8000);
    document.body.innerHTML = '<input placeholder="0.0">';
    vi.advanceTimersByTime(1000);
    expect(input()?.value).toBe('0.1');
  });

  it('fills again when a slow page resets the input while it loads', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<input placeholder="0.0">';
    scheduleFill(document, { selector: SELECTOR, afterMs: 8000, value: '0.1' });
    vi.advanceTimersByTime(8000);
    expect(input()?.value).toBe('0.1');
    document.body.innerHTML = '<input placeholder="0.0">'; // hydration replaced the input
    vi.advanceTimersByTime(1000);
    expect(input()?.value).toBe('0.1');
  });

  it('stops filling once stopped (the first quote arrived)', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<input placeholder="0.0">';
    const stop = scheduleFill(document, { selector: SELECTOR, afterMs: 8000, value: '0.1' });
    vi.advanceTimersByTime(8000);
    stop();
    document.body.innerHTML = '<input placeholder="0.0">';
    vi.advanceTimersByTime(5000);
    expect(input()?.value).toBe('');
  });

  it('gives up after the given number of tries', () => {
    vi.useFakeTimers();
    scheduleFill(document, { selector: SELECTOR, afterMs: 8000, value: '0.1' }, 2);
    vi.advanceTimersByTime(10_000);
    document.body.innerHTML = '<input placeholder="0.0">';
    vi.advanceTimersByTime(5000);
    expect(input()?.value).toBe('');
  });
});
