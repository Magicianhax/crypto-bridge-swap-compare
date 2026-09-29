import { browser } from 'wxt/browser';
import { chainById, CHAINS, findToken, isNative, searchTokens } from '../../src/lib/tokens';
import type { PanelToWorker, WorkerToPanel } from '../../src/messages';
import { buildTrade, DEFAULT_STATE, flipState, resolveToken, stateFromHint, tradeKind, type FormState } from '../../src/panel/form';
import { icon } from '../../src/panel/icons';
import { logo, tokenMark } from '../../src/panel/marks';
import { buildCards, renderCards, summarize } from '../../src/panel/view';
import type { Token, Trade, VenueId } from '../../src/types';
import { ADAPTERS, hintFromUrl } from '../../src/venues';

const STORAGE_KEY = 'lastState';
/** Port traffic keeps the MV3 service worker alive while the panel is open. */
const PING_MS = 20_000;
const POPOUT = new URLSearchParams(location.search).has('popout');

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

const ticket = byId<HTMLFormElement>('ticket');
const amount = byId<HTMLInputElement>('amount');
const fromPick = byId<HTMLButtonElement>('fromPick');
const toPick = byId<HTMLButtonElement>('toPick');
const kind = byId<HTMLSpanElement>('kind');
const receiveHint = byId<HTMLSpanElement>('receiveHint');
const flip = byId<HTMLButtonElement>('flip');
const formError = byId<HTMLParagraphElement>('formError');
const refreshButton = byId<HTMLButtonElement>('refresh');
const popout = byId<HTMLButtonElement>('popout');
const summary = byId<HTMLParagraphElement>('summary');
const banner = byId<HTMLParagraphElement>('banner');
const cardsList = byId<HTMLOListElement>('cards');
const empty = byId<HTMLParagraphElement>('empty');
const picker = byId<HTMLDialogElement>('picker');
const pickerTitle = byId<HTMLHeadingElement>('pickerTitle');
const pickerClose = byId<HTMLButtonElement>('pickerClose');
const chainChips = byId<HTMLDivElement>('chainChips');
const tokenSearch = byId<HTMLInputElement>('tokenSearch');
const tokenList = byId<HTMLUListElement>('tokenList');

let state: FormState = { ...DEFAULT_STATE };
let dirty = false;
let lastTrade: Trade | null = null;
let port: ReturnType<typeof browser.runtime.connect> | null = null;
let pickerSide: 'from' | 'to' = 'from';
let pickerChainId = state.fromChainId;

/* ---------- Ticket ---------- */

function tokenFor(chainId: number, address: string): Pick<Token, 'symbol' | 'logo'> {
  return findToken(chainId, address) ?? resolveToken(chainId, address) ?? { symbol: 'Select' };
}

function renderPick(button: HTMLButtonElement, chainId: number, address: string): void {
  const chain = chainById(chainId);
  const token = tokenFor(chainId, address);
  const text = document.createElement('span');
  text.className = 'pick-text';
  const symbol = document.createElement('span');
  symbol.className = 'pick-symbol';
  symbol.textContent = token.symbol;
  const chainName = document.createElement('span');
  chainName.className = 'pick-chain';
  chainName.textContent = chain ? `on ${chain.name}` : '';
  text.append(symbol, chainName);
  button.replaceChildren(tokenMark(document, token, chain), text, icon(document, 'chevronDown', 14));
  button.setAttribute('aria-label', `${token.symbol} on ${chain?.name ?? 'unknown chain'}. Change`);
}

function renderTicket(): void {
  renderPick(fromPick, state.fromChainId, state.fromToken);
  renderPick(toPick, state.toChainId, state.toToken);
  kind.textContent = tradeKind(state);
  if (amount.value !== state.amount) amount.value = state.amount;
}

function resetReceive(): void {
  receiveHint.textContent = 'Best quote after fees';
  receiveHint.classList.remove('has-quote');
}

function setState(next: FormState, userEdit = true): void {
  state = next;
  if (userEdit) dirty = true;
  renderTicket();
  resetReceive();
}

/* ---------- Picker ---------- */

function renderChips(): void {
  chainChips.replaceChildren(
    ...CHAINS.map((chain) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.setAttribute('role', 'radio');
      chip.setAttribute('aria-checked', String(chain.id === pickerChainId));
      chip.dataset.chain = String(chain.id);
      const name = document.createElement('span');
      name.textContent = chain.name;
      chip.append(logo(document, `/logos/chains/${chain.logo}`, chain.name, ''), name);
      return chip;
    }),
  );
}

function tokenRow(token: Token, current: boolean, custom = false): HTMLLIElement {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'token';
  button.dataset.address = token.address;
  if (current) button.setAttribute('aria-current', 'true');
  const text = document.createElement('span');
  text.className = 'token-text';
  const symbol = document.createElement('span');
  symbol.className = 'token-symbol';
  symbol.textContent = token.symbol;
  const name = document.createElement('span');
  name.className = 'token-name';
  name.textContent = custom ? 'Custom token (decimals read from the venues)' : (token.name ?? '');
  text.append(symbol, name);
  const address = document.createElement('span');
  address.className = 'token-address';
  address.textContent = isNative(token.address) ? 'native' : `${token.address.slice(0, 6)}…${token.address.slice(-4)}`;
  button.append(tokenMark(document, token, chainById(token.chainId)), text, address);
  item.append(button);
  return item;
}

function renderTokens(): void {
  const query = tokenSearch.value.trim();
  const selected = pickerSide === 'from' ? state.fromToken : state.toToken;
  const selectedChain = pickerSide === 'from' ? state.fromChainId : state.toChainId;
  const matches = searchTokens(pickerChainId, query);
  const rows = matches.map((t) => tokenRow(t, t.chainId === selectedChain && t.address.toLowerCase() === selected.toLowerCase()));
  const pasted = resolveToken(pickerChainId, query);
  if (pasted && pasted.decimals === null) rows.unshift(tokenRow(pasted, false, true));
  if (rows.length === 0) {
    const none = document.createElement('li');
    none.className = 'token-empty';
    none.textContent = `No built-in token matches on ${chainById(pickerChainId)?.name ?? 'this chain'}. Paste its contract address instead.`;
    rows.push(none);
  }
  tokenList.replaceChildren(...rows);
}

function openPicker(side: 'from' | 'to'): void {
  pickerSide = side;
  pickerChainId = side === 'from' ? state.fromChainId : state.toChainId;
  pickerTitle.textContent = side === 'from' ? 'You send' : 'You receive';
  tokenSearch.value = '';
  renderChips();
  renderTokens();
  picker.showModal();
  tokenSearch.focus();
}

function choose(address: string): void {
  const next = { ...state };
  if (pickerSide === 'from') {
    next.fromChainId = pickerChainId;
    next.fromToken = address;
  } else {
    next.toChainId = pickerChainId;
    next.toToken = address;
  }
  setState(next);
  picker.close();
}

/* ---------- Worker link ---------- */

function connect(): ReturnType<typeof browser.runtime.connect> {
  if (port) return port;
  const next = browser.runtime.connect({ name: 'panel' });
  next.onMessage.addListener((message: WorkerToPanel) => {
    if (message.type === 'error') {
      banner.textContent = message.message;
      return;
    }
    banner.textContent = '';
    showResults(message.results);
  });
  next.onDisconnect.addListener(() => {
    if (port !== next) return;
    port = null;
    if (lastTrade) banner.textContent = 'This comparison moved to another window. Press Compare to run it here.';
  });
  port = next;
  return next;
}

const send = (message: PanelToWorker) => connect().postMessage(message);

function showResults(results: Parameters<typeof buildCards>[0]): void {
  const symbol = lastTrade?.toToken.symbol ?? '';
  const cards = buildCards(results);
  renderCards(cardsList, cards, symbol);
  empty.hidden = cards.length > 0;
  summary.textContent = summarize(cards, symbol);
  const winner = cards.find((c) => c.best && c.state === 'quote');
  if (winner?.receive) {
    receiveHint.textContent = winner.receive;
    receiveHint.classList.add('has-quote');
  }
}

/* ---------- Persistence and prefill ---------- */

/** The saved form is only trusted field by field; anything odd falls back to the default. */
function savedState(value: unknown): FormState {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_STATE };
  const v = value as Record<string, unknown>;
  const chain = (x: unknown, fallback: number) => (typeof x === 'number' && chainById(x) ? x : fallback);
  const text = (x: unknown, fallback: string) => (typeof x === 'string' ? x : fallback);
  return {
    fromChainId: chain(v.fromChainId, DEFAULT_STATE.fromChainId),
    toChainId: chain(v.toChainId, DEFAULT_STATE.toChainId),
    fromToken: text(v.fromToken, DEFAULT_STATE.fromToken),
    toToken: text(v.toToken, DEFAULT_STATE.toToken),
    amount: text(v.amount, DEFAULT_STATE.amount),
  };
}

async function restore(): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEY).catch(() => ({}) as Record<string, unknown>);
  setState(savedState(stored[STORAGE_KEY]), false);
}

async function prefill(): Promise<void> {
  if (dirty || POPOUT) return;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const found = tab?.url ? hintFromUrl(tab.url) : null;
  if (found && !dirty) setState(stateFromHint(found.hint, state), false);
}

/* ---------- Events ---------- */

ticket.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = buildTrade(state);
  if (!result.ok) {
    formError.textContent = result.error;
    formError.hidden = false;
    return;
  }
  formError.hidden = true;
  lastTrade = result.trade;
  setState({ ...state, amount: result.trade.amount }, false);
  refreshButton.disabled = false;
  banner.textContent = '';
  void browser.storage.local.set({ [STORAGE_KEY]: state });
  send({ type: 'compare', trade: result.trade });
});

amount.addEventListener('input', () => {
  state = { ...state, amount: amount.value };
  dirty = true;
});
fromPick.addEventListener('click', () => openPicker('from'));
toPick.addEventListener('click', () => openPicker('to'));
flip.addEventListener('click', () => setState(flipState(state)));
refreshButton.addEventListener('click', () => send({ type: 'refresh' }));

chainChips.addEventListener('click', (event) => {
  const chip = (event.target as HTMLElement).closest<HTMLButtonElement>('button.chip');
  if (!chip) return;
  pickerChainId = Number(chip.dataset.chain);
  renderChips();
  renderTokens();
  tokenSearch.focus();
});
tokenSearch.addEventListener('input', renderTokens);
tokenSearch.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  tokenList.querySelector<HTMLButtonElement>('button.token')?.click();
});
tokenList.addEventListener('click', (event) => {
  const row = (event.target as HTMLElement).closest<HTMLButtonElement>('button.token');
  if (row?.dataset.address) choose(row.dataset.address);
});
pickerClose.addEventListener('click', () => picker.close());
picker.addEventListener('click', (event) => {
  if (event.target === picker) picker.close();
});

cardsList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.open');
  const venue = button?.dataset.venue;
  if (!venue || !lastTrade || !(venue in ADAPTERS)) return;
  void browser.tabs.create({ url: ADAPTERS[venue as VenueId].buildUrl(lastTrade) });
});

popout.hidden = POPOUT;
popout.append(icon(document, 'popout', 16));
popout.addEventListener('click', () => {
  void browser.windows.create({ url: browser.runtime.getURL('/sidepanel.html?popout=1'), type: 'popup', width: 1000, height: 780 });
});

flip.append(icon(document, 'flip', 16));
refreshButton.append(icon(document, 'refresh', 16));
pickerClose.append(icon(document, 'close', 16));
document.querySelector('.search-icon')?.append(icon(document, 'search', 16));

browser.tabs.onActivated.addListener(() => void prefill());
browser.tabs.onUpdated.addListener((_tabId, change) => {
  if (change.url) void prefill();
});

setInterval(() => {
  if (port) port.postMessage({ type: 'ping' } satisfies PanelToWorker);
}, PING_MS);

renderTicket();
void restore().then(prefill);
