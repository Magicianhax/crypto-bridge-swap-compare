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
