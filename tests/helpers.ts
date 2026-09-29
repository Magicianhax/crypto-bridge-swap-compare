import { readFileSync } from 'node:fs';
import type { Capture } from '../src/types';

export function loadCapture(venue: string, kind: 'bridge' | 'swap'): Capture {
  const path = new URL(`./fixtures/${venue}/${kind}.json`, import.meta.url);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Omit<Capture, 'id' | 'done'>;
  return { id: 1, done: true, ...raw };
}
