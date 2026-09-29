import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { Controller, type BrowserPort } from '../src/controller';
import { isCapture, type PanelToWorker, type RuntimeMessage, type WorkerToPanel } from '../src/messages';

/** 'minimized' keeps venue tabs out of sight. Switch to 'normal' if a venue stops quoting while minimized. */
const WINDOW_STATE: 'minimized' | 'normal' = 'minimized';

const chromePort: BrowserPort = {
  async createWindow(tabCount) {
    const win = await browser.windows.create({
      url: Array.from({ length: tabCount }, () => 'about:blank'),
      focused: false,
      ...(WINDOW_STATE === 'minimized' ? { state: 'minimized' as const } : { width: 480, height: 360, left: 0, top: 0 }),
    });
    const tabIds = (win?.tabs ?? []).map((tab) => tab.id).filter((id): id is number => id !== undefined);
    if (win?.id === undefined || tabIds.length !== tabCount) throw new Error('Could not open the venue window');
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
    await browser.windows.remove(windowId);
  },
};

export default defineBackground(() => {
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  let panel: ReturnType<typeof browser.runtime.connect> | null = null;
  const send = (message: WorkerToPanel) => panel?.postMessage(message);
  const controller = new Controller(chromePort, (results) => send({ type: 'results', results }));

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'panel') return;
    panel = port;
    port.onMessage.addListener((message: PanelToWorker) => {
      const run = message.type === 'compare' ? controller.compare(message.trade) : controller.refresh();
      run.catch((error: unknown) => send({ type: 'error', message: error instanceof Error ? error.message : String(error) }));
    });
    port.onDisconnect.addListener(() => {
      if (panel !== port) return;
      panel = null;
      void controller.close();
    });
  });

  browser.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    if (message.type === 'hello') {
      sendResponse(controller.hello(tabId));
      return;
    }
    if (message.type === 'capture' && typeof message.generation === 'number' && isCapture(message.capture)) {
      controller.onCapture(tabId, message.generation, message.capture);
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => controller.onTabRemoved(tabId));
  browser.windows.onRemoved.addListener((windowId) => controller.onWindowRemoved(windowId));
});
