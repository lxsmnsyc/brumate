// A log of the events of the parts, which the tests read.
import type { HoverEvent, PressEvent } from '../../src/events.ts';

type Entry = { type: string; pointerType?: string; value?: boolean };

declare global {
  // eslint-disable-next-line no-var
  var partEvents: Entry[] | undefined;
}

export function log(event: PressEvent | HoverEvent): void {
  (globalThis.partEvents ??= []).push({ type: event.type, pointerType: event.pointerType });
}

export function logChange(type: string): (value: boolean) => void {
  return (value) => (globalThis.partEvents ??= []).push({ type, value });
}

export function takeEvents(): Entry[] {
  const events = globalThis.partEvents ?? [];
  globalThis.partEvents = [];
  return events;
}
