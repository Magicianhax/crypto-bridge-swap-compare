# Decisions

Append-only. Never edit or delete an entry; supersede it with a new one. Entries are written by the lead session after the human has read the reasoning (critic output is never pasted in unread).

Format:

```
## ADR-NNNN <title> (2026-09-29)
**Status:** proposed | accepted | superseded by ADR-NNNN
**Context:** what forced the decision, in two sentences
**Decision:** what was chosen
**Consequences:** what becomes easier, what becomes harder, what must now be true
```

---

## ADR-0001 Adopt this template (2026-09-29)
**Status:** accepted
**Context:** Project bootstrapped from `~/.claude/templates/project`.
**Decision:** `PRODUCT.md`, `DESIGN.md`, `docs/ARCHITECTURE.md` and this log are the durable context; `tasks/todo.md` is the working plan.
**Consequences:** `/ship` reads these first; missing files are bootstrapped, not invented.

## ADR-0002 Read quotes from venue pages, not APIs (2026-09-29)
**Status:** accepted
**Context:** The user wants to compare Jumper, Jumper Advanced, Bungee, Relay and Matcha as their frontends quote, fees included, without integrating LI.FI or Socket directly. All five prefill from URL params and quote without a wallet.
**Decision:** A MAIN-world content script captures each page's own quote responses (fetch and XHR, including SSE) in extension-owned tabs inside one minimized window; per-venue adapters normalise them.
**Consequences:** Numbers match what each site shows, including its fee. Each venue's endpoint or shape change breaks only its adapter. Jumper's hidden-tab pause requires a visibility spoof in owned tabs.

## ADR-0003 Keep venue pages hidden and give each one a second chance (2026-10-07)
**Status:** accepted
**Context:** On Windows, Chrome opened the venue window as a normal visible window despite `state: 'minimized'`, and ignores a minimize sent before the window is on screen. Bungee moved from app.bungee.exchange to www.bungee.exchange/swap, so its page never loaded on a matched origin ("Page did not load"); Uniswap's page is slow enough to miss a 30 s window on a slow connection.
**Decision:** Create the window unfocused, then minimize once it is shown and re-check until it sticks. A venue page that has not said hello within 15 s, or has no quote at its timeout, is reloaded once and given a second wait (capped at 45 s). A timeout says where the tab got stuck. Bungee's host is www.bungee.exchange; its quote stream is unchanged.
**Consequences:** Venue tabs stay out of sight; a slow or stuck venue costs at most one extra wait. Host permissions swap app.bungee.exchange for www.bungee.exchange.
