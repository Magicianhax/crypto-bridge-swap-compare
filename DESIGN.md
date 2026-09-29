---
version: alpha
name: "<PROJECT_NAME>"
description: "<One line: the visual world this product lives in>"
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  accent: "#B8422E"
  surface: "#F7F5F2"
  surface-raised: "#FFFFFF"
  success: "#2E7D4F"
  danger: "#B3261E"
typography:
  display:
    fontFamily: "<Display face, e.g. Instrument Serif>"
    fontSize: 3rem
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: -0.02em
  h2:
    fontFamily: "<Text face, e.g. Switzer>"
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.2
  body-md:
    fontFamily: "<Text face>"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "<Text face>"
    fontSize: 0.8125rem
    fontWeight: 500
    lineHeight: 1.3
  data:
    fontFamily: "<Mono face, e.g. Geist Mono>"
    fontSize: 0.875rem
    fontFeature: "tnum, zero"
rounded:
  sm: 4px
  md: 8px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  badge-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.surface-raised}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
  toast-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface-raised}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
---

## Overview

<Two or three sentences naming the world: a reference (a broadsheet, a Bloomberg terminal, a field notebook), the one memorable element, and what stays quiet around it. Never "modern, clean, minimal".>

## Colors

<Why each token exists and where it is allowed. One accent drives interaction; nothing else may be that hue. State body-text contrast (must be >= 4.5:1).>

## Typography

<Which faces, licence status (free/commercial-OK or paid-mockup-only), how they are loaded (self-hosted from `public/fonts` or `@fontsource/*`; no runtime `fonts.googleapis.com` link). Two families max, differing in construction. Mono only for data, always `tabular-nums slashed-zero`.>

## Layout

<Grid, max widths, the single spacing scale above, density stance (trading UIs: dense, no cards).>

## Elevation & Depth

<Borders over shadows or the reverse; one rule. Border color is `{colors.secondary}` at a stated opacity (the spec has no border sub-token, so it lives here). No glassmorphism, glow, or gradient orbs.>

## Shapes

<Radius usage: which token for which element. Not one radius everywhere.>

## Components

<Anything beyond the tokens above: states (empty, loading, error are mandatory), focus rings, icon set (one set per product).>

## Do's and Don'ts

- Do: every color, size and space value traces to a token in this file; `src/styles/tokens.css` is generated with `npx @google/design.md export --format css-tailwind`.
- Do: motion answers a user action; 150-250 ms ease-out for product UI; `prefers-reduced-motion` path always.
- Don't: ALL-CAPS eyebrows, middle dots, spaced em dashes, three identical feature cards, hover-scale on every card, fade-slide-up on every section, bounce/elastic easing on UI.
- Don't: purple-to-blue gradients, pure #000/#fff text, gray-on-color text, unlabeled icon buttons.

<!-- Lint: npx @google/design.md lint DESIGN.md -->
