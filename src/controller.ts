import type { HelloReply } from './messages';
import { VENUE_IDS, type Capture, type Quote, type Trade, type VenueId, type VenueResult, type VenueStatus } from './types';
import { ADAPTERS } from './venues';
import type { VenueAdapter } from './venues/types';

export interface BrowserPort {
  /** Opens one unfocused window holding `tabCount` blank tabs. */
  createWindow(tabCount: number): Promise<{ windowId: number; tabIds: number[] }>;
  /** Opens one blank tab in the window. */
  createTab(windowId: number): Promise<number>;
  navigate(tabId: number, url: string): Promise<void>;
  closeWindow(windowId: number): Promise<void>;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export class Controller {
  private windowId: number | null = null;
  private readonly tabs = new Map<number, VenueId>();
  private generation = 0;
  private trade: Trade | null = null;
  private readonly results = new Map<VenueId, VenueResult>();
  private readonly captures = new Map<VenueId, Capture>();
  private readonly timers = new Map<VenueId, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly port: BrowserPort,
    private readonly emit: (results: VenueResult[]) => void,
    private readonly adapters: Record<VenueId, VenueAdapter> = ADAPTERS,
  ) {}

  snapshot(): VenueResult[] {
    return VENUE_IDS.map((venue) => this.results.get(venue) ?? { venue, status: 'idle', quotes: [], updatedAt: 0 });
  }

  async compare(trade: Trade): Promise<void> {
    const generation = ++this.generation;
    const current: Trade = { ...trade, fromToken: { ...trade.fromToken }, toToken: { ...trade.toToken } };
    this.trade = current;
    this.captures.clear();
    this.clearTimers();

    const urls = new Map<VenueId, string>();
    for (const venue of VENUE_IDS) {
      try {
        urls.set(venue, this.adapters[venue].buildUrl(current));
        this.set(venue, 'loading');
      } catch (error) {
        this.set(venue, 'error', [], errorText(error));
      }
    }
    this.publish();

    try {
      await this.ensureTabs();
    } catch (error) {
      for (const venue of urls.keys()) this.set(venue, 'error', [], errorText(error));
      this.publish();
      return;
    }
    if (generation !== this.generation) return;

    const tabOf = new Map([...this.tabs].map(([tabId, venue]) => [venue, tabId] as const));
    await Promise.all(
      [...urls].map(async ([venue, url]) => {
        const tabId = tabOf.get(venue);
        if (tabId === undefined) {
          this.set(venue, 'error', [], 'No tab');
          return;
        }
        this.startTimer(venue, generation);
        try {
          await this.port.navigate(tabId, url);
        } catch (error) {
          if (generation === this.generation) this.set(venue, 'error', [], errorText(error));
        }
      }),
    );
    this.publish();
  }

  async refresh(): Promise<void> {
    if (this.trade) await this.compare(this.trade);
  }

  hello(tabId: number): HelloReply {
    const venue = this.tabs.get(tabId);
    if (venue === undefined || this.trade === null) return { owned: false };
    const input = this.adapters[venue].amountInput;
    return { owned: true, venue, generation: this.generation, ...(input ? { fill: { ...input, value: this.trade.amount } } : {}) };
  }

  onCapture(tabId: number, generation: number, capture: Capture): void {
    const venue = this.tabs.get(tabId);
    if (venue === undefined || this.trade === null || generation !== this.generation) return;
    const previous = this.captures.get(venue);
    if (previous && previous.id > capture.id) return;
    this.captures.set(venue, capture);
    this.reparse(venue);
    this.publish();
  }

  onTabRemoved(tabId: number): void {
    const venue = this.tabs.get(tabId);
    if (venue === undefined) return;
    this.tabs.delete(tabId);
    if (this.results.get(venue)?.status === 'loading') {
      this.set(venue, 'error', [], 'Tab closed');
      this.publish();
    }
  }

  onWindowRemoved(windowId: number): void {
    if (windowId !== this.windowId) return;
    this.windowId = null;
    for (const tabId of [...this.tabs.keys()]) this.onTabRemoved(tabId);
  }

  async close(): Promise<void> {
    this.generation += 1;
    this.clearTimers();
    this.trade = null;
    this.tabs.clear();
    this.captures.clear();
    this.results.clear();
    const windowId = this.windowId;
    this.windowId = null;
    if (windowId !== null) await this.port.closeWindow(windowId).catch(() => undefined);
  }

  /** Tabs are created blank and recorded before navigation, so the first hello always finds its tab. */
  private async ensureTabs(): Promise<void> {
    if (this.windowId === null) {
      const { windowId, tabIds } = await this.port.createWindow(VENUE_IDS.length);
      this.windowId = windowId;
      this.tabs.clear();
      VENUE_IDS.forEach((venue, i) => {
        const tabId = tabIds[i];
        if (tabId !== undefined) this.tabs.set(tabId, venue);
      });
      return;
    }
    const present = new Set(this.tabs.values());
    for (const venue of VENUE_IDS) {
      if (!present.has(venue)) this.tabs.set(await this.port.createTab(this.windowId), venue);
    }
  }

  private reparse(venue: VenueId): void {
    const capture = this.captures.get(venue);
    const trade = this.trade;
    if (!capture || !trade) return;
    if (capture.done && capture.status >= 400) {
      this.set(venue, 'error', [], `HTTP ${capture.status}`);
      return;
    }
    let quotes: Quote[] | null;
    try {
      quotes = this.adapters[venue].parse(capture, trade);
    } catch (error) {
      this.set(venue, 'error', [], errorText(error));
      return;
    }
    if (quotes === null) return;
    const first = quotes[0];
    if (first) {
      this.set(venue, 'ok', quotes);
      if (trade.toToken.decimals === null) {
        // A pasted token: learn its decimals and re-price venues that were waiting (Matcha).
        trade.toToken.decimals = first.toDecimals;
        for (const other of VENUE_IDS) if (other !== venue) this.reparse(other);
      }
      return;
    }
    if (capture.done) this.set(venue, 'empty');
  }

  private set(venue: VenueId, status: VenueStatus, quotes: Quote[] = [], error?: string): void {
    this.results.set(venue, { venue, status, quotes, updatedAt: Date.now(), ...(error ? { error } : {}) });
    if (status !== 'loading') {
      const timer = this.timers.get(venue);
      if (timer !== undefined) clearTimeout(timer);
      this.timers.delete(venue);
    }
  }

  private startTimer(venue: VenueId, generation: number): void {
    const existing = this.timers.get(venue);
    if (existing !== undefined) clearTimeout(existing);
    this.timers.set(
      venue,
      setTimeout(() => {
        this.timers.delete(venue);
        if (generation === this.generation && this.results.get(venue)?.status === 'loading') {
          this.set(venue, 'timeout');
          this.publish();
        }
      }, this.adapters[venue].timeoutMs),
    );
  }

  private clearTimers(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private publish(): void {
    this.emit(this.snapshot());
  }
}
