// One authored icon set: 24px grid, 1.75 stroke, round caps, drawn with currentColor.
const PATHS = {
  chevronDown: 'M6 9l6 6 6-6',
  flip: 'M8 4v15M8 19l-3.5-3.5M8 19l3.5-3.5M16 20V5M16 5l-3.5 3.5M16 5l3.5 3.5',
  search: 'M10.5 17.5a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4.5-4.5',
  popout: 'M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10',
  arrowUpRight: 'M7 17L17 7M9 7h8v8',
  close: 'M6 6l12 12M18 6L6 18',
  refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v5h-5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(doc: Document, name: IconName, size = 16): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  const path = doc.createElementNS(ns, 'path');
  path.setAttribute('d', PATHS[name]);
  svg.append(path);
  return svg;
}
