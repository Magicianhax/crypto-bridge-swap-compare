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
