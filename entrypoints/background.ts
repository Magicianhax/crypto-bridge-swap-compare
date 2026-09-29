import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { Controller, type BrowserPort } from '../src/controller';
import { isCapture, type PanelToWorker, type RuntimeMessage, type WorkerToPanel } from '../src/messages';

/** 'minimized' keeps venue tabs out of sight. Switch to 'normal' if a venue stops quoting while minimized. */
const WINDOW_STATE: 'minimized' | 'normal' = 'minimized';
/** Survives a service-worker restart, so a window the old worker opened can be closed. */
const WINDOW_KEY = 'venueWindowId';

const chromePort: BrowserPort = {
  async createWindow(tabCount) {
    const win = await browser.windows.create({
      url: Array.from({ length: tabCount }, () => 'about:blank'),
      focused: false,
      ...(WINDOW_STATE === 'minimized' ? { state: 'minimized' as const } : { width: 480, height: 360, left: 0, top: 0 }),
    });
    const tabIds = (win?.tabs ?? []).map((tab) => tab.id).filter((id): id is number => id !== undefined);
    if (win?.id === undefined || tabIds.length !== tabCount) throw new Error('Could not open the venue window');
    await browser.storage.session.set({ [WINDOW_KEY]: win.id });
    return { windowId: win.id, tabIds };
  },
  async createTab(windowId) {
    const tab = await browser.tabs.create({ windowId, url: 'about:blank', active: false });
    if (tab.id === undefined) throw new Error('Could not open a venue tab');
    return tab.id;
  },
  async navigate(tabId, url) {
    await browser.tabs.update(tabId, { url });
  },
  async closeWindow(windowId) {
    await browser.storage.session.remove(WINDOW_KEY);
    await browser.windows.remove(windowId);
  },
};

/** A worker that was suspended mid-comparison left its venue window behind: close it. */
async function closeOrphanWindow(): Promise<void> {
  const stored = await browser.storage.session.get(WINDOW_KEY);
  const windowId = stored[WINDOW_KEY];
  if (typeof windowId !== 'number') return;
  await browser.storage.session.remove(WINDOW_KEY);
  await browser.windows.remove(windowId).catch(() => undefined);
}

export default defineBackground(() => {
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void closeOrphanWindow();

  type Port = ReturnType<typeof browser.runtime.connect>;
  let panel: Port | null = null;
  const send = (message: WorkerToPanel) => panel?.postMessage(message);
  const controller = new Controller(chromePort, (results) => send({ type: 'results', results }));

  browser.runtime.onConnect.addListener((port) => {
    // Only this extension's own side panel page may drive comparisons.
    if (port.name !== 'panel' || port.sender?.id !== browser.runtime.id || !port.sender.url?.startsWith(browser.runtime.getURL('/'))) return;
    // One comparison at a time: a panel opened in another window takes over.
    const previous = panel;
    panel = port;
    previous?.disconnect();
    port.onMessage.addListener((message: PanelToWorker) => {
      if (panel !== port || message.type === 'ping') return;
      const run = message.type === 'compare' ? controller.compare(message.trade) : controller.refresh();
      run.catch((error: unknown) => port.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) } satisfies WorkerToPanel));
    });
    port.onDisconnect.addListener(() => {
      if (panel !== port) return;
      panel = null;
      void controller.close();
    });
  });

  browser.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (sender.id !== browser.runtime.id || tabId === undefined) return;
    if (message.type === 'hello') {
      sendResponse(controller.hello(tabId));
      return;
    }
    if (message.type === 'capture' && typeof message.generation === 'number' && isCapture(message.capture)) {
      controller.onCapture(tabId, message.generation, message.capture, sender.url ?? '');
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => controller.onTabRemoved(tabId));
  browser.windows.onRemoved.addListener((windowId) => controller.onWindowRemoved(windowId));
});
