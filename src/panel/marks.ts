import type { Chain } from '../lib/tokens';
import type { Token } from '../types';

/** A logo image that falls back to a two-letter monogram when the file is missing (pasted tokens have none). */
export function logo(doc: Document, src: string | undefined, label: string, className: string): HTMLElement {
  const monogram = () => {
    const span = doc.createElement('span');
    span.className = `${className} monogram`;
    span.textContent = label.replace(/^0x/i, '').slice(0, 2).toUpperCase();
    span.setAttribute('aria-hidden', 'true');
    return span;
  };
  if (!src) return monogram();
  const img = doc.createElement('img');
  img.className = className;
  img.src = src;
  img.alt = '';
  img.decoding = 'async';
  img.addEventListener('error', () => img.replaceWith(monogram()), { once: true });
  return img;
}

/** Token logo with its chain as a small badge in the corner. */
export function tokenMark(doc: Document, token: Pick<Token, 'symbol' | 'logo'>, chain: Chain | undefined): HTMLElement {
  const mark = doc.createElement('span');
  mark.className = 'mark';
  mark.append(logo(doc, token.logo ? `/logos/tokens/${token.logo}` : undefined, token.symbol, 'mark-token'));
  if (chain) mark.append(logo(doc, `/logos/chains/${chain.logo}`, chain.name, 'mark-chain'));
  return mark;
}
