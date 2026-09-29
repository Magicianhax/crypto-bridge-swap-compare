# Venue teardown (2026-09-29, live in Chrome, no wallet connected)

All five venues prefill from URL params (human-unit amounts) and quote without a wallet.
Test trade: 0.1 ETH Arbitrum -> Base ETH, and 0.1 ETH -> USDC on Base.

| Venue | Prefill URL | Quote transport | Response | Fee signal |
|---|---|---|---|---|
| Jumper | `jumper.xyz/?fromChain&fromToken&toChain&toToken&fromAmount` (native = `0x000…0`) | `fetch` POST `api.jumper.xyz/pipeline/v1/advanced/routes/stream`, `text/event-stream` | `event: routes` blocks, `data: {provider, routes[], unavailableRoutes}`; route = LI.FI shape (`toAmount`, `toAmountMin`, `gasCostUSD`, `toToken.decimals`, `steps[].tool`, `steps[].estimate.feeCosts[]`, `steps[].estimate.executionDuration`), ends with `event: done` | request `options.integrator = "jumper.exchange"`; `feeCosts` contains `LIFI Fixed Fee` (0.02% on ETH bridge), `included: true`, duplicated in `includedSteps` |
| Jumper Advanced | `jumper.xyz/advanced?tab=bridge-advanced&…` (bridge); swap tab is default, same-chain only | same endpoint | same shape | `integrator = "jumperadvanced"`, no fee items. Extra venues vs Jumper (Layerswap, LI.FI Intents). Across: 0.099969 vs 0.099949 on Jumper |
| Bungee | `app.bungee.exchange/?originChainId&destinationChainId&inputToken&outputToken&amount` (native = `0xeee…e`) | `fetch` GET `backend.socket.tech/v3/swap/quote/stream`, `text/event-stream` | `event: snapshot` cumulative; last snapshot `result.routes[]`: `output.amount`, `output.token.decimals`, `output.valueInUsd`, `estimatedTime`, `routeTags`, `routeDetails.bridgeDetails.protocol.displayName` / `dexDetails.protocol.displayName`, `gasFee.feeInUsd`; ends `event: done` | `routeDetails.feeDetails` (null on test route) |
| Relay | `relay.link/bridge/<destChainSlug>?fromChainId&fromCurrency&toCurrency&amount` (native = `0x000…0`) | **XHR** POST `relay.link/api/relay/quote/v2` | `details.currencyOut.amount` (+ `.currency.decimals`), `details.timeEstimate`, `fees.{gas,relayer,relayerGas,relayerService,app}.amountUsd` | `fees.app` (0 on relay.link), `referrer: "relay.link"` |
| Matcha | `matcha.xyz/?sellChain&sellAddress&buyChain&buyAddress&sellAmount` (native = `0xeee…e`); slow hydrate (~15 s) | `fetch` GET `/api/swap/price` (same chain), `/api/cross-chain/quote` (cross chain) | swap: `buyAmount` (net of fee), `route.fills[].source`; cross: `result.quote.{buyAmount, estimatedTimeSeconds, steps[].provider}` | `fees.zeroExFee` (~0.25% swap), UI "0.4% fee" cross-chain. `buyAmount` already net |

## Gotchas

- Jumper pauses quote refresh when the tab is hidden ("Session paused"). Background tabs must spoof `document.visibilityState`/`hasFocus`, or run in an unfocused normal window.
- Relay only refetches on input change; the first quote fires on load.
- Relay uses XHR, the others use fetch: the interceptor must patch both, in the MAIN world at `document_start`.
- Native token addresses differ per venue (`0x000…0` vs `0xeee…e`).
- Matcha buy-token decimals are not in `/api/swap/price`; take them from the request context (the token list the side panel already has) or from Matcha's `/api/tokens/info`.
