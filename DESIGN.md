---
version: alpha
name: "Quote Compare"
description: "A trade ticket beside the dApp: one send/receive ticket, five venue cards, one teal action colour, green only for the winner."
colors:
  primary: "#14181B"
  secondary: "#5A636B"
  faint: "#626A71"
  accent: "#0F766E"
  surface: "#F3F4F5"
  surface-raised: "#FFFFFF"
  sunken: "#ECEEF0"
  success: "#1F7A45"
  danger: "#B3261E"
  dark-primary: "#E7EAEC"
  dark-secondary: "#99A2A9"
  dark-faint: "#838C93"
  dark-accent: "#2BB3A3"
  dark-surface: "#0D1012"
  dark-surface-raised: "#151A1D"
  dark-sunken: "#101416"
  dark-success: "#5CC389"
  dark-danger: "#F2877E"
typography:
  body-md:
    fontFamily: "system-ui"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui"
    fontSize: 0.75rem
    fontWeight: 550
    lineHeight: 1.3
  amount-input:
    fontFamily: "ui-monospace"
    fontSize: 1.625rem
    fontWeight: 600
    fontFeature: "tnum, zero"
  amount-card:
    fontFamily: "ui-monospace"
    fontSize: 1.25rem
    fontWeight: 650
    fontFeature: "tnum, zero"
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
  leg:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  venue-card:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  token-pill:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.pill}"
---

## Overview

A trade ticket that sits beside whichever dApp the user has open. Two "legs" (You send, You receive) with a flip button between them, one Compare action, then five venue cards: each venue's single best route, the winner outlined in green and named in a one-line summary that says how far ahead of Jumper it is. Everything else stays neutral so the numbers carry the page.

## Colors

Restrained: neutrals plus one accent. `accent` (teal) is the only interactive hue: Compare, the winner's Open button, focus rings, the Swap/Bridge chip. `success` marks the winning card only (outline, Best badge, "Best" delta). `danger` is for failed venues and form errors. Both schemes follow the OS (`prefers-color-scheme`); DeFi sites are mostly dark, so the dark scheme is tuned as carefully as the light one. `faint` is the lowest-contrast text allowed and still clears 4.5:1 on its surface in both schemes.

## Typography

System UI stack for text. `ui-monospace` only for measurements: amounts, deltas, fees, gas, times, addresses, always `tabular-nums slashed-zero` so columns of digits line up across cards. No web fonts: the extension ships no font files and loads nothing remote.

## Layout

The page is a size container. Under 720 px (the side panel): ticket stacked, venue cards in a horizontal scroll-snap strip, the next card peeking to show there is more. From 720 px (the pop-out window, or a panel dragged wide): ticket in one row (send, flip, receive, actions) and the five cards side by side. Spacing scale 4/8/12/16/24.

## Elevation & Depth

Raised surfaces (legs, quote cards) get a soft two-layer shadow with offset and blur; states that are not a quote (loading, failed, timed out) sit sunken with no shadow. The picker dialog lifts higher over a dim scrim. No glow, no glass.

## Shapes

`lg` for legs and cards, `md` for the Compare button and search field, `sm` for icon buttons and venue marks, `pill` for token pills, chips and badges. Token logos are circles with the chain as a small circular badge on the lower right.

## Components

- Token pill: token logo with chain badge, symbol, "on <chain>", chevron. Opens the picker.
- Picker (`<dialog>`): chain chips with logos, search that matches symbol, name or a pasted address, token rows with logo, name and short address. A valid pasted address that is not built in appears as a custom token.
- Venue card states: quote (amount, USD, route, vs best, venue fee, gas, time, route count, Open site), loading (skeleton shimmer), empty, timed out with the reason, failed with the reason.
- Icons: one authored set, 24 px grid, 1.75 stroke, round caps (`src/panel/icons.ts`).
- Logos: bundled under `public/logos/{chains,tokens,venues}`; a missing image falls back to a two-letter monogram.

## Motion

One authored moment: when a venue's amount changes, it settles in (opacity and a 3 px blur resolving over 420 ms, exponential ease-out). Unchanged amounts never re-animate on live updates. The picker rises 8 px on open. Everything is removed under `prefers-reduced-motion`.

## Do's and Don'ts

- Do: every color, radius and space value in `style.css` traces to this file.
- Do: render venue-supplied text with `textContent` only.
- Do: show one route per venue; the pick is the highest amount, or the fastest route within 0.05% of it.
- Don't: gradients, glow, hover-scale, eyebrow labels, emoji or glyphs as icons, remote images or fonts.
