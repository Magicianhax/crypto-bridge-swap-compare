import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller, type BrowserPort } from '../src/controller';
import { NATIVE } from '../src/lib/tokens';
import type { Trade, VenueResult } from '../src/types';
import { bridgeTrade, loadCapture, swapTrade } from './helpers';

const TAB = { jumper: 100, 'jumper-advanced': 101, bungee: 102, relay: 103, matcha: 104, kyberswap: 105, uniswap: 106 } as const;
/** Swap-only DEXes sit out every bridge trade. */
const DEX_OFF = { kyberswap: 'unsupported', uniswap: 'unsupported' } as const;

function setup() {
  let next = 100;
  const port = {
    createWindow: vi.fn(async (tabCount: number) => ({ windowId: 7, tabIds: Array.from({ length: tabCount }, () => next++) })),
    createTab: vi.fn(async (_windowId: number) => next++),
    navigate: vi.fn(async (_tabId: number, _url: string) => undefined),
    closeWindow: vi.fn(async (_windowId: number) => undefined),
  } satisfies BrowserPort;
  const emitted: VenueResult[][] = [];
  const controller = new Controller(port, (results) => emitted.push(results));
  const status = () => Object.fromEntries(controller.snapshot().map((r) => [r.venue, r.status]));
  const result = (venue: keyof typeof TAB) => controller.snapshot().find((r) => r.venue === venue);
  return { port, controller, emitted, status, result };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Controller', () => {
  it('opens one window and loads every venue', async () => {
    const { port, controller, status, emitted } = setup();
    await controller.compare(bridgeTrade());
    expect(port.createWindow).toHaveBeenCalledWith(7);
    expect(port.navigate).toHaveBeenCalledTimes(5); // the two swap-only DEXes skip a bridge
    expect(port.navigate).toHaveBeenCalledWith(TAB.jumper, expect.stringMatching(/^https:\/\/jumper\.xyz\/\?/));
    expect(port.navigate).toHaveBeenCalledWith(TAB.relay, expect.stringMatching(/^https:\/\/relay\.link\/bridge\/base\?/));
    expect(Object.values(status())).toEqual(['loading', 'loading', 'loading', 'loading', 'loading', 'unsupported', 'unsupported']);
    expect(emitted.length).toBeGreaterThan(0);
  });

  it('answers hello only for its own tabs', async () => {
    const { controller } = setup();
    expect(controller.hello(TAB.jumper)).toEqual({ owned: false });
    await controller.compare(bridgeTrade());
    expect(controller.hello(999)).toEqual({ owned: false });
    expect(controller.hello(TAB.jumper)).toEqual({ owned: true, venue: 'jumper', generation: 1 });
    expect(controller.hello(TAB.matcha)).toEqual({
      owned: true,
      venue: 'matcha',
      generation: 1,
      fill: { selector: 'input[placeholder="0.0"]', afterMs: 8000, value: '0.1' },
    });
  });

  it('turns a capture into quotes', async () => {
    const { controller, result } = setup();
    await controller.compare(bridgeTrade());
    controller.onCapture(TAB.jumper, 1, loadCapture('jumper', 'bridge'));
    expect(result('jumper')?.status).toBe('ok');
    expect(result('jumper')?.quotes).toHaveLength(9);
  });

  it('drops captures from an earlier comparison', async () => {
    const { controller, status } = setup();
    await controller.compare(bridgeTrade());
    await controller.compare(bridgeTrade());
    controller.onCapture(TAB.jumper, 1, loadCapture('jumper', 'bridge'));
    expect(status().jumper).toBe('loading');
    controller.onCapture(TAB.jumper, 2, loadCapture('jumper', 'bridge'));
    expect(status().jumper).toBe('ok');
  });

  it('keeps the newest capture from a page', async () => {
    const { controller, result } = setup();
    await controller.compare(bridgeTrade());
    controller.onCapture(TAB.jumper, 1, { ...loadCapture('jumper', 'bridge'), id: 2 });
    controller.onCapture(TAB.jumper, 1, { ...loadCapture('jumper', 'bridge'), id: 1, text: '' });
    expect(result('jumper')?.quotes).toHaveLength(9);
  });

  it('ignores captures that are not the venue quote endpoint or come from another site', async () => {
    const { controller, status } = setup();
    await controller.compare(bridgeTrade());
    controller.onCapture(TAB.jumper, 1, loadCapture('relay', 'bridge'), 'https://jumper.xyz/');
    expect(status().jumper).toBe('loading');
    controller.onCapture(TAB.jumper, 1, loadCapture('jumper', 'bridge'), 'https://evil.example/');
    expect(status().jumper).toBe('loading');
    controller.onCapture(TAB.jumper, 1, loadCapture('jumper', 'bridge'), 'https://jumper.xyz/?fromChain=42161');
    expect(status().jumper).toBe('ok');
  });

  it('refuses oversized captures', async () => {
    const { controller, result } = setup();
    await controller.compare(bridgeTrade());
    controller.onCapture(TAB.relay, 1, { ...loadCapture('relay', 'bridge'), text: 'x'.repeat(4_000_001) });
    expect(result('relay')).toMatchObject({ status: 'error', error: 'Response too large' });
  });

  it('ignores captures from tabs it does not own', async () => {
    const { controller, status } = setup();
    await controller.compare(bridgeTrade());
    controller.onCapture(999, 1, loadCapture('jumper', 'bridge'));
    expect(status().jumper).toBe('loading');
  });

  it('times out venues that never quote, Matcha last', async () => {
    const { controller, status } = setup();
    await controller.compare(bridgeTrade());
    vi.advanceTimersByTime(30_000);
    expect(status()).toEqual({ jumper: 'timeout', 'jumper-advanced': 'timeout', bungee: 'timeout', relay: 'timeout', matcha: 'loading', ...DEX_OFF });
    vi.advanceTimersByTime(89_000);
    expect(status().matcha).toBe('loading');
    vi.advanceTimersByTime(1_000);
    expect(status().matcha).toBe('timeout');
  });

  it('says why a venue timed out', async () => {
    const { controller, result } = setup();
    await controller.compare(swapTrade());
    controller.hello(TAB.jumper);
    controller.onCapture(TAB.jumper, 1, loadCapture('jumper', 'bridge'));
    controller.hello(TAB.bungee);
    vi.advanceTimersByTime(30_000);
    expect(result('jumper')).toMatchObject({ status: 'timeout', error: 'Quotes were for a different trade' });
    expect(result('bungee')).toMatchObject({ status: 'timeout', error: 'Page never asked for a quote' });
    expect(result('relay')).toMatchObject({ status: 'timeout', error: 'Page did not load' });
  });

  it('updates the timeout reason when a late quote turns out to be for another trade', async () => {
    const { controller, result } = setup();
    await controller.compare(swapTrade());
    controller.hello(TAB.jumper);
    vi.advanceTimersByTime(30_000);
    expect(result('jumper')).toMatchObject({ status: 'timeout', error: 'Page never asked for a quote' });
    controller.onCapture(TAB.jumper, 1, loadCapture('jumper', 'bridge'));
    expect(result('jumper')).toMatchObject({ status: 'timeout', error: 'Quotes were for a different trade' });
  });

  it('fills unknown token decimals from another venue', async () => {
    const { controller, status, result } = setup();
    const trade = swapTrade();
    trade.toToken = { ...trade.toToken, decimals: null };
    await controller.compare(trade);
    controller.onCapture(TAB.matcha, 1, loadCapture('matcha', 'swap'));
    expect(status().matcha).toBe('loading');
    controller.onCapture(TAB.relay, 1, loadCapture('relay', 'swap'));
    expect(status().matcha).toBe('ok');
    expect(result('matcha')?.quotes[0]?.toDecimals).toBe(6);
  });

  it('marks an HTTP error on one venue without touching others', async () => {
    const { controller, status, result } = setup();
    await controller.compare(bridgeTrade());
    controller.onCapture(TAB.relay, 1, { id: 1, url: 'https://relay.link/api/relay/quote/v2', method: 'POST', reqBody: '', status: 500, text: 'oops', done: true });
    expect(result('relay')).toMatchObject({ status: 'error', error: 'HTTP 500' });
    expect(status().jumper).toBe('loading');
  });

  it('shows a malformed body as that venue failing', async () => {
    const { controller, result } = setup();
    await controller.compare(bridgeTrade());
    controller.onCapture(TAB.relay, 1, { ...loadCapture('relay', 'bridge'), text: '<html>' });
    expect(result('relay')?.status).toBe('error');
  });

  it('marks a finished stream without routes as empty', async () => {
    const { controller, status } = setup();
    await controller.compare(bridgeTrade());
    controller.onCapture(TAB.jumper, 1, { ...loadCapture('jumper', 'bridge'), text: 'event: done\ndata: {}\n\n' });
    expect(status().jumper).toBe('empty');
  });

  it('keeps waiting when a stream was cut off before any route arrived', async () => {
    const { controller, status } = setup();
    await controller.compare(bridgeTrade());
    const capture = loadCapture('bungee', 'bridge');
    controller.onCapture(TAB.bungee, 1, { ...capture, text: capture.text.slice(0, 200), aborted: true });
    expect(status().bungee).toBe('loading');
    controller.onCapture(TAB.bungee, 1, { ...capture, id: 2 });
    expect(status().bungee).toBe('ok');
  });

  it('marks venues that do not list a chain as unsupported, without opening them', async () => {
    const { controller, result, status, port } = setup();
    const bera = { chainId: 80094, address: NATIVE, symbol: 'BERA', decimals: 18 };
    const trade: Trade = { ...bridgeTrade(), toChainId: 80094, toToken: bera };
    await controller.compare(trade);
    expect(result('matcha')).toMatchObject({ status: 'unsupported', error: 'Not available on Berachain' });
    expect(status().jumper).toBe('loading');
    expect(port.navigate).toHaveBeenCalledTimes(4); // Jumper, Jumper Advanced, Bungee, Relay; swap-only DEXes skip bridges
    vi.advanceTimersByTime(200_000);
    expect(status().matcha).toBe('unsupported');
  });

  it('treats a chain nobody lists as unsupported everywhere', async () => {
    const { controller, status } = setup();
    const token = { chainId: 12345, address: NATIVE, symbol: 'X', decimals: 18 };
    await controller.compare({ ...bridgeTrade(), toChainId: 12345, toToken: token });
    expect(Object.values(status()).every((s) => s === 'unsupported')).toBe(true);
  });

  it('reuses the window and recreates a tab the user closed', async () => {
    const { port, controller, status } = setup();
    await controller.compare(bridgeTrade());
    controller.onTabRemoved(TAB.bungee);
    expect(status().bungee).toBe('error');
    await controller.compare(bridgeTrade());
    expect(port.createWindow).toHaveBeenCalledTimes(1);
    expect(port.createTab).toHaveBeenCalledWith(7);
    expect(port.navigate).toHaveBeenCalledTimes(10);
    expect(status().bungee).toBe('loading');
  });

  it('reports a closed venue window and opens a new one next time', async () => {
    const { port, controller, status } = setup();
    await controller.compare(bridgeTrade());
    controller.onWindowRemoved(7);
    expect(Object.values(status())).toEqual(['error', 'error', 'error', 'error', 'error', 'unsupported', 'unsupported']);
    await controller.compare(bridgeTrade());
    expect(port.createWindow).toHaveBeenCalledTimes(2);
  });

  it('refresh re-runs the last trade with a new generation', async () => {
    const { controller } = setup();
    await controller.compare(bridgeTrade());
    await controller.refresh();
    expect(controller.hello(TAB.jumper)).toMatchObject({ owned: true, generation: 2 });
  });

  it('closes the window when the panel goes away', async () => {
    const { port, controller } = setup();
    await controller.compare(bridgeTrade());
    await controller.close();
    expect(port.closeWindow).toHaveBeenCalledWith(7);
    expect(controller.hello(TAB.jumper)).toEqual({ owned: false });
  });
});
