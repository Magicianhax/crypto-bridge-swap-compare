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
