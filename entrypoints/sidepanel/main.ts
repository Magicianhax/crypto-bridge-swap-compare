import { browser } from 'wxt/browser';
import { CHAINS, defaultToToken, findToken, NATIVE, tokensFor } from '../../src/lib/tokens';
import type { PanelToWorker, WorkerToPanel } from '../../src/messages';
import { buildTrade, DEFAULT_STATE, stateFromHint, type FormState, type Mode } from '../../src/panel/form';
import { buildRows, renderRows } from '../../src/panel/view';
import type { Trade, VenueId } from '../../src/types';
import { ADAPTERS, hintFromUrl } from '../../src/venues';

const OTHER = 'other';
const STORAGE_KEY = 'lastState';

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

const form = byId<HTMLFormElement>('trade');
const fromChain = byId<HTMLSelectElement>('fromChain');
const toChain = byId<HTMLSelectElement>('toChain');
const fromToken = byId<HTMLSelectElement>('fromToken');
const toToken = byId<HTMLSelectElement>('toToken');
const fromTokenAddr = byId<HTMLInputElement>('fromTokenAddr');
const toTokenAddr = byId<HTMLInputElement>('toTokenAddr');
const amount = byId<HTMLInputElement>('amount');
const formError = byId<HTMLParagraphElement>('formError');
const refreshButton = byId<HTMLButtonElement>('refresh');
const banner = byId<HTMLParagraphElement>('banner');
const results = byId<HTMLOListElement>('results');
const modeInputs = () => form.elements.namedItem('mode') as RadioNodeList;

let dirty = false;
let lastTrade: Trade | null = null;
let port: ReturnType<typeof browser.runtime.connect> | null = null;

function fillChains(select: HTMLSelectElement): void {
  select.replaceChildren(...CHAINS.map((c) => new Option(c.name, String(c.id))));
}

function fillTokens(select: HTMLSelectElement, addr: HTMLInputElement, chainId: number, address: string): void {
  const known = findToken(chainId, address);
  select.replaceChildren(...tokensFor(chainId).map((t) => new Option(t.symbol, t.address)), new Option('Other token…', OTHER));
  select.value = known ? known.address : address ? OTHER : NATIVE;
  addr.value = known ? '' : address;
  addr.hidden = select.value !== OTHER;
}

const tokenValue = (select: HTMLSelectElement, addr: HTMLInputElement): string => (select.value === OTHER ? addr.value.trim() : select.value);
const mode = (): Mode => (modeInputs().value === 'swap' ? 'swap' : 'bridge');

function readState(): FormState {
  return {
    mode: mode(),
    fromChainId: Number(fromChain.value),
    toChainId: Number(toChain.value),
    fromToken: tokenValue(fromToken, fromTokenAddr),
    toToken: tokenValue(toToken, toTokenAddr),
    amount: amount.value,
  };
}

function syncMode(): void {
  const swap = mode() === 'swap';
  toChain.disabled = swap;
  if (swap && toChain.value !== fromChain.value) {
    toChain.value = fromChain.value;
    fillTokens(toToken, toTokenAddr, Number(toChain.value), defaultToToken(Number(toChain.value)));
  }
}

function writeState(s: FormState): void {
  modeInputs().value = s.mode;
  fromChain.value = String(s.fromChainId);
  toChain.value = String(s.mode === 'swap' ? s.fromChainId : s.toChainId);
  fillTokens(fromToken, fromTokenAddr, s.fromChainId, s.fromToken);
  fillTokens(toToken, toTokenAddr, Number(toChain.value), s.toToken);
  amount.value = s.amount;
  syncMode();
}

function connect(): ReturnType<typeof browser.runtime.connect> {
  if (port) return port;
  const next = browser.runtime.connect({ name: 'panel' });
  next.onMessage.addListener((message: WorkerToPanel) => {
    if (message.type === 'error') {
      banner.textContent = message.message;
      return;
    }
    banner.textContent = '';
    renderRows(results, buildRows(message.results, lastTrade?.toToken.symbol ?? ''));
  });
  next.onDisconnect.addListener(() => {
    port = null;
  });
  port = next;
  return next;
}

const send = (message: PanelToWorker) => connect().postMessage(message);

async function prefill(): Promise<void> {
  if (dirty) return;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const found = tab?.url ? hintFromUrl(tab.url) : null;
  if (found) writeState(stateFromHint(found.hint, readState()));
}

async function restore(): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const saved = stored[STORAGE_KEY] as Partial<FormState> | undefined;
  writeState({ ...DEFAULT_STATE, ...saved });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = buildTrade(readState());
  if (!result.ok) {
    formError.textContent = result.error;
    formError.hidden = false;
    return;
  }
  formError.hidden = true;
  lastTrade = result.trade;
  refreshButton.disabled = false;
  void browser.storage.local.set({ [STORAGE_KEY]: readState() });
  send({ type: 'compare', trade: result.trade });
});

refreshButton.addEventListener('click', () => send({ type: 'refresh' }));

form.addEventListener('input', () => {
  dirty = true;
});

form.addEventListener('change', (event) => {
  dirty = true;
  const target = event.target;
  if (target === fromChain) {
    fillTokens(fromToken, fromTokenAddr, Number(fromChain.value), NATIVE);
    syncMode();
  } else if (target === toChain) {
    fillTokens(toToken, toTokenAddr, Number(toChain.value), defaultToToken(Number(toChain.value)));
  } else if (target === fromToken) {
    fromTokenAddr.hidden = fromToken.value !== OTHER;
  } else if (target === toToken) {
    toTokenAddr.hidden = toToken.value !== OTHER;
  } else if (target instanceof HTMLInputElement && target.name === 'mode') {
    if (mode() === 'bridge' && toChain.value === fromChain.value) {
      const other = CHAINS.find((c) => String(c.id) !== fromChain.value);
      if (other) {
        toChain.value = String(other.id);
        fillTokens(toToken, toTokenAddr, other.id, NATIVE);
      }
    }
    syncMode();
  }
});

results.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.open');
  const venue = button?.dataset.venue;
  if (!venue || !lastTrade || !(venue in ADAPTERS)) return;
  void browser.tabs.create({ url: ADAPTERS[venue as VenueId].buildUrl(lastTrade) });
});

browser.tabs.onActivated.addListener(() => void prefill());
browser.tabs.onUpdated.addListener((_tabId, change) => {
  if (change.url) void prefill();
});

fillChains(fromChain);
fillChains(toChain);
void restore().then(prefill);
