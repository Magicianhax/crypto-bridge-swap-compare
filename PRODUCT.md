# PRODUCT

## What it is

A Chrome side-panel extension that, for one swap or bridge trade, opens Jumper, Jumper Advanced, Bungee, Relay and Matcha in a background window, reads the quotes each site's own page receives, and shows every route ranked by the amount you actually receive after that site's fee.

## Who it is for

- Primary user: a DeFi user about to swap or bridge on an EVM chain who wants the best net output and suspects an aggregator's frontend fee (Jumper's, from late September 2026) is eating it.

## Job to be done

When I'm about to bridge or swap, I want to see what each frontend would give me for the same trade, fees included, so I can execute on the one that pays most.

## What it is not

- Not a wallet, not an executor: it never connects, approves or signs.
- Not an API aggregator: it never calls LI.FI, Socket, Relay or 0x APIs itself.
- No limit, TWAP, multi-swap, non-EVM chains, history or alerts in v1.

## Success signals

- A ranked table for a supported trade within 30 s of pressing Compare.
- Each venue's top row matches that site's own displayed amount for the same input.

## Constraints

- Chains / networks: 17 EVM chains (see README), read only.
- Money: nothing moves value; the user signs on the venue site.
- Regulatory / distribution: load-unpacked for now; no store listing in v1.

## Competitive wedge

Each aggregator only compares its own sources and hides its own fee in the net number. Reading all five frontends side by side shows the same bridge quoted through different aggregators, fee included.

## Open product questions

- Store publishing and naming (out of v1).
