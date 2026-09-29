# Quote Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chrome MV3 side-panel extension that compares swap and bridge quotes from Jumper, Jumper Advanced, Bungee, Relay and Matcha by reading the quote responses each site's own page receives.

**Architecture:** Pure venue adapters (`src/venues/`) build each site's prefilled URL and turn its recorded quote response into a common `Quote`. A MAIN-world content script wraps `fetch`/XHR on the four venue origins and posts matching responses; an ISOLATED script forwards them to the service worker only for tabs the worker owns. The worker's `Controller` owns one minimized window of five tabs, runs timeouts and parsing, and streams `VenueResult[]` to the side panel over a port.

**Tech Stack:** TypeScript 5.9.3, WXT 0.21.4 (MV3), Vitest 5.0.2, happy-dom 20.14.5, oxlint 1.86.0, pnpm 11.15.1, Node >= 24.

**Spec:** `docs/superpowers/specs/2026-09-29-quote-compare-extension-design.md`. Venue evidence: `docs/TEARDOWNS/venues.md`.

## Status

- [x] Context bootstrapped from template (2026-09-29)
- [x] Venue teardown: `docs/TEARDOWNS/venues.md`
- [x] Design approved, spec written and approved
- [x] Fixtures recorded and sanitized (gitleaks clean) at `C:/Users/musha/AppData/Local/Temp/claude/F--Compare/eeb523ce-4ca1-499b-a1f9-ad60382858cd/scratchpad/rec/fixtures/`
- [ ] Plan reviewed by user
- [ ] Tasks 1-11 below

## Global Constraints

- Extension code never issues its own network request. The only `fetch`/XHR code is the wrapper around the page's own calls in `src/capture/interceptor.ts`.
- Manifest permissions are exactly `sidePanel`, `storage`, `tabs`. Hosts are exactly `https://jumper.xyz/*`, `https://app.bungee.exchange/*`, `https://relay.link/*`, `https://matcha.xyz/*`. Adding anything else is a human gate.
- Adapters in `src/venues/` are pure: no `chrome.*`/`browser.*`, no DOM, no network.
- Text from captured responses is rendered with `textContent` only, never `innerHTML`.
- No wallet, signing or approval code.
- Chains: Ethereum 1, Arbitrum 42161, Base 8453, Optimism 10, Polygon 137, BNB 56. Canonical native token address in our types is `0x0000000000000000000000000000000000000000` (`NATIVE`).
- Venue timeouts: 30 000 ms; Matcha 40 000 ms.
- Relative imports only (no `@/` aliases), so Vitest needs no WXT plugin.
- `pnpm verify` = `tsc --noEmit && oxlint . && vitest run`, under 120 s.
- Commits: small, one per task at minimum, conventional prefixes (`feat:`, `test:`, `chore:`).

## Review Focus

1. A capture from the previous comparison (old page still unloading) lands in the new table. Expected: dropped by generation. Test in Task 9 ("drops captures from an earlier comparison").
2. The user closes the minimized venue window, or one venue tab, mid-comparison. Expected: that venue shows "Failed: Tab closed" and the next Compare recreates what is missing. Tests in Task 9.
3. A pasted token address with unknown decimals. Expected: Matcha waits, then prices once any other venue reports the decimals. Test in Task 9 ("fills unknown token decimals from another venue").
4. Route names or error text from a venue page containing markup. Expected: shown as literal text. Test in Task 10 ("renders venue text as text").
5. Amount typed as `1,5`, `.5`, `0` or `abc`. Expected: first two normalized to `1.5`/`0.5`, last two rejected with a message. Tests in Task 2 (`normalizeAmount`) and Task 10 (`buildTrade`).

## File map

| File | Responsibility |
|---|---|
| `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.oxlintrc.json` | toolchain, manifest |
| `src/types.ts` | shared data types, `VENUE_IDS` |
| `src/messages.ts` | message types and guards between page, content scripts, worker, panel |
| `src/lib/json.ts` | `safeJson`, `isRecord`, `num`, `isUint` |
| `src/lib/sse.ts` | `parseSse` |
| `src/lib/units.ts` | `formatUnits`, `normalizeAmount` |
| `src/lib/rank.ts` | `rankQuotes` |
| `src/lib/format.ts` | fee/gas/eta/delta/usd display strings |
| `src/lib/tokens.ts` | chains, built-in tokens, native-address helpers |
| `src/venues/types.ts` | `VenueAdapter` interface |
| `src/venues/url.ts` | shared URL param readers |
| `src/venues/{jumper,bungee,relay,matcha}.ts` | one adapter each (`makeJumper` covers both Jumper venues) |
| `src/venues/index.ts` | `ADAPTERS`, `VENUE_MATCHES`, `matchesAnyVenue`, `hintFromUrl` |
| `src/capture/interceptor.ts` | fetch/XHR wrapper |
| `src/capture/visibility.ts` | `spoofVisibility` |
| `src/capture/fill.ts` | `fillAmount`, `scheduleFill` |
| `src/controller.ts` | worker state machine behind a `BrowserPort` |
| `src/panel/form.ts` | form state -> `Trade`, URL hint -> form state |
| `src/panel/view.ts` | results -> rows -> DOM |
| `entrypoints/background.ts` | wires `Controller` to Chrome APIs |
| `entrypoints/interceptor.content.ts` | MAIN world |
| `entrypoints/relay.content.ts` | ISOLATED world |
| `entrypoints/sidepanel/{index.html,main.ts,style.css}` | panel UI |
| `tests/**` | Vitest suites; `tests/fixtures/<venue>/{bridge,swap}.json` recorded captures |
| `scripts/smoke.mjs` | live end-to-end check (not part of `verify`) |

---

### Task 1: Scaffold the WXT project

**Skill for implementer:** `chrome-extensions`, `superpowers:test-driven-development`.

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.oxlintrc.json`, `src/types.ts`, `entrypoints/background.ts`, `tests/helpers.ts`, `tests/scaffold.test.ts`, `tests/fixtures/**` (copied)
- Modify: `.gitignore` (append), restore `.claude/verify.json`
- Delete: `tasks/verify.json.pending`

**Interfaces:**
- Produces: every type in `src/types.ts` exactly as below; `loadCapture(venue, kind)` in `tests/helpers.ts`.

- [ ] **Step 1: Set repo identity and create `package.json`**

```bash
git config user.email magicianafk@gmail.com
```

`package.json`:

```json
{
  "name": "quote-compare",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=24" },
  "packageManager": "pnpm@11.15.1",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "postinstall": "wxt prepare",
    "verify": "tsc --noEmit && oxlint . && vitest run",
    "smoke": "wxt build && node scripts/smoke.mjs"
  }
}
```

- [ ] **Step 2: Install pinned dev dependencies**

```bash
pnpm add -D wxt@0.21.4 typescript@5.9.3 vitest@5.0.2 happy-dom@20.14.5 oxlint@1.86.0 @types/node@^24 playwright@1.63.0
```

If pnpm reports ignored build scripts (for example `esbuild`), run `pnpm approve-builds`, approve `esbuild` only, and re-run `pnpm install`.

- [ ] **Step 3: Write config files**

`wxt.config.ts`:

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Quote Compare',
    description:
      "Compare swap and bridge quotes from Jumper, Jumper Advanced, Bungee, Relay and Matcha, read from each site's own page.",
    permissions: ['sidePanel', 'storage', 'tabs'],
    host_permissions: [
      'https://jumper.xyz/*',
      'https://app.bungee.exchange/*',
      'https://relay.link/*',
      'https://matcha.xyz/*',
    ],
    action: { default_title: 'Quote Compare' },
  },
});
```

`tsconfig.json`:

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noEmit": true
  }
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

`.oxlintrc.json`:

```json
{ "ignorePatterns": [".output/**", ".wxt/**", "node_modules/**"] }
```

Append to `.gitignore`:

```
# build
node_modules/
.output/
.wxt/
```

- [ ] **Step 4: Copy the recorded fixtures and restore the verify marker**

```bash
mkdir -p tests/fixtures
cp -r "C:/Users/musha/AppData/Local/Temp/claude/F--Compare/eeb523ce-4ca1-499b-a1f9-ad60382858cd/scratchpad/rec/fixtures/." tests/fixtures/
ls tests/fixtures/*
mkdir -p .claude && git mv tasks/verify.json.pending .claude/verify.json
```

Expected `ls`: `bungee/ jumper/ jumper-advanced/ matcha/ relay/`, each with `bridge.json` and `swap.json`.

- [ ] **Step 5: Write `src/types.ts`**

```ts
export type VenueId = 'jumper' | 'jumper-advanced' | 'bungee' | 'relay' | 'matcha';
export const VENUE_IDS: readonly VenueId[] = ['jumper', 'jumper-advanced', 'bungee', 'relay', 'matcha'];

export type Address = `0x${string}`;

export interface Token {
  chainId: number;
  address: Address;
  symbol: string;
  /** null for a pasted address until a venue reports it */
  decimals: number | null;
}

export interface Trade {
  fromChainId: number;
  toChainId: number;
  fromToken: Token;
  toToken: Token;
  /** human units, already normalised by normalizeAmount */
  amount: string;
}

export interface VenueFee {
  label: string;
  usd?: number;
  /** percent: 0.25 means 0.25% */
  pct?: number;
}

export interface Quote {
  venue: VenueId;
  route: string;
  /** raw integer string in toDecimals units */
  toAmount: string;
  toDecimals: number;
  toAmountUsd?: number;
  gasUsd?: number;
  venueFee?: VenueFee;
  etaSec?: number;
  tags?: string[];
}

export type VenueStatus = 'idle' | 'loading' | 'ok' | 'empty' | 'error' | 'timeout';

export interface VenueResult {
  venue: VenueId;
  status: VenueStatus;
  quotes: Quote[];
  error?: string;
  updatedAt: number;
}

/** One quote response as the venue page received it. */
export interface Capture {
  /** increases per page load; a higher id supersedes a lower one */
  id: number;
  url: string;
  method: string;
  reqBody: string;
  status: number;
  text: string;
  done: boolean;
}

/** Partial trade read from a venue page URL. Native tokens use NATIVE. */
export interface TradeHint {
  fromChainId?: number;
  toChainId?: number;
  fromToken?: Address;
  toToken?: Address;
  amount?: string;
}
```

- [ ] **Step 6: Minimal background so WXT has an entrypoint**

`entrypoints/background.ts`:

```ts
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
```

- [ ] **Step 7: Write the failing test and helper**

`tests/helpers.ts`:

```ts
import { readFileSync } from 'node:fs';
import type { Capture } from '../src/types';

export function loadCapture(venue: string, kind: 'bridge' | 'swap'): Capture {
  const path = new URL(`./fixtures/${venue}/${kind}.json`, import.meta.url);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Omit<Capture, 'id' | 'done'>;
  return { id: 1, done: true, ...raw };
}
```

`tests/scaffold.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { VENUE_IDS } from '../src/types';
import { loadCapture } from './helpers';

describe('scaffold', () => {
  it('lists the five venues in display order', () => {
    expect(VENUE_IDS).toEqual(['jumper', 'jumper-advanced', 'bungee', 'relay', 'matcha']);
  });

  it('loads a recorded capture', () => {
    const capture = loadCapture('relay', 'bridge');
    expect(capture.url).toBe('https://relay.link/api/relay/quote/v2');
    expect(capture.done).toBe(true);
  });
});
```

- [ ] **Step 8: Run verify**

Run: `pnpm exec wxt prepare && pnpm verify`
Expected: tsc and oxlint clean; Vitest `2 passed`. (If Step 5 was skipped the test fails with "Cannot find module '../src/types'"; that is the red state.)

If `tsc` reports missing Node types in `tests/helpers.ts`, add `"types": ["node"]` to `compilerOptions` and re-run.

- [ ] **Step 9: Check the build and manifest**

Run: `pnpm build && node -e "const m=require('./.output/chrome-mv3/manifest.json');console.log(m.manifest_version,JSON.stringify(m.permissions),JSON.stringify(m.host_permissions))"`
Expected: `3 ["sidePanel","storage","tabs"] ["https://jumper.xyz/*","https://app.bungee.exchange/*","https://relay.link/*","https://matcha.xyz/*"]`

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold WXT extension, types, fixtures and verify"
```

---

### Task 2: Pure helpers (JSON, SSE, units, ranking)

**Skill for implementer:** `superpowers:test-driven-development`.

**Files:**
- Create: `src/lib/json.ts`, `src/lib/sse.ts`, `src/lib/units.ts`, `src/lib/rank.ts`
- Test: `tests/lib/sse.test.ts`, `tests/lib/units.test.ts`, `tests/lib/rank.test.ts`

**Interfaces:**
- Produces:
  - `safeJson(text: string): unknown`, `isRecord(x: unknown): x is Record<string, unknown>`, `num(x: unknown): number | undefined`, `isUint(x: unknown): x is string`
  - `interface SseEvent { event: string; data: string; id?: string }`, `parseSse(text: string): SseEvent[]`
  - `formatUnits(raw: string | bigint, decimals: number, maxFraction?: number): string`, `normalizeAmount(input: string): string | null`
  - `interface RankedQuote extends Quote { best: boolean; deltaPct: number }`, `rankQuotes(quotes: Quote[]): RankedQuote[]`

- [ ] **Step 1: Write failing tests**

`tests/lib/sse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSse } from '../../src/lib/sse';
import { loadCapture } from '../helpers';

describe('parseSse', () => {
  it('parses event names, data and ids', () => {
    const text = 'event: routes\ndata: {"a":1}\n\nid: 7\nevent: done\ndata: x\ndata: y\n\n';
    expect(parseSse(text)).toEqual([
      { event: 'routes', data: '{"a":1}' },
      { event: 'done', data: 'x\ny', id: '7' },
    ]);
  });

  it('skips a trailing record that has not finished arriving', () => {
    expect(parseSse('event: a\ndata: 1\n\nevent: b\ndata: {"trunc')).toEqual([{ event: 'a', data: '1' }]);
  });

  it('handles CRLF line endings and comment lines', () => {
    expect(parseSse(': keepalive\r\nevent: a\r\ndata: 1\r\n\r\n')).toEqual([{ event: 'a', data: '1' }]);
  });

  it('defaults the event name to message', () => {
    expect(parseSse('data: 1\n\n')).toEqual([{ event: 'message', data: '1' }]);
  });

  it('reads the recorded Bungee and Jumper streams', () => {
    const bungee = parseSse(loadCapture('bungee', 'bridge').text);
    expect(bungee[0]?.event).toBe('snapshot');
    expect(bungee.at(-1)?.event).toBe('done');
    expect(bungee).toHaveLength(24);
    const jumper = parseSse(loadCapture('jumper', 'bridge').text);
    expect(jumper.map((e) => e.event)).toEqual([...Array(9).fill('routes'), 'done']);
  });
});
```

`tests/lib/units.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatUnits, normalizeAmount } from '../../src/lib/units';

describe('formatUnits', () => {
  it('truncates to six fraction digits', () => {
    expect(formatUnits('99969599957024680', 18)).toBe('0.099969');
  });
  it('keeps exact small-decimal amounts', () => {
    expect(formatUnits('272060462', 6)).toBe('272.060462');
  });
  it('drops trailing zeros and the point', () => {
    expect(formatUnits('100000000', 6)).toBe('100');
    expect(formatUnits('0', 18)).toBe('0');
  });
  it('respects maxFraction', () => {
    expect(formatUnits('123456789000000000000000', 18, 2)).toBe('123456.78');
  });
  it('formats negatives', () => {
    expect(formatUnits(-1500000n, 6)).toBe('-1.5');
  });
});

describe('normalizeAmount', () => {
  it.each([
    ['0.1', '0.1'],
    [' 1,5 ', '1.5'],
    ['.5', '0.5'],
    ['01.50', '1.50'],
  ])('accepts %j as %j', (input, out) => {
    expect(normalizeAmount(input)).toBe(out);
  });
  it.each(['', '0', '0.000', 'abc', '1e3', '-1', '1.2.3'])('rejects %j', (input) => {
    expect(normalizeAmount(input)).toBeNull();
  });
});
```

`tests/lib/rank.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rankQuotes } from '../../src/lib/rank';
import type { Quote, VenueId } from '../../src/types';

const q = (venue: VenueId, toAmount: string, toDecimals = 6, etaSec?: number): Quote => ({
  venue,
  route: `${venue}-${toAmount}`,
  toAmount,
  toDecimals,
  ...(etaSec === undefined ? {} : { etaSec }),
});

describe('rankQuotes', () => {
  it('returns an empty list for no quotes', () => {
    expect(rankQuotes([])).toEqual([]);
  });

  it('sorts by amount received, then by ETA', () => {
    const ranked = rankQuotes([q('jumper', '100'), q('bungee', '300'), q('relay', '200', 6, 5), q('matcha', '200', 6, 2)]);
    expect(ranked.map((r) => r.venue)).toEqual(['bungee', 'matcha', 'relay', 'jumper']);
    expect(ranked[0]?.best).toBe(true);
    expect(ranked[0]?.deltaPct).toBe(0);
    expect(ranked[3]?.deltaPct).toBeCloseTo(-66.6666, 3);
  });

  it('marks ties with the top amount as best', () => {
    const ranked = rankQuotes([q('jumper', '5'), q('bungee', '5')]);
    expect(ranked.every((r) => r.best)).toBe(true);
  });

  it('compares quotes reported with different decimals', () => {
    const ranked = rankQuotes([q('relay', '1000000', 6), q('jumper', '2000000000000000000', 18)]);
    expect(ranked.map((r) => r.venue)).toEqual(['jumper', 'relay']);
    expect(ranked[1]?.deltaPct).toBe(-50);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm vitest run tests/lib`
Expected: FAIL, "Cannot find module '../../src/lib/sse'" (and the same for units and rank).

- [ ] **Step 3: Implement**

`src/lib/json.ts`:

```ts
export function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function num(x: unknown): number | undefined {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) return Number(x);
  return undefined;
}

/** A non-negative integer in string form, as token amounts arrive. */
export function isUint(x: unknown): x is string {
  return typeof x === 'string' && /^\d+$/.test(x);
}
```

`src/lib/sse.ts`:

```ts
export interface SseEvent {
  event: string;
  data: string;
  id?: string;
}

/** Parses complete text/event-stream records. A trailing record without its blank-line terminator is skipped. */
export function parseSse(text: string): SseEvent[] {
  const blocks = text.replace(/\r\n?/g, '\n').split('\n\n');
  blocks.pop(); // '' when the body ended cleanly, otherwise a record still arriving
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let event = 'message';
    let id: string | undefined;
    const data: string[] = [];
    let seen = false;
    for (const line of block.split('\n')) {
      if (line === '' || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') {
        event = value;
        seen = true;
      } else if (field === 'data') {
        data.push(value);
        seen = true;
      } else if (field === 'id') {
        id = value;
      }
    }
    if (seen) events.push(id === undefined ? { event, data: data.join('\n') } : { event, data: data.join('\n'), id });
  }
  return events;
}
```

`src/lib/units.ts`:

```ts
/** Formats a raw integer amount, truncating (never rounding up) to maxFraction digits. */
export function formatUnits(raw: string | bigint, decimals: number, maxFraction = 6): string {
  const value = typeof raw === 'bigint' ? raw : BigInt(raw);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '');
  const out = fraction ? `${whole}.${fraction}` : `${whole}`;
  return negative ? `-${out}` : out;
}

/** Accepts "1,5" and ".5"; returns null for anything that is not a positive decimal. */
export function normalizeAmount(input: string): string | null {
  let s = input.trim().replace(',', '.');
  if (s.startsWith('.')) s = `0${s}`;
  if (!/^\d+(\.\d+)?$/.test(s) || !/[1-9]/.test(s)) return null;
  return s.replace(/^0+(?=\d)/, '');
}
```

`src/lib/rank.ts`:

```ts
import type { Quote } from '../types';

export interface RankedQuote extends Quote {
  best: boolean;
  /** percent vs the best quote, 0 for the best, negative otherwise */
  deltaPct: number;
}

export function rankQuotes(quotes: Quote[]): RankedQuote[] {
  const first = quotes[0];
  if (!first) return [];
  const maxDecimals = Math.max(...quotes.map((q) => q.toDecimals));
  const scaled = (q: Quote) => BigInt(q.toAmount) * 10n ** BigInt(maxDecimals - q.toDecimals);
  const sorted = [...quotes].sort((a, b) => {
    const diff = scaled(b) - scaled(a);
    if (diff !== 0n) return diff > 0n ? 1 : -1;
    return (a.etaSec ?? Number.MAX_SAFE_INTEGER) - (b.etaSec ?? Number.MAX_SAFE_INTEGER);
  });
  const top = scaled(sorted[0] ?? first);
  return sorted.map((q) => {
    const value = scaled(q);
    const deltaPct = top === 0n ? 0 : Number(((value - top) * 1_000_000n) / top) / 10_000;
    return { ...q, best: value === top, deltaPct };
  });
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `pnpm vitest run tests/lib`
Expected: PASS, all tests in the three files.

- [ ] **Step 5: Commit**

```bash
git add src/lib tests/lib
git commit -m "feat: SSE parser, unit formatting and quote ranking"
```

---

### Task 3: Chains and built-in tokens

**Skill for implementer:** `superpowers:test-driven-development`.

**Files:**
- Create: `src/lib/tokens.ts`
- Modify: `tests/helpers.ts` (add trade builders)
- Test: `tests/lib/tokens.test.ts`

**Interfaces:**
- Consumes: `Address`, `Token`, `Trade` from `src/types.ts`.
- Produces: `NATIVE`, `EEEE`, `interface Chain { id; name; relaySlug }`, `CHAINS`, `TOKENS`, `isNative(a)`, `sameToken(a, b)`, `chainById(id)`, `tokensFor(chainId)`, `findToken(chainId, address)`, `venueAddress(address, native)`, `defaultToToken(chainId): Address`. Test helpers `USDC_BASE`, `bridgeTrade()`, `swapTrade()`.

- [ ] **Step 1: Write the failing test**

`tests/lib/tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CHAINS, EEEE, NATIVE, TOKENS, chainById, defaultToToken, findToken, isNative, sameToken, tokensFor, venueAddress } from '../../src/lib/tokens';

describe('tokens', () => {
  it('covers the six chains with native, USDC and USDT', () => {
    expect(CHAINS.map((c) => c.id)).toEqual([1, 42161, 8453, 10, 137, 56]);
    for (const chain of CHAINS) {
      const symbols = tokensFor(chain.id).map((t) => t.symbol);
      expect(symbols).toContain('USDC');
      expect(symbols).toContain('USDT');
      expect(tokensFor(chain.id)[0]?.address).toBe(NATIVE);
    }
  });

  it('uses valid, unique addresses', () => {
    const keys = TOKENS.map((t) => `${t.chainId}:${t.address.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TOKENS) expect(t.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('knows BNB Chain stablecoins use 18 decimals', () => {
    expect(TOKENS.filter((t) => t.chainId === 56 && t.symbol.startsWith('USD')).map((t) => t.decimals)).toEqual([18, 18]);
  });

  it('matches addresses case-insensitively and treats 0xeee as native', () => {
    expect(findToken(8453, '0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913')?.symbol).toBe('USDC');
    expect(findToken(42161, EEEE)?.symbol).toBe('ETH');
    expect(isNative(EEEE)).toBe(true);
    expect(sameToken(NATIVE, EEEE)).toBe(true);
    expect(sameToken(NATIVE, '0x4200000000000000000000000000000000000006')).toBe(false);
  });

  it('maps chains to Relay slugs', () => {
    expect(CHAINS.map((c) => c.relaySlug)).toEqual(['ethereum', 'arbitrum', 'base', 'optimism', 'polygon', 'bsc']);
    expect(chainById(999)).toBeUndefined();
  });

  it('rewrites native to the venue convention only', () => {
    expect(venueAddress(NATIVE, EEEE)).toBe(EEEE);
    expect(venueAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', EEEE)).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('defaults the destination token to USDC', () => {
    expect(defaultToToken(8453)).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(defaultToToken(999)).toBe(NATIVE);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm vitest run tests/lib/tokens.test.ts`
Expected: FAIL, "Cannot find module '../../src/lib/tokens'".

- [ ] **Step 3: Implement `src/lib/tokens.ts`**

```ts
import type { Address, Token } from '../types';

export const NATIVE: Address = '0x0000000000000000000000000000000000000000';
export const EEEE: Address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export interface Chain {
  id: number;
  name: string;
  relaySlug: string;
}

export const CHAINS: readonly Chain[] = [
  { id: 1, name: 'Ethereum', relaySlug: 'ethereum' },
  { id: 42161, name: 'Arbitrum', relaySlug: 'arbitrum' },
  { id: 8453, name: 'Base', relaySlug: 'base' },
  { id: 10, name: 'Optimism', relaySlug: 'optimism' },
  { id: 137, name: 'Polygon', relaySlug: 'polygon' },
  { id: 56, name: 'BNB Chain', relaySlug: 'bsc' },
];

const t = (chainId: number, address: Address, symbol: string, decimals: number): Token => ({ chainId, address, symbol, decimals });

export const TOKENS: readonly Token[] = [
  t(1, NATIVE, 'ETH', 18),
  t(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'WETH', 18),
  t(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', 6),
  t(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT', 6),
  t(42161, NATIVE, 'ETH', 18),
  t(42161, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 'WETH', 18),
  t(42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 'USDC', 6),
  t(42161, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 'USDT', 6),
  t(8453, NATIVE, 'ETH', 18),
  t(8453, '0x4200000000000000000000000000000000000006', 'WETH', 18),
  t(8453, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'USDC', 6),
  t(8453, '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', 'USDT', 6),
  t(10, NATIVE, 'ETH', 18),
  t(10, '0x4200000000000000000000000000000000000006', 'WETH', 18),
  t(10, '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', 'USDC', 6),
  t(10, '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', 'USDT', 6),
  t(137, NATIVE, 'POL', 18),
  t(137, '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', 'WPOL', 18),
  t(137, '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', 'WETH', 18),
  t(137, '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 'USDC', 6),
  t(137, '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 'USDT', 6),
  t(56, NATIVE, 'BNB', 18),
  t(56, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 'WBNB', 18),
  t(56, '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 'ETH', 18),
  t(56, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 'USDC', 18),
  t(56, '0x55d398326f99059fF775485246999027B3197955', 'USDT', 18),
];

export function isNative(address: string): boolean {
  const a = address.toLowerCase();
  return a === NATIVE || a === EEEE;
}

export function sameToken(a: string, b: string): boolean {
  return (isNative(a) && isNative(b)) || a.toLowerCase() === b.toLowerCase();
}

export const chainById = (id: number): Chain | undefined => CHAINS.find((c) => c.id === id);

export const tokensFor = (chainId: number): Token[] => TOKENS.filter((x) => x.chainId === chainId);

export const findToken = (chainId: number, address: string): Token | undefined =>
  TOKENS.find((x) => x.chainId === chainId && sameToken(x.address, address));

/** The address form a venue expects: its own native placeholder for the gas token, else unchanged. */
export const venueAddress = (address: Address, native: Address): Address => (isNative(address) ? native : address);

export const defaultToToken = (chainId: number): Address =>
  tokensFor(chainId).find((x) => x.symbol === 'USDC')?.address ?? NATIVE;
```

- [ ] **Step 4: Add trade builders to `tests/helpers.ts`**

Append:

```ts
import { findToken, NATIVE } from '../src/lib/tokens';
import type { Token, Trade } from '../src/types';

export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

function mustToken(chainId: number, address: string): Token {
  const token = findToken(chainId, address);
  if (!token) throw new Error(`No built-in token ${chainId}:${address}`);
  return { ...token };
}

/** The trade recorded in tests/fixtures/<venue>/bridge.json: 0.1 ETH Arbitrum -> ETH Base. */
export const bridgeTrade = (): Trade => ({
  fromChainId: 42161,
  toChainId: 8453,
  fromToken: mustToken(42161, NATIVE),
  toToken: mustToken(8453, NATIVE),
  amount: '0.1',
});

/** The trade recorded in tests/fixtures/<venue>/swap.json: 0.1 ETH -> USDC on Base. */
export const swapTrade = (): Trade => ({
  fromChainId: 8453,
  toChainId: 8453,
  fromToken: mustToken(8453, NATIVE),
  toToken: mustToken(8453, USDC_BASE),
  amount: '0.1',
});
```

Move the new `import` lines to the top of the file next to the existing imports.

- [ ] **Step 5: Run to confirm pass**

Run: `pnpm vitest run tests/lib/tokens.test.ts && pnpm verify`
Expected: PASS; verify clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tokens.ts tests/lib/tokens.test.ts tests/helpers.ts
git commit -m "feat: chains and built-in tokens"
```

---

### Task 4: Adapter contract and Jumper / Jumper Advanced adapter

**Skill for implementer:** `superpowers:test-driven-development`. Read `docs/TEARDOWNS/venues.md` (Jumper rows) first.

**Files:**
- Create: `src/venues/types.ts`, `src/venues/url.ts`, `src/venues/jumper.ts`
- Test: `tests/venues/jumper.test.ts`

**Interfaces:**
- Consumes: Task 2 `parseSse`, `safeJson`, `isRecord`, `num`, `isUint`, `normalizeAmount`; Task 3 `NATIVE`, `isNative`, `sameToken`, `venueAddress`.
- Produces:
  - `interface AmountInput { selector: string; afterMs: number }`
  - `interface VenueAdapter { id; label; timeoutMs; buildUrl(trade): string; parseUrl(url: URL): TradeHint | null; matches(url: URL): boolean; parse(capture, trade): Quote[] | null; amountInput?: AmountInput }`
  - `intParam(p, key)`, `addrParam(p, key)`, `amountParam(p, key)`, `compact(hint)` in `src/venues/url.ts`
  - `makeJumper(id: 'jumper' | 'jumper-advanced'): VenueAdapter`

- [ ] **Step 1: Write the failing test**

`tests/venues/jumper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { makeJumper } from '../../src/venues/jumper';
import { bridgeTrade, loadCapture, swapTrade } from '../helpers';

const jumper = makeJumper('jumper');
const advanced = makeJumper('jumper-advanced');

describe('Jumper buildUrl', () => {
  it('prefills the bridge trade on jumper.xyz', () => {
    expect(jumper.buildUrl(bridgeTrade())).toBe(
      'https://jumper.xyz/?fromChain=42161&fromToken=0x0000000000000000000000000000000000000000&toChain=8453&toToken=0x0000000000000000000000000000000000000000&fromAmount=0.1',
    );
  });
  it('opens the Bridge tab on /advanced for cross-chain trades', () => {
    expect(advanced.buildUrl(bridgeTrade())).toBe(
      'https://jumper.xyz/advanced?tab=bridge-advanced&fromChain=42161&fromToken=0x0000000000000000000000000000000000000000&toChain=8453&toToken=0x0000000000000000000000000000000000000000&fromAmount=0.1',
    );
  });
  it('uses the default Swap tab on /advanced for same-chain trades', () => {
    expect(advanced.buildUrl(swapTrade())).toBe(
      'https://jumper.xyz/advanced?fromChain=8453&fromToken=0x0000000000000000000000000000000000000000&toChain=8453&toToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&fromAmount=0.1',
    );
  });
});

describe('Jumper parseUrl', () => {
  it('round-trips its own URL', () => {
    expect(jumper.parseUrl(new URL(jumper.buildUrl(bridgeTrade())))).toEqual({
      fromChainId: 42161,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: NATIVE,
      amount: '0.1',
    });
  });
  it('tells the two Jumper pages apart', () => {
    expect(advanced.parseUrl(new URL(jumper.buildUrl(bridgeTrade())))).toBeNull();
    expect(jumper.parseUrl(new URL(advanced.buildUrl(bridgeTrade())))).toBeNull();
    expect(jumper.parseUrl(new URL('https://jumper.xyz/earn'))).toBeNull();
    expect(jumper.parseUrl(new URL('https://jumper.xyz/'))).toBeNull();
  });
});

describe('Jumper matches', () => {
  it('matches the routes stream only', () => {
    expect(jumper.matches(new URL('https://api.jumper.xyz/pipeline/v1/advanced/routes/stream'))).toBe(true);
    expect(jumper.matches(new URL('https://api.jumper.xyz/pipeline/v1/tokens'))).toBe(false);
  });
});

describe('Jumper parse', () => {
  it('reads every route with its LI.FI fee', () => {
    const quotes = jumper.parse(loadCapture('jumper', 'bridge'), bridgeTrade());
    expect(quotes).toHaveLength(9);
    const across = quotes?.find((q) => q.route === 'AcrossV4');
    expect(across).toMatchObject({ venue: 'jumper', toAmount: '99949675480571642', toDecimals: 18, gasUsd: 0.0091, etaSec: 1 });
    expect(across?.venueFee?.label).toBe('LIFI Fixed Fee');
    expect(across?.venueFee?.usd).toBeCloseTo(0.0545, 6);
    expect(across?.venueFee?.pct).toBeCloseTo(0.02, 6);
    expect(quotes?.map((q) => q.route)).toContain('Glacis > Wrapper');
  });

  it('shows no fee on Jumper Advanced', () => {
    const quotes = advanced.parse(loadCapture('jumper-advanced', 'bridge'), bridgeTrade());
    expect(quotes).toHaveLength(9);
    const across = quotes?.find((q) => q.route === 'AcrossV4');
    expect(across).toMatchObject({ venue: 'jumper-advanced', toAmount: '99969663502147578', venueFee: { label: 'None', usd: 0 } });
  });

  it('leaves the fee unknown on Jumper routes without fee items', () => {
    const quotes = jumper.parse(loadCapture('jumper', 'swap'), swapTrade());
    expect(quotes?.find((q) => q.route === 'FYND')?.venueFee).toBeUndefined();
    expect(quotes?.find((q) => q.route === 'Kyberswap')).toMatchObject({ toAmount: '274991543', toDecimals: 6 });
  });

  it('ignores the other Jumper page and other trades', () => {
    expect(jumper.parse(loadCapture('jumper-advanced', 'bridge'), bridgeTrade())).toBeNull();
    expect(jumper.parse(loadCapture('jumper', 'bridge'), swapTrade())).toBeNull();
  });

  it('parses a stream that is still arriving', () => {
    const capture = loadCapture('jumper', 'bridge');
    const partial = { ...capture, text: capture.text.slice(0, Math.floor(capture.text.length / 2)), done: false };
    const quotes = jumper.parse(partial, bridgeTrade());
    expect(Array.isArray(quotes)).toBe(true);
    expect(quotes?.length ?? 0).toBeLessThan(9);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm vitest run tests/venues/jumper.test.ts`
Expected: FAIL, "Cannot find module '../../src/venues/jumper'".

- [ ] **Step 3: Implement the contract and URL helpers**

`src/venues/types.ts`:

```ts
import type { Capture, Quote, Trade, TradeHint, VenueId } from '../types';

export interface AmountInput {
  selector: string;
  afterMs: number;
}

export interface VenueAdapter {
  id: VenueId;
  label: string;
  /** ms without a quote before the venue shows as timed out */
  timeoutMs: number;
  buildUrl(trade: Trade): string;
  /** null when the URL is not this venue's trade page */
  parseUrl(url: URL): TradeHint | null;
  /** true for the page's own quote requests */
  matches(url: URL): boolean;
  /** null when the capture is for another trade or cannot be priced yet; throws on a malformed body */
  parse(capture: Capture, trade: Trade): Quote[] | null;
  /** type the amount into this input when the URL value does not take (Matcha) */
  amountInput?: AmountInput;
}
```

`src/venues/url.ts`:

```ts
import { isNative, NATIVE } from '../lib/tokens';
import { normalizeAmount } from '../lib/units';
import type { Address, TradeHint } from '../types';

export function intParam(p: URLSearchParams, key: string): number | undefined {
  const v = p.get(key);
  return v !== null && /^\d+$/.test(v) ? Number(v) : undefined;
}

export function addrParam(p: URLSearchParams, key: string): Address | undefined {
  const v = p.get(key);
  if (v === null || !/^0x[0-9a-fA-F]{40}$/.test(v)) return undefined;
  return isNative(v) ? NATIVE : (v as Address);
}

export function amountParam(p: URLSearchParams, key: string): string | undefined {
  const v = p.get(key);
  return v === null ? undefined : (normalizeAmount(v) ?? undefined);
}

/** Drops undefined fields; null when nothing is left. */
export function compact(hint: TradeHint): TradeHint | null {
  const entries = Object.entries(hint).filter(([, v]) => v !== undefined);
  return entries.length ? (Object.fromEntries(entries) as TradeHint) : null;
}
```

- [ ] **Step 4: Implement `src/venues/jumper.ts`**

```ts
import { isRecord, isUint, num, safeJson } from '../lib/json';
import { parseSse } from '../lib/sse';
import { NATIVE, sameToken, venueAddress } from '../lib/tokens';
import type { Capture, Quote, Trade, VenueFee, VenueId } from '../types';
import type { VenueAdapter } from './types';
import { addrParam, amountParam, compact, intParam } from './url';

type JumperId = Extract<VenueId, 'jumper' | 'jumper-advanced'>;

interface LifiFee { name?: string; amountUSD?: string; percentage?: string }
interface LifiStep { tool?: string; toolDetails?: { name?: string }; estimate?: { executionDuration?: number; feeCosts?: LifiFee[] } }
interface LifiRoute { id?: string; toAmount?: string; toAmountUSD?: string; gasCostUSD?: string; toToken?: { decimals?: number }; steps?: LifiStep[]; tags?: unknown[] }

const INTEGRATOR: Record<JumperId, string> = { jumper: 'jumper.exchange', 'jumper-advanced': 'jumperadvanced' };
const FEE_NAME = /lifi fixed fee|integrator/i;

export function makeJumper(id: JumperId): VenueAdapter {
  const advanced = id === 'jumper-advanced';

  function venueFee(steps: LifiStep[]): VenueFee | undefined {
    // Top-level steps only: includedSteps repeat the same fee items.
    const items = steps.flatMap((s) => s.estimate?.feeCosts ?? []).filter((f) => FEE_NAME.test(f.name ?? ''));
    if (items.length === 0) return advanced ? { label: 'None', usd: 0 } : undefined;
    return {
      label: items[0]?.name ?? 'Fee',
      usd: items.reduce((sum, f) => sum + (num(f.amountUSD) ?? 0), 0),
      pct: items.reduce((sum, f) => sum + (num(f.percentage) ?? 0) * 100, 0),
    };
  }

  function toQuote(raw: unknown): Quote | null {
    if (!isRecord(raw)) return null;
    const route = raw as LifiRoute;
    const toAmount = route.toAmount;
    const decimals = route.toToken?.decimals;
    if (!isUint(toAmount) || typeof decimals !== 'number') return null;
    const steps = Array.isArray(route.steps) ? route.steps : [];
    return {
      venue: id,
      route: steps.map((s) => s.toolDetails?.name ?? s.tool ?? '?').join(' > ') || 'LI.FI',
      toAmount,
      toDecimals: decimals,
      toAmountUsd: num(route.toAmountUSD),
      gasUsd: num(route.gasCostUSD),
      venueFee: venueFee(steps),
      etaSec: steps.reduce((sum, s) => sum + (num(s.estimate?.executionDuration) ?? 0), 0),
      tags: Array.isArray(route.tags) ? route.tags.filter((x): x is string => typeof x === 'string') : undefined,
    };
  }

  return {
    id,
    label: advanced ? 'Jumper Advanced' : 'Jumper',
    timeoutMs: 30_000,

    buildUrl(trade: Trade): string {
      const p = new URLSearchParams();
      if (advanced && trade.fromChainId !== trade.toChainId) p.set('tab', 'bridge-advanced');
      p.set('fromChain', String(trade.fromChainId));
      p.set('fromToken', venueAddress(trade.fromToken.address, NATIVE));
      p.set('toChain', String(trade.toChainId));
      p.set('toToken', venueAddress(trade.toToken.address, NATIVE));
      p.set('fromAmount', trade.amount);
      return `https://jumper.xyz/${advanced ? 'advanced' : ''}?${p}`;
    },

    parseUrl(url: URL) {
      if (url.hostname !== 'jumper.xyz') return null;
      const onAdvanced = url.pathname.startsWith('/advanced');
      if (onAdvanced !== advanced || (!advanced && url.pathname !== '/')) return null;
      const p = url.searchParams;
      return compact({
        fromChainId: intParam(p, 'fromChain'),
        toChainId: intParam(p, 'toChain'),
        fromToken: addrParam(p, 'fromToken'),
        toToken: addrParam(p, 'toToken'),
        amount: amountParam(p, 'fromAmount'),
      });
    },

    matches(url: URL) {
      return url.hostname === 'api.jumper.xyz' && url.pathname.endsWith('/routes/stream');
    },

    parse(capture: Capture, trade: Trade) {
      const req = safeJson(capture.reqBody);
      if (isRecord(req)) {
        const options = isRecord(req.options) ? req.options : {};
        if (typeof options.integrator === 'string' && options.integrator !== INTEGRATOR[id]) return null;
        if (req.fromChainId !== trade.fromChainId || req.toChainId !== trade.toChainId) return null;
        if (typeof req.toTokenAddress === 'string' && !sameToken(req.toTokenAddress, trade.toToken.address)) return null;
      }
      const quotes: Quote[] = [];
      const seen = new Set<string>();
      for (const event of parseSse(capture.text)) {
        if (event.event !== 'routes') continue;
        const data = safeJson(event.data);
        const routes = isRecord(data) && Array.isArray(data.routes) ? data.routes : [];
        for (const raw of routes) {
          const key = isRecord(raw) && typeof raw.id === 'string' ? raw.id : '';
          if (key && seen.has(key)) continue;
          const quote = toQuote(raw);
          if (!quote) continue;
          if (key) seen.add(key);
          quotes.push(quote);
        }
      }
      return quotes;
    },
  };
}
```

- [ ] **Step 5: Run to confirm pass**

Run: `pnpm vitest run tests/venues/jumper.test.ts && pnpm verify`
Expected: PASS; verify clean.

- [ ] **Step 6: Commit**

```bash
git add src/venues tests/venues/jumper.test.ts
git commit -m "feat: venue adapter contract and Jumper adapters"
```

---

### Task 5: Bungee adapter

**Skill for implementer:** `superpowers:test-driven-development`.

**Files:**
- Create: `src/venues/bungee.ts`
- Test: `tests/venues/bungee.test.ts`

**Interfaces:**
- Consumes: `VenueAdapter`, `intParam`, `addrParam`, `amountParam`, `compact` (Task 4); `parseSse`, `safeJson`, `isRecord`, `num`, `isUint` (Task 2); `EEEE`, `sameToken`, `venueAddress` (Task 3).
- Produces: `export const bungee: VenueAdapter`.

- [ ] **Step 1: Write the failing test**

`tests/venues/bungee.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { bungee } from '../../src/venues/bungee';
import { bridgeTrade, loadCapture, swapTrade } from '../helpers';

describe('Bungee', () => {
  it('prefills app.bungee.exchange with 0xeee for native', () => {
    expect(bungee.buildUrl(bridgeTrade())).toBe(
      'https://app.bungee.exchange/?originChainId=42161&destinationChainId=8453&inputToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&outputToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amount=0.1',
    );
  });

  it('round-trips its own URL with native normalised', () => {
    expect(bungee.parseUrl(new URL(bungee.buildUrl(bridgeTrade())))).toEqual({
      fromChainId: 42161,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: NATIVE,
      amount: '0.1',
    });
    expect(bungee.parseUrl(new URL('https://www.bungee.exchange/'))).toBeNull();
  });

  it('matches the quote stream only', () => {
    expect(bungee.matches(new URL('https://backend.socket.tech/v3/swap/quote/stream?originChainId=1'))).toBe(true);
    expect(bungee.matches(new URL('https://backend.socket.tech/v3/swap/tokens/list'))).toBe(false);
  });

  it('reads the last snapshot of a bridge', () => {
    const quotes = bungee.parse(loadCapture('bungee', 'bridge'), bridgeTrade());
    expect(quotes).toHaveLength(7);
    expect(quotes?.[0]).toMatchObject({ venue: 'bungee', route: 'Socket Intents (OpenOcean)', toAmount: '100032234006710150', toDecimals: 18 });
    expect(quotes?.find((q) => q.route === 'Across')).toMatchObject({ toAmount: '99969651405265954', etaSec: 6, gasUsd: 0.0082856057 });
    expect(quotes?.[0]?.venueFee).toBeUndefined();
  });

  it('names swap routes by DEX', () => {
    const quotes = bungee.parse(loadCapture('bungee', 'swap'), swapTrade());
    expect(quotes).toHaveLength(5);
    expect(quotes?.[0]).toMatchObject({ route: '0x', toAmount: '272060462', toDecimals: 6 });
  });

  it('ignores a stream for another trade', () => {
    expect(bungee.parse(loadCapture('bungee', 'bridge'), swapTrade())).toBeNull();
  });

  it('parses a stream that is still arriving', () => {
    const capture = loadCapture('bungee', 'bridge');
    const partial = { ...capture, text: capture.text.slice(0, Math.floor(capture.text.length * 0.6)), done: false };
    expect(bungee.parse(partial, bridgeTrade())?.length ?? 0).toBeLessThanOrEqual(7);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm vitest run tests/venues/bungee.test.ts`
Expected: FAIL, "Cannot find module '../../src/venues/bungee'".

- [ ] **Step 3: Implement `src/venues/bungee.ts`**

```ts
import { isRecord, isUint, num, safeJson } from '../lib/json';
import { parseSse } from '../lib/sse';
import { EEEE, sameToken, venueAddress } from '../lib/tokens';
import type { Capture, Quote, Trade } from '../types';
import type { VenueAdapter } from './types';
import { addrParam, amountParam, compact, intParam } from './url';

interface BungeeProtocol { protocol?: { displayName?: string } | null }
interface BungeeRoute {
  output?: { amount?: string; valueInUsd?: number; token?: { decimals?: number } };
  estimatedTime?: number;
  routeTags?: unknown[];
  gasFee?: { feeInUsd?: number } | null;
  routeDetails?: { bridgeDetails?: BungeeProtocol | null; dexDetails?: BungeeProtocol | null } | null;
}

function routeName(r: BungeeRoute): string {
  const bridge = r.routeDetails?.bridgeDetails?.protocol?.displayName;
  const dex = r.routeDetails?.dexDetails?.protocol?.displayName;
  if (bridge && dex) return `${bridge} (${dex})`;
  return bridge ?? dex ?? 'Bungee';
}

function toQuote(raw: unknown): Quote | null {
  if (!isRecord(raw)) return null;
  const r = raw as BungeeRoute;
  const amount = r.output?.amount;
  const decimals = r.output?.token?.decimals;
  if (!isUint(amount) || typeof decimals !== 'number') return null;
  return {
    venue: 'bungee',
    route: routeName(r),
    toAmount: amount,
    toDecimals: decimals,
    toAmountUsd: num(r.output?.valueInUsd),
    gasUsd: num(r.gasFee?.feeInUsd),
    etaSec: num(r.estimatedTime),
    tags: Array.isArray(r.routeTags) ? r.routeTags.filter((x): x is string => typeof x === 'string') : undefined,
  };
}

export const bungee: VenueAdapter = {
  id: 'bungee',
  label: 'Bungee',
  timeoutMs: 30_000,

  buildUrl(trade: Trade): string {
    const p = new URLSearchParams({
      originChainId: String(trade.fromChainId),
      destinationChainId: String(trade.toChainId),
      inputToken: venueAddress(trade.fromToken.address, EEEE),
      outputToken: venueAddress(trade.toToken.address, EEEE),
      amount: trade.amount,
    });
    return `https://app.bungee.exchange/?${p}`;
  },

  parseUrl(url: URL) {
    if (url.hostname !== 'app.bungee.exchange') return null;
    const p = url.searchParams;
    return compact({
      fromChainId: intParam(p, 'originChainId'),
      toChainId: intParam(p, 'destinationChainId'),
      fromToken: addrParam(p, 'inputToken'),
      toToken: addrParam(p, 'outputToken'),
      amount: amountParam(p, 'amount'),
    });
  },

  matches(url: URL) {
    return url.hostname === 'backend.socket.tech' && url.pathname === '/v3/swap/quote/stream';
  },

  parse(capture: Capture, trade: Trade) {
    const p = new URL(capture.url).searchParams;
    if (intParam(p, 'destinationChainId') !== trade.toChainId) return null;
    const output = p.get('outputToken');
    if (output !== null && !sameToken(output, trade.toToken.address)) return null;
    // Snapshots are cumulative: the latest complete one is the current route list.
    let routes: unknown[] = [];
    for (const event of parseSse(capture.text)) {
      if (event.event !== 'snapshot') continue;
      const data = safeJson(event.data);
      const result = isRecord(data) && isRecord(data.result) ? data.result : null;
      if (result && Array.isArray(result.routes)) routes = result.routes;
    }
    return routes.map(toQuote).filter((q): q is Quote => q !== null);
  },
};
```

- [ ] **Step 4: Run to confirm pass**

Run: `pnpm vitest run tests/venues/bungee.test.ts && pnpm verify`
Expected: PASS; verify clean.

- [ ] **Step 5: Commit**

```bash
git add src/venues/bungee.ts tests/venues/bungee.test.ts
git commit -m "feat: Bungee adapter"
```

---

### Task 6: Relay adapter

**Skill for implementer:** `superpowers:test-driven-development`.

**Files:**
- Create: `src/venues/relay.ts`
- Test: `tests/venues/relay.test.ts`

**Interfaces:**
- Consumes: Task 4 contract and URL helpers; Task 3 `CHAINS`, `chainById`, `NATIVE`, `sameToken`, `venueAddress`; Task 2 `safeJson`, `isRecord`, `num`, `isUint`.
- Produces: `export const relay: VenueAdapter`.

- [ ] **Step 1: Write the failing test**

`tests/venues/relay.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { relay } from '../../src/venues/relay';
import { bridgeTrade, loadCapture, swapTrade } from '../helpers';

describe('Relay', () => {
  it('puts the destination chain slug in the path', () => {
    expect(relay.buildUrl(bridgeTrade())).toBe(
      'https://relay.link/bridge/base?fromChainId=42161&fromCurrency=0x0000000000000000000000000000000000000000&toCurrency=0x0000000000000000000000000000000000000000&amount=0.1',
    );
  });

  it('refuses chains Relay does not list', () => {
    const trade = { ...bridgeTrade(), toChainId: 999 };
    expect(() => relay.buildUrl(trade)).toThrow('Relay does not list chain 999');
  });

  it('reads the destination from the slug and treats missing currencies as native', () => {
    expect(relay.parseUrl(new URL('https://relay.link/bridge/base?fromChainId=42161&amount=0.1'))).toEqual({
      fromChainId: 42161,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: NATIVE,
      amount: '0.1',
    });
    expect(relay.parseUrl(new URL('https://relay.link/transactions'))).toBeNull();
  });

  it('matches the quote endpoint only', () => {
    expect(relay.matches(new URL('https://relay.link/api/relay/quote/v2'))).toBe(true);
    expect(relay.matches(new URL('https://relay.link/api/relay/chains'))).toBe(false);
  });

  it('reads the bridge quote and app fee', () => {
    expect(relay.parse(loadCapture('relay', 'bridge'), bridgeTrade())).toEqual([
      {
        venue: 'relay',
        route: 'Relay',
        toAmount: '99919666228766998',
        toDecimals: 18,
        toAmountUsd: 272.191762,
        gasUsd: 0.002258,
        venueFee: { label: 'None', usd: 0 },
        etaSec: 2,
      },
    ]);
  });

  it('reads a same-chain swap', () => {
    expect(relay.parse(loadCapture('relay', 'swap'), swapTrade())?.[0]).toMatchObject({ toAmount: '272420034', toDecimals: 6 });
  });

  it('ignores a quote for another trade', () => {
    expect(relay.parse(loadCapture('relay', 'bridge'), swapTrade())).toBeNull();
  });

  it('throws on a body that is not JSON', () => {
    const capture = { ...loadCapture('relay', 'bridge'), text: '<html>' };
    expect(() => relay.parse(capture, bridgeTrade())).toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm vitest run tests/venues/relay.test.ts`
Expected: FAIL, "Cannot find module '../../src/venues/relay'".

- [ ] **Step 3: Implement `src/venues/relay.ts`**

```ts
import { isRecord, isUint, num, safeJson } from '../lib/json';
import { CHAINS, chainById, NATIVE, sameToken, venueAddress } from '../lib/tokens';
import type { Capture, Quote, Trade, VenueFee } from '../types';
import type { VenueAdapter } from './types';
import { addrParam, amountParam, compact, intParam } from './url';

interface RelayAmount { amount?: string; amountUsd?: string; currency?: { decimals?: number } }
interface RelayQuote {
  details?: { currencyOut?: RelayAmount; timeEstimate?: number };
  fees?: { gas?: RelayAmount; app?: RelayAmount };
}

function appFee(usd: number | undefined): VenueFee | undefined {
  if (usd === undefined) return undefined;
  return usd > 0 ? { label: 'App fee', usd } : { label: 'None', usd: 0 };
}

export const relay: VenueAdapter = {
  id: 'relay',
  label: 'Relay',
  timeoutMs: 30_000,

  buildUrl(trade: Trade): string {
    const slug = chainById(trade.toChainId)?.relaySlug;
    if (!slug) throw new Error(`Relay does not list chain ${trade.toChainId}`);
    const p = new URLSearchParams({
      fromChainId: String(trade.fromChainId),
      fromCurrency: venueAddress(trade.fromToken.address, NATIVE),
      toCurrency: venueAddress(trade.toToken.address, NATIVE),
      amount: trade.amount,
    });
    return `https://relay.link/bridge/${slug}?${p}`;
  },

  parseUrl(url: URL) {
    if (url.hostname !== 'relay.link') return null;
    const match = /^\/bridge\/([a-z0-9-]+)\/?$/.exec(url.pathname);
    if (!match) return null;
    const p = url.searchParams;
    return compact({
      fromChainId: intParam(p, 'fromChainId'),
      toChainId: CHAINS.find((c) => c.relaySlug === match[1])?.id,
      // relay.link drops the currency params when they are the native token
      fromToken: addrParam(p, 'fromCurrency') ?? NATIVE,
      toToken: addrParam(p, 'toCurrency') ?? NATIVE,
      amount: amountParam(p, 'amount'),
    });
  },

  matches(url: URL) {
    return url.hostname === 'relay.link' && url.pathname === '/api/relay/quote/v2';
  },

  parse(capture: Capture, trade: Trade) {
    const req = safeJson(capture.reqBody);
    if (isRecord(req)) {
      if (req.destinationChainId !== trade.toChainId) return null;
      if (typeof req.destinationCurrency === 'string' && !sameToken(req.destinationCurrency, trade.toToken.address)) return null;
    }
    const body = JSON.parse(capture.text) as unknown;
    if (!isRecord(body)) throw new Error('Relay: unexpected response');
    const quote = body as RelayQuote;
    const out = quote.details?.currencyOut;
    const amount = out?.amount;
    const decimals = out?.currency?.decimals;
    if (!isUint(amount) || typeof decimals !== 'number') return [];
    return [
      {
        venue: 'relay',
        route: 'Relay',
        toAmount: amount,
        toDecimals: decimals,
        toAmountUsd: num(out?.amountUsd),
        gasUsd: num(quote.fees?.gas?.amountUsd),
        venueFee: appFee(num(quote.fees?.app?.amountUsd)),
        etaSec: num(quote.details?.timeEstimate),
      },
    ];
  },
};
```

- [ ] **Step 4: Run to confirm pass**

Run: `pnpm vitest run tests/venues/relay.test.ts && pnpm verify`
Expected: PASS; verify clean.

- [ ] **Step 5: Commit**

```bash
git add src/venues/relay.ts tests/venues/relay.test.ts
git commit -m "feat: Relay adapter"
```

---

### Task 7: Matcha adapter

**Skill for implementer:** `superpowers:test-driven-development`.

**Files:**
- Create: `src/venues/matcha.ts`
- Test: `tests/venues/matcha.test.ts`

**Interfaces:**
- Consumes: Task 4 contract and URL helpers; Task 3 `EEEE`, `sameToken`, `venueAddress`; Task 2 `isRecord`, `num`, `isUint`.
- Produces: `export const matcha: VenueAdapter` with `amountInput = { selector: 'input[placeholder="0.0"]', afterMs: 8000 }` and `timeoutMs = 40000`.

- [ ] **Step 1: Write the failing test**

`tests/venues/matcha.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { matcha } from '../../src/venues/matcha';
import { bridgeTrade, loadCapture, swapTrade } from '../helpers';

describe('Matcha', () => {
  it('prefills matcha.xyz with lowercase addresses and 0xeee for native', () => {
    expect(matcha.buildUrl(swapTrade())).toBe(
      'https://matcha.xyz/?sellChain=8453&sellAddress=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&buyChain=8453&buyAddress=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&sellAmount=0.1',
    );
  });

  it('round-trips its own URL', () => {
    expect(matcha.parseUrl(new URL(matcha.buildUrl(bridgeTrade())))).toEqual({
      fromChainId: 42161,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: NATIVE,
      amount: '0.1',
    });
    expect(matcha.parseUrl(new URL('https://matcha.xyz/tokens/base/eth'))).toBeNull();
  });

  it('matches price, firm quote and cross-chain quote requests', () => {
    expect(matcha.matches(new URL('https://matcha.xyz/api/swap/price?chainId=8453'))).toBe(true);
    expect(matcha.matches(new URL('https://matcha.xyz/api/swap/quote?chainId=8453'))).toBe(true);
    expect(matcha.matches(new URL('https://matcha.xyz/api/cross-chain/quote?originChain=1'))).toBe(true);
    expect(matcha.matches(new URL('https://matcha.xyz/api/price/usd'))).toBe(false);
  });

  it('types the amount when the URL value does not take', () => {
    expect(matcha.amountInput).toEqual({ selector: 'input[placeholder="0.0"]', afterMs: 8000 });
    expect(matcha.timeoutMs).toBe(40_000);
  });

  it('reads a swap price net of the 0x fee', () => {
    const [quote] = matcha.parse(loadCapture('matcha', 'swap'), swapTrade()) ?? [];
    expect(quote).toMatchObject({ venue: 'matcha', route: 'BaiBai', toAmount: '271649175', toDecimals: 6 });
    expect(quote?.venueFee?.label).toBe('Matcha fee');
    expect(quote?.venueFee?.pct).toBeCloseTo(0.25, 3);
  });

  it('reads a cross-chain quote and its integrator fee', () => {
    const [quote] = matcha.parse(loadCapture('matcha', 'bridge'), bridgeTrade()) ?? [];
    expect(quote).toMatchObject({ route: 'across_v4', toAmount: '99569767892156631', toDecimals: 18, etaSec: 3 });
    expect(quote?.venueFee?.pct).toBeCloseTo(0.4, 3);
  });

  it('waits when the destination token decimals are unknown', () => {
    const trade = swapTrade();
    trade.toToken = { ...trade.toToken, decimals: null };
    expect(matcha.parse(loadCapture('matcha', 'swap'), trade)).toBeNull();
  });

  it('ignores responses for another trade', () => {
    expect(matcha.parse(loadCapture('matcha', 'swap'), bridgeTrade())).toBeNull();
    expect(matcha.parse(loadCapture('matcha', 'bridge'), swapTrade())).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm vitest run tests/venues/matcha.test.ts`
Expected: FAIL, "Cannot find module '../../src/venues/matcha'".

- [ ] **Step 3: Implement `src/venues/matcha.ts`**

```ts
import { isRecord, isUint, num } from '../lib/json';
import { EEEE, sameToken, venueAddress } from '../lib/tokens';
import type { Capture, Quote, Trade, VenueFee } from '../types';
import type { VenueAdapter } from './types';
import { addrParam, amountParam, compact, intParam } from './url';

interface MatchaFee { amount?: string; token?: string }
interface MatchaFees { integratorFee?: MatchaFee | null; zeroExFee?: MatchaFee | null; providerAppFee?: MatchaFee | null }
interface MatchaSwap { buyAmount?: string; route?: { fills?: { source?: string }[] }; fees?: MatchaFees }
interface MatchaCross {
  result?: { quote?: { buyAmount?: string; estimatedTimeSeconds?: number; steps?: { provider?: string }[]; fees?: MatchaFees } };
}

const SWAP_PATHS = new Set(['/api/swap/price', '/api/swap/quote']);
const CROSS_PATH = '/api/cross-chain/quote';

const pctOf = (part: string, whole: bigint): number =>
  whole === 0n ? 0 : Number((BigInt(part) * 1_000_000n) / whole) / 10_000;

/** Fees charged in the sell token are measured against the sell amount; fees in the buy token against the pre-fee output. */
function matchaFee(fees: MatchaFees | undefined, sellToken: string, sellAmount: string, buyToken: string, buyAmount: string): VenueFee {
  let pct = 0;
  for (const fee of [fees?.integratorFee, fees?.zeroExFee, fees?.providerAppFee]) {
    if (!fee || !isUint(fee.amount) || typeof fee.token !== 'string') continue;
    if (sameToken(fee.token, sellToken) && isUint(sellAmount)) pct += pctOf(fee.amount, BigInt(sellAmount));
    else if (sameToken(fee.token, buyToken)) pct += pctOf(fee.amount, BigInt(buyAmount) + BigInt(fee.amount));
  }
  return pct > 0 ? { label: 'Matcha fee', pct } : { label: 'None', usd: 0 };
}

export const matcha: VenueAdapter = {
  id: 'matcha',
  label: 'Matcha',
  timeoutMs: 40_000,
  amountInput: { selector: 'input[placeholder="0.0"]', afterMs: 8_000 },

  buildUrl(trade: Trade): string {
    const p = new URLSearchParams({
      sellChain: String(trade.fromChainId),
      sellAddress: venueAddress(trade.fromToken.address, EEEE).toLowerCase(),
      buyChain: String(trade.toChainId),
      buyAddress: venueAddress(trade.toToken.address, EEEE).toLowerCase(),
      sellAmount: trade.amount,
    });
    return `https://matcha.xyz/?${p}`;
  },

  parseUrl(url: URL) {
    if (url.hostname !== 'matcha.xyz' || url.pathname !== '/') return null;
    const p = url.searchParams;
    return compact({
      fromChainId: intParam(p, 'sellChain'),
      toChainId: intParam(p, 'buyChain'),
      fromToken: addrParam(p, 'sellAddress'),
      toToken: addrParam(p, 'buyAddress'),
      amount: amountParam(p, 'sellAmount'),
    });
  },

  matches(url: URL) {
    return url.hostname === 'matcha.xyz' && (SWAP_PATHS.has(url.pathname) || url.pathname === CROSS_PATH);
  },

  parse(capture: Capture, trade: Trade) {
    const decimals = trade.toToken.decimals;
    if (decimals === null) return null;
    const url = new URL(capture.url);
    const p = url.searchParams;
    const cross = url.pathname === CROSS_PATH;
    const buyToken = p.get('buyToken') ?? '';
    const sellToken = p.get('sellToken') ?? '';
    const sellAmount = p.get('sellAmount') ?? '';
    if (intParam(p, cross ? 'destinationChain' : 'chainId') !== trade.toChainId) return null;
    if (!sameToken(buyToken, trade.toToken.address)) return null;
    if (!cross && trade.fromChainId !== trade.toChainId) return null;

    const body = JSON.parse(capture.text) as unknown;
    if (!isRecord(body)) throw new Error('Matcha: unexpected response');

    if (cross) {
      const quote = (body as MatchaCross).result?.quote;
      const amount = quote?.buyAmount;
      if (!quote || !isUint(amount)) return [];
      return [
        {
          venue: 'matcha',
          route: (quote.steps ?? []).map((s) => s.provider ?? '?').join(' > ') || 'Matcha',
          toAmount: amount,
          toDecimals: decimals,
          venueFee: matchaFee(quote.fees, sellToken, sellAmount, buyToken, amount),
          etaSec: num(quote.estimatedTimeSeconds),
        },
      ];
    }

    const swap = body as MatchaSwap;
    const amount = swap.buyAmount;
    if (!isUint(amount)) return [];
    const sources = [...new Set((swap.route?.fills ?? []).map((f) => f.source).filter((s): s is string => typeof s === 'string'))];
    return [
      {
        venue: 'matcha',
        route: sources.join(' + ') || 'Matcha',
        toAmount: amount,
        toDecimals: decimals,
        venueFee: matchaFee(swap.fees, sellToken, sellAmount, buyToken, amount),
      },
    ];
  },
};
```

- [ ] **Step 4: Run to confirm pass**

Run: `pnpm vitest run tests/venues/matcha.test.ts && pnpm verify`
Expected: PASS; verify clean.

- [ ] **Step 5: Commit**

```bash
git add src/venues/matcha.ts tests/venues/matcha.test.ts
git commit -m "feat: Matcha adapter"
```

---

### Task 8: Venue registry, messages, and page capture

**Skill for implementer:** `chrome-extensions`, `superpowers:test-driven-development`.

**Files:**
- Create: `src/venues/index.ts`, `src/messages.ts`, `src/capture/interceptor.ts`, `src/capture/visibility.ts`, `src/capture/fill.ts`, `entrypoints/interceptor.content.ts`, `entrypoints/relay.content.ts`
- Test: `tests/venues/index.test.ts`, `tests/messages.test.ts`, `tests/capture/interceptor.test.ts`, `tests/capture/visibility.test.ts`, `tests/capture/fill.test.ts`

**Interfaces:**
- Consumes: all four adapters (Tasks 4-7), `Capture`, `TradeHint`, `VenueId`.
- Produces:
  - `ADAPTERS: Record<VenueId, VenueAdapter>`, `VENUE_MATCHES: string[]`, `matchesAnyVenue(href: string): boolean`, `hintFromUrl(href: string): { venue: VenueId; hint: TradeHint } | null`
  - `MSG_SOURCE`, `PageMessage`, `RuntimeMessage`, `FillRequest`, `HelloReply`, `PanelToWorker`, `WorkerToPanel`, `isCapture`, `isPageMessage`
  - `installInterceptor(env, matches, emit, throttleMs?)`, `spoofVisibility(doc, win)`, `fillAmount(doc, selector, value): boolean`, `scheduleFill(doc, fill, tries?): () => void`

- [ ] **Step 1: Write failing tests**

`tests/venues/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { VENUE_IDS } from '../../src/types';
import { ADAPTERS, hintFromUrl, matchesAnyVenue, VENUE_MATCHES } from '../../src/venues';
import { bridgeTrade, swapTrade } from '../helpers';

describe('venue registry', () => {
  it('matches every venue quote endpoint and nothing else', () => {
    for (const url of [
      'https://api.jumper.xyz/pipeline/v1/advanced/routes/stream',
      'https://backend.socket.tech/v3/swap/quote/stream?x=1',
      'https://relay.link/api/relay/quote/v2',
      'https://matcha.xyz/api/swap/price?chainId=1',
      'https://matcha.xyz/api/cross-chain/quote?originChain=1',
    ]) {
      expect(matchesAnyVenue(url)).toBe(true);
    }
    expect(matchesAnyVenue('https://example.com/quote')).toBe(false);
    expect(matchesAnyVenue('not a url')).toBe(false);
  });

  it('recognises each venue from its own URL', () => {
    for (const trade of [bridgeTrade(), swapTrade()]) {
      for (const venue of VENUE_IDS) {
        expect(hintFromUrl(ADAPTERS[venue].buildUrl(trade))?.venue).toBe(venue);
      }
    }
  });

  it('reads a Relay page URL as a hint', () => {
    expect(hintFromUrl('https://relay.link/bridge/base?fromChainId=42161&amount=0.1')).toEqual({
      venue: 'relay',
      hint: { fromChainId: 42161, toChainId: 8453, fromToken: NATIVE, toToken: NATIVE, amount: '0.1' },
    });
    expect(hintFromUrl('https://example.com/')).toBeNull();
  });

  it('injects into exactly the four venue origins', () => {
    expect(VENUE_MATCHES).toEqual(['https://jumper.xyz/*', 'https://app.bungee.exchange/*', 'https://relay.link/*', 'https://matcha.xyz/*']);
  });
});
```

`tests/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isPageMessage, MSG_SOURCE } from '../src/messages';

const capture = { id: 1, url: 'https://relay.link/api/relay/quote/v2', method: 'POST', reqBody: '', status: 200, text: '{}', done: true };

describe('isPageMessage', () => {
  it('accepts a well-formed capture and the spoof request', () => {
    expect(isPageMessage({ source: MSG_SOURCE, kind: 'capture', capture })).toBe(true);
    expect(isPageMessage({ source: MSG_SOURCE, kind: 'spoof-visibility' })).toBe(true);
  });
  it('rejects other sources and malformed captures', () => {
    expect(isPageMessage({ source: 'other', kind: 'capture', capture })).toBe(false);
    expect(isPageMessage({ source: MSG_SOURCE, kind: 'capture', capture: { ...capture, text: 42 } })).toBe(false);
    expect(isPageMessage({ source: MSG_SOURCE, kind: 'capture', capture: { ...capture, id: undefined } })).toBe(false);
    expect(isPageMessage(null)).toBe(false);
    expect(isPageMessage('quote-compare')).toBe(false);
  });
});
```

`tests/capture/interceptor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { installInterceptor } from '../../src/capture/interceptor';
import type { Capture } from '../../src/types';

const BODY = 'event: a\ndata: 1\n\nevent: b\ndata: 2\n\n';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function setup(fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  // A fresh class per test: the interceptor patches the prototype.
  class FakeXhr extends EventTarget {
    status = 0;
    responseType = '';
    responseText = '';
    response: unknown = null;
    open(_method: string, _url: string | URL) {}
    send(_body?: unknown) {
      setTimeout(() => {
        this.status = 200;
        this.responseText = '{"details":{}}';
        this.dispatchEvent(new Event('loadend'));
      }, 0);
    }
  }
  const captures: Capture[] = [];
  const fetchCalls: unknown[][] = [];
  const env = {
    fetch:
      fetchImpl ??
      (async (input: RequestInfo | URL, init?: RequestInit) => {
        fetchCalls.push([input, init]);
        return new Response(streamOf(BODY.match(/[^]*?\n\n/g) ?? []), { status: 200 });
      }),
    XMLHttpRequest: FakeXhr,
    location: { href: 'https://relay.link/bridge/base' },
  };
  installInterceptor(env, (url) => url.includes('/quote'), (c) => captures.push(c), 0);
  return { env, captures, fetchCalls };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !predicate(); i++) await new Promise((r) => setTimeout(r, 5));
}

describe('installInterceptor', () => {
  it('captures a matching streamed fetch and leaves the page response intact', async () => {
    const { env, captures } = setup();
    const response = await env.fetch('https://api.example/quote/stream', { method: 'post', body: '{"a":1}' });
    expect(await response.text()).toBe(BODY);
    await waitFor(() => captures.some((c) => c.done));
    expect(captures.at(-1)).toEqual({ id: 1, url: 'https://api.example/quote/stream', method: 'POST', reqBody: '{"a":1}', status: 200, text: BODY, done: true });
  });

  it('passes other requests straight through', async () => {
    const { env, captures, fetchCalls } = setup();
    await env.fetch('https://api.example/tokens');
    await new Promise((r) => setTimeout(r, 20));
    expect(captures).toEqual([]);
    expect(fetchCalls[0]?.[0]).toBe('https://api.example/tokens');
  });

  it('resolves relative URLs against the page', async () => {
    const { env, captures } = setup();
    await env.fetch('/api/quote');
    await waitFor(() => captures.length > 0);
    expect(captures[0]?.url).toBe('https://relay.link/api/quote');
  });

  it('reads method and URL from a Request object', async () => {
    const { env, captures } = setup();
    await env.fetch(new Request('https://x.test/quote', { method: 'PUT', body: 'z' }));
    await waitFor(() => captures.length > 0);
    expect(captures[0]).toMatchObject({ url: 'https://x.test/quote', method: 'PUT', reqBody: '' });
  });

  it('lets fetch failures reach the page without a capture', async () => {
    const { env, captures } = setup(async () => {
      throw new TypeError('network down');
    });
    await expect(env.fetch('https://api.example/quote')).rejects.toThrow('network down');
    expect(captures).toEqual([]);
  });

  it('numbers captures in request order', async () => {
    const { env, captures } = setup();
    await env.fetch('https://a.test/quote');
    await env.fetch('https://b.test/quote');
    await waitFor(() => captures.filter((c) => c.done).length === 2);
    expect(captures.filter((c) => c.done).map((c) => c.id).sort()).toEqual([1, 2]);
  });

  it('captures a matching XHR when it finishes', async () => {
    const { env, captures } = setup();
    const xhr = new env.XMLHttpRequest();
    xhr.open('post', '/api/relay/quote/v2');
    xhr.send('{"x":1}');
    await waitFor(() => captures.length > 0);
    expect(captures[0]).toEqual({ id: 1, url: 'https://relay.link/api/relay/quote/v2', method: 'POST', reqBody: '{"x":1}', status: 200, text: '{"details":{}}', done: true });
  });

  it('ignores non-matching XHR', async () => {
    const { env, captures } = setup();
    const xhr = new env.XMLHttpRequest();
    xhr.open('get', '/api/relay/chains');
    xhr.send();
    await new Promise((r) => setTimeout(r, 20));
    expect(captures).toEqual([]);
  });
});
```

`tests/capture/visibility.test.ts`:

```ts
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
```

`tests/capture/fill.test.ts`:

```ts
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

  it('gives up after the given number of tries', () => {
    vi.useFakeTimers();
    scheduleFill(document, { selector: SELECTOR, afterMs: 8000, value: '0.1' }, 2);
    vi.advanceTimersByTime(10_000);
    document.body.innerHTML = '<input placeholder="0.0">';
    vi.advanceTimersByTime(5000);
    expect(input()?.value).toBe('');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm vitest run tests/venues/index.test.ts tests/messages.test.ts tests/capture`
Expected: FAIL, missing modules `src/venues/index`, `src/messages`, `src/capture/*`.

- [ ] **Step 3: Implement registry and messages**

`src/venues/index.ts`:

```ts
import { VENUE_IDS, type TradeHint, type VenueId } from '../types';
import { bungee } from './bungee';
import { makeJumper } from './jumper';
import { matcha } from './matcha';
import { relay } from './relay';
import type { VenueAdapter } from './types';

export const ADAPTERS: Record<VenueId, VenueAdapter> = {
  jumper: makeJumper('jumper'),
  'jumper-advanced': makeJumper('jumper-advanced'),
  bungee,
  relay,
  matcha,
};

/** Content-script match patterns: the four venue origins, nothing else. */
export const VENUE_MATCHES = ['https://jumper.xyz/*', 'https://app.bungee.exchange/*', 'https://relay.link/*', 'https://matcha.xyz/*'];

function toUrl(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

export function matchesAnyVenue(href: string): boolean {
  const url = toUrl(href);
  return url !== null && VENUE_IDS.some((venue) => ADAPTERS[venue].matches(url));
}

export function hintFromUrl(href: string): { venue: VenueId; hint: TradeHint } | null {
  const url = toUrl(href);
  if (!url) return null;
  for (const venue of VENUE_IDS) {
    const hint = ADAPTERS[venue].parseUrl(url);
    if (hint) return { venue, hint };
  }
  return null;
}
```

`src/messages.ts`:

```ts
import { isRecord } from './lib/json';
import type { Capture, Trade, VenueId, VenueResult } from './types';
import type { AmountInput } from './venues/types';

export const MSG_SOURCE = 'quote-compare' as const;

/** window.postMessage between the MAIN-world interceptor and the ISOLATED relay. */
export type PageMessage =
  | { source: typeof MSG_SOURCE; kind: 'capture'; capture: Capture }
  | { source: typeof MSG_SOURCE; kind: 'spoof-visibility' };

/** ISOLATED relay -> service worker. */
export type RuntimeMessage = { type: 'hello' } | { type: 'capture'; generation: number; capture: Capture };

export interface FillRequest extends AmountInput {
  value: string;
}

export interface HelloReply {
  owned: boolean;
  venue?: VenueId;
  generation?: number;
  fill?: FillRequest;
}

/** Side panel <-> service worker over the 'panel' port. */
export type PanelToWorker = { type: 'compare'; trade: Trade } | { type: 'refresh' };
export type WorkerToPanel = { type: 'results'; results: VenueResult[] } | { type: 'error'; message: string };

export function isCapture(x: unknown): x is Capture {
  return (
    isRecord(x) &&
    typeof x.id === 'number' &&
    typeof x.url === 'string' &&
    typeof x.method === 'string' &&
    typeof x.reqBody === 'string' &&
    typeof x.status === 'number' &&
    typeof x.text === 'string' &&
    typeof x.done === 'boolean'
  );
}

export function isPageMessage(x: unknown): x is PageMessage {
  if (!isRecord(x) || x.source !== MSG_SOURCE) return false;
  if (x.kind === 'spoof-visibility') return true;
  return x.kind === 'capture' && isCapture(x.capture);
}
```

- [ ] **Step 4: Implement capture helpers**

`src/capture/interceptor.ts`:

```ts
import type { Capture } from '../types';

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface XhrLike {
  open(method: string, url: string | URL, ...rest: unknown[]): void;
  send(body?: unknown): void;
  addEventListener(type: string, listener: () => void): void;
  status: number;
  responseType: string;
  responseText: string;
  response: unknown;
}

export interface InterceptorEnv {
  fetch: FetchFn;
  XMLHttpRequest: { prototype: object };
  location: { href: string };
}

const TAG = Symbol('quote-compare');
type TaggedXhr = XhrLike & { [TAG]?: { method: string; url: string } };

/**
 * Wraps the page's fetch and XMLHttpRequest. Requests whose absolute URL passes `matches` are
 * reported through `emit`: streamed bodies as they arrive (at most every `throttleMs`) and once
 * more with done=true. The page always receives its original, untouched response.
 */
export function installInterceptor(
  env: InterceptorEnv,
  matches: (url: string) => boolean,
  emit: (capture: Capture) => void,
  throttleMs = 500,
): void {
  let nextId = 1;
  const resolve = (input: RequestInfo | URL): string => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      return new URL(raw, env.location.href).href;
    } catch {
      return raw;
    }
  };

  const originalFetch = env.fetch;
  env.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = resolve(input);
    if (!matches(url)) return originalFetch.call(env, input, init);
    const id = nextId++;
    const response = await originalFetch.call(env, input, init);
    const requestMethod = typeof input === 'object' && 'method' in input ? input.method : 'GET';
    const capture: Capture = {
      id,
      url,
      method: (init?.method ?? requestMethod).toUpperCase(),
      reqBody: typeof init?.body === 'string' ? init.body : '',
      status: response.status,
      text: '',
      done: false,
    };
    const body = response.clone().body;
    if (body) void pump(body, capture, emit, throttleMs);
    else emit({ ...capture, done: true });
    return response;
  };

  const proto = env.XMLHttpRequest.prototype as XhrLike;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  proto.open = function (this: TaggedXhr, method: string, url: string | URL, ...rest: unknown[]) {
    this[TAG] = { method: String(method).toUpperCase(), url: resolve(url instanceof URL ? url : String(url)) };
    return originalOpen.call(this, method, url, ...rest);
  };
  proto.send = function (this: TaggedXhr, body?: unknown) {
    const tag = this[TAG];
    if (tag && matches(tag.url)) {
      const id = nextId++;
      this.addEventListener('loadend', () => {
        const text =
          this.responseType === '' || this.responseType === 'text'
            ? this.responseText
            : typeof this.response === 'string'
              ? this.response
              : JSON.stringify(this.response ?? null);
        emit({ id, url: tag.url, method: tag.method, reqBody: typeof body === 'string' ? body : '', status: this.status, text, done: true });
      });
    }
    return originalSend.call(this, body);
  };
}

async function pump(stream: ReadableStream<Uint8Array>, capture: Capture, emit: (c: Capture) => void, throttleMs: number): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let last = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      capture.text += decoder.decode(value, { stream: true });
      const now = Date.now();
      if (now - last >= throttleMs) {
        last = now;
        emit({ ...capture });
      }
    }
    capture.text += decoder.decode();
  } catch {
    // The page aborted the stream (a newer quote replaced it): report what arrived.
  }
  emit({ ...capture, done: true });
}
```

`src/capture/visibility.ts`:

```ts
/** Makes a background tab look visible and focused to the page, so venues keep refreshing quotes. */
export function spoofVisibility(doc: Document, win: Window): void {
  Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' });
  Object.defineProperty(doc, 'hidden', { configurable: true, get: () => false });
  Object.defineProperty(doc, 'hasFocus', { configurable: true, value: () => true });
  const swallow = (event: Event) => event.stopImmediatePropagation();
  doc.addEventListener('visibilitychange', swallow, true);
  win.addEventListener('blur', swallow, true);
}
```

`src/capture/fill.ts`:

```ts
import type { FillRequest } from '../messages';

/** Sets a React-controlled input the way typing would. False when the input is missing or already filled. */
export function fillAmount(doc: Document, selector: string, value: string): boolean {
  const input = doc.querySelector<HTMLInputElement>(selector);
  if (!input || input.value !== '') return false;
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input) as object, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/** After fill.afterMs, fills the input once it exists and is still empty; retries every second, `tries` times. */
export function scheduleFill(doc: Document, fill: FillRequest, tries = 20): () => void {
  let handle: ReturnType<typeof setTimeout> | undefined;
  let left = tries;
  const attempt = () => {
    left -= 1;
    const input = doc.querySelector<HTMLInputElement>(fill.selector);
    if (input && input.value !== '') return;
    if (fillAmount(doc, fill.selector, fill.value)) return;
    if (left > 0) handle = setTimeout(attempt, 1000);
  };
  handle = setTimeout(attempt, fill.afterMs);
  return () => clearTimeout(handle);
}
```

- [ ] **Step 5: Run to confirm pass**

Run: `pnpm vitest run tests/venues/index.test.ts tests/messages.test.ts tests/capture`
Expected: PASS.

- [ ] **Step 6: Add the two content scripts**

`entrypoints/interceptor.content.ts`:

```ts
import { defineContentScript } from 'wxt/utils/define-content-script';
import { installInterceptor } from '../src/capture/interceptor';
import { spoofVisibility } from '../src/capture/visibility';
import { isPageMessage, MSG_SOURCE, type PageMessage } from '../src/messages';
import { matchesAnyVenue, VENUE_MATCHES } from '../src/venues';

export default defineContentScript({
  matches: VENUE_MATCHES,
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    installInterceptor(window, matchesAnyVenue, (capture) => {
      const message: PageMessage = { source: MSG_SOURCE, kind: 'capture', capture };
      window.postMessage(message, window.location.origin);
    });
    let spoofed = false;
    window.addEventListener('message', (event) => {
      if (spoofed || event.source !== window || !isPageMessage(event.data) || event.data.kind !== 'spoof-visibility') return;
      spoofed = true;
      spoofVisibility(document, window);
    });
  },
});
```

`entrypoints/relay.content.ts`:

```ts
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { scheduleFill } from '../src/capture/fill';
import { isPageMessage, MSG_SOURCE, type HelloReply, type PageMessage, type RuntimeMessage } from '../src/messages';
import type { Capture } from '../src/types';
import { VENUE_MATCHES } from '../src/venues';

export default defineContentScript({
  matches: VENUE_MATCHES,
  runAt: 'document_start',
  async main() {
    let generation: number | null = null;
    const pending: Capture[] = [];
    const listening = new AbortController();

    const forward = (capture: Capture) => {
      if (generation === null) {
        pending.push(capture);
        return;
      }
      const message: RuntimeMessage = { type: 'capture', generation, capture };
      void browser.runtime.sendMessage(message).catch(() => undefined);
    };

    // Listen before asking, so captures posted during the handshake are buffered, not lost.
    window.addEventListener(
      'message',
      (event) => {
        if (event.source !== window || !isPageMessage(event.data) || event.data.kind !== 'capture') return;
        forward(event.data.capture);
      },
      { signal: listening.signal },
    );

    const hello: RuntimeMessage = { type: 'hello' };
    const reply = (await browser.runtime.sendMessage(hello).catch(() => null)) as HelloReply | null;
    if (!reply?.owned || reply.generation === undefined) {
      // The user's own tab: never forward anything.
      listening.abort();
      pending.length = 0;
      return;
    }
    generation = reply.generation;
    pending.splice(0).forEach(forward);
    const spoof: PageMessage = { source: MSG_SOURCE, kind: 'spoof-visibility' };
    window.postMessage(spoof, window.location.origin);
    if (reply.fill) scheduleFill(document, reply.fill);
  },
});
```

- [ ] **Step 7: Verify and build**

Run: `pnpm verify && pnpm build && node -e "const m=require('./.output/chrome-mv3/manifest.json');console.log(JSON.stringify(m.content_scripts.map(c=>[c.world??'ISOLATED',c.run_at,c.matches.length])))"`
Expected: verify clean; output `[["MAIN","document_start",4],["ISOLATED","document_start",4]]` (order may differ).

- [ ] **Step 8: Commit**

```bash
git add src/venues/index.ts src/messages.ts src/capture entrypoints tests
git commit -m "feat: page capture, visibility spoof, Matcha amount fallback and content scripts"
```

---

### Task 9: Controller and service worker

**Skill for implementer:** `chrome-extensions`, `superpowers:test-driven-development`.

**Files:**
- Create: `src/controller.ts`
- Modify: `entrypoints/background.ts` (replace whole file)
- Test: `tests/controller.test.ts`

**Interfaces:**
- Consumes: `ADAPTERS` (Task 8), `HelloReply`, `PanelToWorker`, `WorkerToPanel`, `RuntimeMessage`, `isCapture` (Task 8), types.
- Produces:
  - `interface BrowserPort { createWindow(tabCount): Promise<{ windowId: number; tabIds: number[] }>; createTab(windowId): Promise<number>; navigate(tabId, url): Promise<void>; closeWindow(windowId): Promise<void> }`
  - `class Controller(port: BrowserPort, emit: (results: VenueResult[]) => void, adapters?)` with `snapshot()`, `compare(trade)`, `refresh()`, `hello(tabId): HelloReply`, `onCapture(tabId, generation, capture)`, `onTabRemoved(tabId)`, `onWindowRemoved(windowId)`, `close()`

- [ ] **Step 1: Write the failing test**

`tests/controller.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller, type BrowserPort } from '../src/controller';
import { NATIVE } from '../src/lib/tokens';
import type { Trade, VenueResult } from '../src/types';
import { bridgeTrade, loadCapture, swapTrade } from './helpers';

const TAB = { jumper: 100, 'jumper-advanced': 101, bungee: 102, relay: 103, matcha: 104 } as const;

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
    expect(port.createWindow).toHaveBeenCalledWith(5);
    expect(port.navigate).toHaveBeenCalledTimes(5);
    expect(port.navigate).toHaveBeenCalledWith(TAB.jumper, expect.stringMatching(/^https:\/\/jumper\.xyz\/\?/));
    expect(port.navigate).toHaveBeenCalledWith(TAB.relay, expect.stringMatching(/^https:\/\/relay\.link\/bridge\/base\?/));
    expect(Object.values(status())).toEqual(['loading', 'loading', 'loading', 'loading', 'loading']);
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
    expect(status()).toEqual({ jumper: 'timeout', 'jumper-advanced': 'timeout', bungee: 'timeout', relay: 'timeout', matcha: 'loading' });
    vi.advanceTimersByTime(10_000);
    expect(status().matcha).toBe('timeout');
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

  it('shows a build error for a chain a venue does not support', async () => {
    const { controller, result, status } = setup();
    const token = { chainId: 999, address: NATIVE, symbol: 'X', decimals: 18 };
    const trade: Trade = { ...bridgeTrade(), toChainId: 999, toToken: token };
    await controller.compare(trade);
    expect(result('relay')).toMatchObject({ status: 'error', error: 'Relay does not list chain 999' });
    expect(status().jumper).toBe('loading');
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
    expect(Object.values(status())).toEqual(['error', 'error', 'error', 'error', 'error']);
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
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm vitest run tests/controller.test.ts`
Expected: FAIL, "Cannot find module '../src/controller'".

- [ ] **Step 3: Implement `src/controller.ts`**

```ts
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
```

- [ ] **Step 4: Run to confirm pass**

Run: `pnpm vitest run tests/controller.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Replace `entrypoints/background.ts`**

```ts
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
```

- [ ] **Step 6: Verify and build**

Run: `pnpm verify && pnpm build`
Expected: verify clean; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/controller.ts entrypoints/background.ts tests/controller.test.ts
git commit -m "feat: comparison controller and service worker wiring"
```

---

### Task 10: Side panel

**Skill for implementer:** `impeccable` (craft) then `baseline-ui` (deslop), following `web-design-guidelines` rules; DESIGN.md is filled first in Step 1. `superpowers:test-driven-development` for `form.ts`/`view.ts`/`format.ts`.

**Files:**
- Modify: `DESIGN.md` (replace template)
- Create: `src/lib/format.ts`, `src/panel/form.ts`, `src/panel/view.ts`, `entrypoints/sidepanel/index.html`, `entrypoints/sidepanel/main.ts`, `entrypoints/sidepanel/style.css`
- Test: `tests/lib/format.test.ts`, `tests/panel/form.test.ts`, `tests/panel/view.test.ts`

**Interfaces:**
- Consumes: `CHAINS`, `NATIVE`, `findToken`, `tokensFor`, `chainById`, `defaultToToken` (Task 3); `normalizeAmount`, `formatUnits` (Task 2); `rankQuotes` (Task 2); `ADAPTERS`, `hintFromUrl` (Task 8); `PanelToWorker`, `WorkerToPanel` (Task 8).
- Produces: `fmtPct`, `fmtUsd`, `fmtFee`, `fmtGas`, `fmtEta`, `fmtDelta`; `type Mode`, `interface FormState`, `DEFAULT_STATE`, `buildTrade(state)`, `resolveToken(chainId, address)`, `stateFromHint(hint, base)`; `type Row`, `buildRows(results, toSymbol)`, `renderRows(list, rows)`.

- [ ] **Step 1: Replace `DESIGN.md`**

```markdown
---
version: alpha
name: "Quote Compare"
description: "A trade ticket in a narrow side panel: dense rows of numbers, one accent for action, nothing decorative."
colors:
  primary: "#1A1C1E"
  secondary: "#5F656B"
  accent: "#0F766E"
  surface: "#F7F5F2"
  surface-raised: "#FFFFFF"
  success: "#2E7D4F"
  danger: "#B3261E"
typography:
  body-md:
    fontFamily: "system-ui"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui"
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.3
  data:
    fontFamily: "ui-monospace"
    fontSize: 0.875rem
    fontFeature: "tnum, zero"
rounded:
  sm: 4px
  md: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
  row:
    backgroundColor: "{colors.surface}"
    padding: "{spacing.sm}"
---

## Overview

A broker's trade ticket squeezed into a 360 px side panel. The one memorable element is the ranked list: the best row's "Best" marker in green, every other row showing how far behind it is. Everything else stays quiet.

## Colors

`accent` is the only interactive hue (Compare button, focus rings). `success` marks the best quote only. `danger` is for failed venues and form errors. Body text `primary` on `surface` is 15.6:1. Dark scheme mirrors these in `style.css` under `prefers-color-scheme: dark`.

## Typography

System UI stack for text; `ui-monospace` for amounts and deltas, always `tabular-nums slashed-zero`. No web fonts: the extension ships no font files and loads nothing remote.

## Layout

Single column, 16 px padding, 12 px gaps. Dense: result rows are two lines separated by hairlines, no cards.

## Elevation & Depth

Borders only, no shadows. Hairline border is `secondary` at 25% opacity.

## Shapes

`sm` for inputs and selects, `md` for buttons and the mode switch.

## Components

Mode switch (Swap/Bridge), chain and token selects with an "Other token…" address field, amount field, Compare and Refresh buttons. Result states: quote row, loading row, failed row, timed-out row, empty row. Focus ring: 2 px `accent`.

## Do's and Don'ts

- Do: every color and space value in `style.css` traces to this file.
- Do: render venue-supplied text with `textContent` only.
- Don't: gradients, glow, hover-scale, ALL-CAPS labels, decorative icons.
```

- [ ] **Step 2: Write failing tests**

`tests/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fmtDelta, fmtEta, fmtFee, fmtGas, fmtPct, fmtUsd } from '../../src/lib/format';

describe('format', () => {
  it('formats venue fees', () => {
    expect(fmtFee(undefined)).toBe('—');
    expect(fmtFee({ label: 'LIFI Fixed Fee', usd: 0.0545, pct: 0.02 })).toBe('$0.05 (0.02%)');
    expect(fmtFee({ label: 'Matcha fee', pct: 0.25 })).toBe('0.25%');
    expect(fmtFee({ label: 'None', usd: 0 })).toBe('None');
  });
  it('formats percents without trailing zeros', () => {
    expect(fmtPct(0.4)).toBe('0.4%');
    expect(fmtPct(1)).toBe('1%');
  });
  it('formats gas', () => {
    expect(fmtGas(undefined)).toBe('—');
    expect(fmtGas(0.0091)).toBe('<$0.01');
    expect(fmtGas(0.0296)).toBe('$0.03');
    expect(fmtGas(0)).toBe('$0.00');
  });
  it('formats ETA', () => {
    expect(fmtEta(undefined)).toBe('—');
    expect(fmtEta(1)).toBe('1s');
    expect(fmtEta(306)).toBe('5m');
    expect(fmtEta(7200)).toBe('2h');
  });
  it('formats delta and USD', () => {
    expect(fmtDelta(true, 0)).toBe('Best');
    expect(fmtDelta(false, -0.0199)).toBe('-0.020%');
    expect(fmtUsd(272.176)).toBe('$272.18');
    expect(fmtUsd(undefined)).toBe('');
  });
});
```

`tests/panel/form.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NATIVE } from '../../src/lib/tokens';
import { buildTrade, DEFAULT_STATE, resolveToken, stateFromHint, type FormState } from '../../src/panel/form';
import { USDC_BASE } from '../helpers';

const state = (over: Partial<FormState>): FormState => ({ ...DEFAULT_STATE, amount: '0.1', ...over });

describe('buildTrade', () => {
  it('builds a bridge trade from built-in tokens', () => {
    const r = buildTrade(state({ mode: 'bridge', fromChainId: 42161, toChainId: 8453, fromToken: NATIVE, toToken: USDC_BASE }));
    expect(r.ok && r.trade).toMatchObject({ fromChainId: 42161, toChainId: 8453, amount: '0.1', toToken: { symbol: 'USDC', decimals: 6 } });
  });

  it('keeps swaps on one chain', () => {
    const r = buildTrade(state({ mode: 'swap', fromChainId: 8453, toChainId: 42161, fromToken: NATIVE, toToken: USDC_BASE }));
    expect(r.ok && r.trade.toChainId).toBe(8453);
  });

  it('normalises the amount', () => {
    const r = buildTrade(state({ amount: ' .5 ' }));
    expect(r.ok && r.trade.amount).toBe('0.5');
  });

  it.each([
    [{ amount: '0' }, 'Enter an amount greater than 0.'],
    [{ amount: 'abc' }, 'Enter an amount greater than 0.'],
    [{ mode: 'bridge' as const, fromChainId: 8453, toChainId: 8453 }, 'Pick a different destination chain, or switch to Swap.'],
    [{ mode: 'swap' as const, fromChainId: 8453, fromToken: NATIVE, toToken: NATIVE }, 'Pick two different tokens.'],
    [{ toToken: '0x123' }, 'Enter a valid "To" token address: 0x followed by 40 hex characters.'],
  ])('rejects %j', (over, error) => {
    expect(buildTrade(state(over))).toEqual({ ok: false, error });
  });
});

describe('resolveToken', () => {
  it('turns a pasted address into a token with unknown decimals', () => {
    expect(resolveToken(8453, '0x1234567890abcdef1234567890abcdef1234abcd')).toEqual({
      chainId: 8453,
      address: '0x1234567890abcdef1234567890abcdef1234abcd',
      symbol: '0x1234…abcd',
      decimals: null,
    });
  });
});

describe('stateFromHint', () => {
  it('fills the form from a venue URL hint', () => {
    expect(stateFromHint({ fromChainId: 42161, toChainId: 8453, fromToken: NATIVE, toToken: NATIVE, amount: '0.2' }, DEFAULT_STATE)).toEqual({
      mode: 'bridge',
      fromChainId: 42161,
      toChainId: 8453,
      fromToken: NATIVE,
      toToken: NATIVE,
      amount: '0.2',
    });
  });

  it('falls back for unknown chains and missing fields', () => {
    const s = stateFromHint({ fromChainId: 999 }, { ...DEFAULT_STATE, amount: '3' });
    expect(s).toMatchObject({ fromChainId: DEFAULT_STATE.fromChainId, amount: '3', mode: 'swap' });
  });
});
```

`tests/panel/view.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildRows, renderRows } from '../../src/panel/view';
import type { Quote, VenueResult } from '../../src/types';

const quote = (over: Partial<Quote>): Quote => ({ venue: 'jumper', route: 'AcrossV4', toAmount: '1000000', toDecimals: 6, ...over });

const results: VenueResult[] = [
  { venue: 'jumper', status: 'ok', updatedAt: 1, quotes: [quote({ route: 'A', toAmount: '1000000', etaSec: 1 }), quote({ route: 'B', toAmount: '3000000', toAmountUsd: 3 })] },
  { venue: 'jumper-advanced', status: 'idle', quotes: [], updatedAt: 0 },
  { venue: 'bungee', status: 'ok', updatedAt: 1, quotes: [quote({ venue: 'bungee', route: 'C', toAmount: '2000000' })] },
  { venue: 'relay', status: 'loading', quotes: [], updatedAt: 1 },
  { venue: 'matcha', status: 'error', quotes: [], error: 'HTTP 500', updatedAt: 1 },
];

describe('buildRows', () => {
  it('ranks all quotes, then lists venue states', () => {
    const rows = buildRows(results, 'USDC');
    expect(rows.map((r) => (r.kind === 'quote' ? r.route : `${r.venueLabel}: ${r.text}`))).toEqual(['B', 'C', 'A', 'Relay: Loading…', 'Matcha: Failed: HTTP 500']);
    const best = rows[0];
    expect(best?.kind === 'quote' && best).toMatchObject({ best: true, delta: 'Best', receive: '3 USDC', usd: '$3.00', venueLabel: 'Jumper' });
    const last = rows[2];
    expect(last?.kind === 'quote' && last.delta).toBe('-66.667%');
  });
});

describe('renderRows', () => {
  it('renders one list item per row with an Open button on quotes', () => {
    const list = document.createElement('ol');
    renderRows(list, buildRows(results, 'USDC'));
    expect(list.children).toHaveLength(5);
    expect(list.querySelector('li.quote.best .receive')?.textContent).toContain('3 USDC');
    expect(list.querySelector<HTMLButtonElement>('li.quote button.open')?.dataset.venue).toBe('jumper');
    expect(list.querySelector('li.status.error')?.textContent).toContain('Failed: HTTP 500');
  });

  it('renders venue text as text', () => {
    const list = document.createElement('ol');
    const hostile: VenueResult[] = [{ venue: 'relay', status: 'ok', updatedAt: 1, quotes: [quote({ venue: 'relay', route: '<img src=x onerror=alert(1)>' })] }];
    renderRows(list, buildRows(hostile, 'USDC'));
    expect(list.querySelector('img')).toBeNull();
    expect(list.querySelector('.route')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `pnpm vitest run tests/lib/format.test.ts tests/panel`
Expected: FAIL, missing `src/lib/format`, `src/panel/form`, `src/panel/view`.

- [ ] **Step 4: Implement format, form and view**

`src/lib/format.ts`:

```ts
import type { VenueFee } from '../types';

const trimZeros = (s: string) => s.replace(/\.?0+$/, '');

export const fmtPct = (pct: number): string => `${trimZeros(pct.toFixed(3))}%`;

export const fmtUsd = (usd: number | undefined): string => (usd === undefined ? '' : `$${usd.toFixed(2)}`);

export function fmtFee(fee: VenueFee | undefined): string {
  if (!fee) return '—';
  const parts: string[] = [];
  if (fee.usd !== undefined && fee.usd > 0) parts.push(`$${fee.usd.toFixed(2)}`);
  if (fee.pct !== undefined && fee.pct > 0) parts.push(parts.length ? `(${fmtPct(fee.pct)})` : fmtPct(fee.pct));
  return parts.length ? parts.join(' ') : 'None';
}

export function fmtGas(usd: number | undefined): string {
  if (usd === undefined) return '—';
  if (usd > 0 && usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}

export function fmtEta(sec: number | undefined): string {
  if (sec === undefined) return '—';
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${Math.round(sec / 3600)}h`;
}

export const fmtDelta = (best: boolean, deltaPct: number): string => (best ? 'Best' : `${deltaPct.toFixed(3)}%`);
```

`src/panel/form.ts`:

```ts
import { chainById, findToken, NATIVE, sameToken } from '../lib/tokens';
import { normalizeAmount } from '../lib/units';
import type { Address, Token, Trade, TradeHint } from '../types';

export type Mode = 'swap' | 'bridge';

export interface FormState {
  mode: Mode;
  fromChainId: number;
  /** ignored in swap mode */
  toChainId: number;
  /** built-in token address or a pasted address */
  fromToken: string;
  toToken: string;
  amount: string;
}

export const DEFAULT_STATE: FormState = {
  mode: 'bridge',
  fromChainId: 42161,
  toChainId: 8453,
  fromToken: NATIVE,
  toToken: NATIVE,
  amount: '',
};

export function resolveToken(chainId: number, address: string): Token | null {
  const known = findToken(chainId, address.trim());
  if (known) return { ...known };
  const a = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return null;
  return { chainId, address: a as Address, symbol: `${a.slice(0, 6)}…${a.slice(-4)}`, decimals: null };
}

export function buildTrade(s: FormState): { ok: true; trade: Trade } | { ok: false; error: string } {
  const amount = normalizeAmount(s.amount);
  if (!amount) return { ok: false, error: 'Enter an amount greater than 0.' };
  const toChainId = s.mode === 'swap' ? s.fromChainId : s.toChainId;
  if (s.mode === 'bridge' && toChainId === s.fromChainId) {
    return { ok: false, error: 'Pick a different destination chain, or switch to Swap.' };
  }
  const fromToken = resolveToken(s.fromChainId, s.fromToken);
  if (!fromToken) return { ok: false, error: 'Enter a valid "From" token address: 0x followed by 40 hex characters.' };
  const toToken = resolveToken(toChainId, s.toToken);
  if (!toToken) return { ok: false, error: 'Enter a valid "To" token address: 0x followed by 40 hex characters.' };
  if (toChainId === s.fromChainId && sameToken(fromToken.address, toToken.address)) {
    return { ok: false, error: 'Pick two different tokens.' };
  }
  return { ok: true, trade: { fromChainId: s.fromChainId, toChainId, fromToken, toToken, amount } };
}

export function stateFromHint(hint: TradeHint, base: FormState): FormState {
  const fromChainId = hint.fromChainId !== undefined && chainById(hint.fromChainId) ? hint.fromChainId : base.fromChainId;
  const toChainId = hint.toChainId !== undefined && chainById(hint.toChainId) ? hint.toChainId : fromChainId;
  return {
    mode: fromChainId === toChainId ? 'swap' : 'bridge',
    fromChainId,
    toChainId,
    fromToken: hint.fromToken ?? NATIVE,
    toToken: hint.toToken ?? NATIVE,
    amount: hint.amount ?? base.amount,
  };
}
```

`src/panel/view.ts`:

```ts
import { fmtDelta, fmtEta, fmtFee, fmtGas, fmtUsd } from '../lib/format';
import { rankQuotes } from '../lib/rank';
import { formatUnits } from '../lib/units';
import type { VenueId, VenueResult } from '../types';
import { ADAPTERS } from '../venues';

export type Row =
  | { kind: 'quote'; venue: VenueId; venueLabel: string; route: string; receive: string; usd: string; delta: string; best: boolean; fee: string; gas: string; eta: string }
  | { kind: 'status'; venue: VenueId; venueLabel: string; text: string; tone: 'muted' | 'error' };

const STATUS_TEXT = { loading: 'Loading…', empty: 'No routes for this trade', timeout: 'No quote in time' } as const;

export function buildRows(results: VenueResult[], toSymbol: string): Row[] {
  const ranked = rankQuotes(results.filter((r) => r.status === 'ok').flatMap((r) => r.quotes));
  const rows: Row[] = ranked.map((q) => ({
    kind: 'quote',
    venue: q.venue,
    venueLabel: ADAPTERS[q.venue].label,
    route: q.route,
    receive: `${formatUnits(q.toAmount, q.toDecimals)} ${toSymbol}`,
    usd: fmtUsd(q.toAmountUsd),
    delta: fmtDelta(q.best, q.deltaPct),
    best: q.best,
    fee: fmtFee(q.venueFee),
    gas: fmtGas(q.gasUsd),
    eta: fmtEta(q.etaSec),
  }));
  for (const r of results) {
    if (r.status === 'ok' || r.status === 'idle') continue;
    const venueLabel = ADAPTERS[r.venue].label;
    rows.push(
      r.status === 'error'
        ? { kind: 'status', venue: r.venue, venueLabel, text: `Failed: ${r.error ?? 'unknown error'}`, tone: 'error' }
        : { kind: 'status', venue: r.venue, venueLabel, text: STATUS_TEXT[r.status], tone: 'muted' },
    );
  }
  return rows;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Venue-supplied strings only ever reach the DOM through textContent. */
export function renderRows(list: HTMLOListElement, rows: Row[]): void {
  const doc = list.ownerDocument;
  list.replaceChildren(
    ...rows.map((row) => {
      if (row.kind === 'status') {
        const item = el(doc, 'li', `status ${row.tone}`);
        item.append(el(doc, 'span', 'venue', row.venueLabel), el(doc, 'span', 'text', row.text));
        return item;
      }
      const item = el(doc, 'li', row.best ? 'quote best' : 'quote');
      const receive = el(doc, 'span', 'receive', row.receive);
      if (row.usd) receive.append(el(doc, 'small', 'usd', row.usd));
      const head = el(doc, 'div', 'line1');
      head.append(el(doc, 'span', 'venue', row.venueLabel), el(doc, 'span', 'route', row.route), receive);
      const open = el(doc, 'button', 'open', 'Open');
      open.type = 'button';
      open.dataset.venue = row.venue;
      open.setAttribute('aria-label', `Open ${row.venueLabel} with this trade`);
      const meta = el(doc, 'div', 'line2');
      meta.append(
        el(doc, 'span', 'delta', row.delta),
        el(doc, 'span', 'fee', `Fee ${row.fee}`),
        el(doc, 'span', 'gas', `Gas ${row.gas}`),
        el(doc, 'span', 'eta', `ETA ${row.eta}`),
        open,
      );
      item.append(head, meta);
      return item;
    }),
  );
}
```

- [ ] **Step 5: Run to confirm pass**

Run: `pnpm vitest run tests/lib/format.test.ts tests/panel`
Expected: PASS.

- [ ] **Step 6: Write the panel page**

`entrypoints/sidepanel/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Quote Compare</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <form id="trade" novalidate>
        <fieldset class="mode">
          <legend class="sr-only">Trade type</legend>
          <label><input type="radio" name="mode" value="swap" /> Swap</label>
          <label><input type="radio" name="mode" value="bridge" checked /> Bridge</label>
        </fieldset>
        <div class="side">
          <label class="field" for="fromChain">From</label>
          <select id="fromChain"></select>
          <select id="fromToken" aria-label="From token"></select>
          <input id="fromTokenAddr" type="text" aria-label="From token address" placeholder="0x… token address" spellcheck="false" autocomplete="off" hidden />
        </div>
        <div class="side">
          <label class="field" for="toChain">To</label>
          <select id="toChain"></select>
          <select id="toToken" aria-label="To token"></select>
          <input id="toTokenAddr" type="text" aria-label="To token address" placeholder="0x… token address" spellcheck="false" autocomplete="off" hidden />
        </div>
        <div class="side">
          <label class="field" for="amount">Amount</label>
          <input id="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.1" />
        </div>
        <p id="formError" role="alert" hidden></p>
        <div class="actions">
          <button type="submit">Compare</button>
          <button type="button" id="refresh" disabled>Refresh</button>
        </div>
      </form>
      <section aria-labelledby="quotesTitle">
        <h2 id="quotesTitle">Quotes</h2>
        <p id="banner" role="status"></p>
        <ol id="results"></ol>
        <p class="note">Amounts are what each site's own page quoted, after that site's fee. You sign on the venue's site.</p>
      </section>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`entrypoints/sidepanel/style.css`:

```css
:root {
  color-scheme: light dark;
  --bg: #f7f5f2;
  --surface: #ffffff;
  --text: #1a1c1e;
  --muted: #5f656b;
  --line: rgb(95 101 107 / 0.25);
  --accent: #0f766e;
  --accent-text: #ffffff;
  --best: #2e7d4f;
  --danger: #b3261e;
  --font: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  --s1: 4px;
  --s2: 8px;
  --s3: 12px;
  --s4: 16px;
  --r-sm: 4px;
  --r-md: 8px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121416;
    --surface: #1b1e21;
    --text: #e8e8e6;
    --muted: #9aa0a6;
    --line: rgb(154 160 166 / 0.25);
    --accent: #2bb3a3;
    --accent-text: #0b1210;
    --best: #5cc389;
    --danger: #f2877e;
  }
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 var(--font); }
main { padding: var(--s4); display: grid; gap: var(--s4); }
form { display: grid; gap: var(--s3); }

.mode { display: inline-flex; width: max-content; margin: 0; padding: 2px; border: 1px solid var(--line); border-radius: var(--r-md); }
.mode label { position: relative; padding: var(--s1) var(--s3); border-radius: var(--r-sm); cursor: pointer; }
.mode input { position: absolute; opacity: 0; pointer-events: none; }
.mode label:has(input:checked) { background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); font-weight: 600; }
.mode label:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }

.side { display: grid; grid-template-columns: 3.75rem 1fr 1fr; gap: var(--s2); align-items: center; }
.side input { grid-column: 2 / -1; }
.field { color: var(--muted); font-size: 12px; font-weight: 500; }
select, input[type='text'] { min-width: 0; padding: 6px var(--s2); font: inherit; color: inherit; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-sm); }
#amount { font-family: var(--mono); font-variant-numeric: tabular-nums slashed-zero; }
select:focus-visible, input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.actions { display: flex; gap: var(--s2); }
button { padding: 6px var(--s4); font: inherit; color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); cursor: pointer; }
button[type='submit'] { color: var(--accent-text); background: var(--accent); border-color: transparent; font-weight: 600; }
button:disabled { opacity: 0.5; cursor: default; }
#formError { margin: 0; color: var(--danger); }

h2 { margin: 0; color: var(--muted); font-size: 13px; font-weight: 600; }
#banner { margin: 0; color: var(--danger); }
#banner:empty { display: none; }
#results { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
#results li { padding: var(--s2) 0; border-bottom: 1px solid var(--line); }

.line1 { display: grid; grid-template-columns: auto 1fr auto; gap: var(--s2); align-items: baseline; }
.venue { font-weight: 600; }
.route { overflow: hidden; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; }
.receive { font-family: var(--mono); font-variant-numeric: tabular-nums slashed-zero; text-align: right; }
.usd { display: block; color: var(--muted); font-size: 12px; }
.line2 { display: flex; flex-wrap: wrap; gap: var(--s1) var(--s3); align-items: center; margin-top: 2px; color: var(--muted); font-size: 12px; }
.line2 .open { margin-left: auto; padding: 2px var(--s3); font-size: 12px; }
.delta { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.best .delta { color: var(--best); font-weight: 600; }
.status { display: flex; gap: var(--s2); color: var(--muted); }
.status.error .text { color: var(--danger); }
.note { margin: 0; color: var(--muted); font-size: 12px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

`entrypoints/sidepanel/main.ts`:

```ts
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
```

- [ ] **Step 7: Verify and build**

Run: `pnpm verify && pnpm build && ls .output/chrome-mv3`
Expected: verify clean; `sidepanel.html` present in the output.

- [ ] **Step 8: Craft pass**

Invoke `impeccable` on `entrypoints/sidepanel/` against `DESIGN.md`, then `baseline-ui`. Keep every value traced to `DESIGN.md` tokens. Re-run `pnpm verify` after any change.

- [ ] **Step 9: Commit**

```bash
git add DESIGN.md src/lib/format.ts src/panel entrypoints/sidepanel tests/lib/format.test.ts tests/panel
git commit -m "feat: side panel form, ranked results and design tokens"
```

---

### Task 11: Live smoke test

Run by the lead session (touches the real sites; not part of `verify`).

**Files:**
- Create: `scripts/smoke.mjs`
- Modify: `tasks/todo.md` (record the result)

- [ ] **Step 1: Write `scripts/smoke.mjs`**

```js
// Live end-to-end check: loads the built extension, runs two comparisons, prints the rows.
// Not part of `pnpm verify` (needs network and the real venue sites).
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const EXT = resolve('.output/chrome-mv3');
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const NATIVE = '0x0000000000000000000000000000000000000000';
const TRADES = [
  { name: '0.1 ETH Arbitrum -> ETH Base', mode: 'bridge', from: '42161', fromToken: NATIVE, to: '8453', toToken: NATIVE },
  { name: '0.1 ETH -> USDC on Base', mode: 'swap', from: '8453', fromToken: NATIVE, to: '8453', toToken: USDC_BASE },
];

const context = await chromium.launchPersistentContext('', {
  channel: process.env.SMOKE_CHANNEL ?? 'chrome',
  headless: !process.env.SMOKE_HEADFUL,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--disable-features=DisableLoadExtensionCommandLineSwitch'],
});
let [worker] = context.serviceWorkers();
worker ??= await context.waitForEvent('serviceworker', { timeout: 15_000 }).catch(() => undefined);
if (!worker) {
  console.error('Extension did not load. Retry with: pnpm exec playwright install chromium && SMOKE_CHANNEL=chromium pnpm smoke');
  await context.close();
  process.exit(2);
}
const id = new URL(worker.url()).host;
const page = await context.newPage();
await page.goto(`chrome-extension://${id}/sidepanel.html`);

let failed = false;
for (const t of TRADES) {
  await page.check(`input[name="mode"][value="${t.mode}"]`);
  await page.selectOption('#fromChain', t.from);
  await page.selectOption('#fromToken', t.fromToken);
  if (t.mode === 'bridge') await page.selectOption('#toChain', t.to);
  await page.selectOption('#toToken', t.toToken);
  await page.fill('#amount', '0.1');
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => {
      const items = [...document.querySelectorAll('#results li')];
      return items.length > 0 && !items.some((li) => li.textContent?.includes('Loading…'));
    },
    null,
    { timeout: 60_000 },
  );
  const rows = await page.$$eval('#results li', (items) => items.map((li) => li.textContent?.replace(/\s+/g, ' ').trim()));
  const venues = new Set(await page.$$eval('#results li.quote .venue', (els) => els.map((e) => e.textContent)));
  console.log(`\n== ${t.name}: ${venues.size} venues quoted`);
  for (const row of rows) console.log('  ', row);
  if (venues.size < 4) failed = true;
}
await context.close();
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it**

Run: `pnpm smoke`
Expected: two blocks of rows; each ends with at least 4 distinct venues quoted; exit code 0. If Matcha times out while the others quote, set `WINDOW_STATE = 'normal'` in `entrypoints/background.ts`, rebuild, and re-run; record which mode worked.

- [ ] **Step 3: Compare against the sites**

For the top row of each venue, open that venue with the "Open" link in a normal Chrome window and check the site shows the same amount (within its own refresh drift). Record matches in the Review section below.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke.mjs tasks/todo.md
git commit -m "test: live smoke script and recorded results"
```

---

## Review

(Filled in after Task 11: smoke output, venue-by-venue match against the sites, window mode used, `/cost` figure.)
