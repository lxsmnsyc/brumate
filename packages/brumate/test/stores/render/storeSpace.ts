// A store as the exports of a module, which `$store(space)` reads as a namespace import. It counts
// its writes, so a test sees that a resume never calls `set`.
let value = (globalThis as { savedSpace?: string }).savedSpace ?? 'n';
const listeners = new Set<(value: string) => void>();

export function get(): string {
  return value;
}

export function subscribe(listener: (value: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function set(next: string): void {
  const writes = (globalThis as { spaceSets?: number }).spaceSets ?? 0;
  (globalThis as { spaceSets?: number }).spaceSets = writes + 1;
  value = next;
  for (const listener of listeners) {
    listener(next);
  }
}
