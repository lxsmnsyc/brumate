import { fromJSON, toJSONAsync } from 'seroval';
import { plugins } from './shared.ts';

/**
 * Calls a server function. It is a separate module, so pages that never call
 * one never load seroval's serializer.
 */
export async function call(prefix: string, id: string, args: unknown[]): Promise<unknown> {
  const response = await fetch(`${prefix}/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(await toJSONAsync(args, { plugins })),
  });
  if (!response.ok) {
    throw new Error(`Server function "${id}" failed with status ${response.status}`);
  }
  return fromJSON(await response.json(), { plugins });
}
