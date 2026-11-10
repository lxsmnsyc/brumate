// Numbers and values as text.

/** The type of a value, for the column next to it. */
export function readType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value instanceof Element) {
    return 'element';
  }
  if (typeof value === 'object') {
    const name = value.constructor?.name;
    return name && name !== 'Object' ? name : 'object';
  }
  return typeof value;
}

export function ms(time: number): string {
  return `${Math.round(time)} ms`;
}
export function seconds(time: number): string {
  return `${(time / 1000).toFixed(2)} s`;
}
export function kilobytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

/** The keys and values of an object, a map or a set, or the items of an array, in a row. */
function listEntries(value: object): unknown[] {
  if (value instanceof Map) {
    return [...value].flat();
  }
  if (value instanceof Set || Array.isArray(value)) {
    return [...value];
  }
  return Object.entries(value).flat();
}

/**
 * About how many bytes a value takes in the page state. The state is code
 * that seroval writes, which this follows closely enough to compare values.
 */
export function measureSize(value: unknown, seen: Set<object> = new Set()): number {
  if (value === null || value === undefined) {
    return 6;
  }
  switch (typeof value) {
    case 'string':
      return value.length + 2;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value).length;
    case 'function':
      // A reference to client code: its ID and its scope.
      return 24;
    case 'object': {
      if (seen.has(value)) {
        // A reference to a value that is in the state already.
        return 6;
      }
      seen.add(value);
      if (value instanceof Date) {
        return 30;
      }
      const entries = listEntries(value);
      let bytes = 2;
      for (const entry of entries) {
        bytes += measureSize(entry, seen) + 1;
      }
      return bytes;
    }
    default:
      return 8;
  }
}

/** The bytes of the state records of the page. */
export function stateBytes(): number {
  let bytes = 0;
  for (const script of document.querySelectorAll('script[b-state]')) {
    bytes += script.textContent?.length ?? 0;
  }
  return bytes;
}

/** A label cut to the width of a node of the graph. */
export function clip(text: string): string {
  return text.length > 34 ? `${text.slice(0, 33)}…` : text;
}
