// `brumate/stream`: a list that grows as a stream sends its values, such as
// the reply of a language model, search results or log lines. A memo of it
// gives the list so far, so `#for` renders each item as it arrives.

export interface GatherOptions<T> {
  /**
   * The key of an item. A value with a key that the stream sent before
   * takes the place of that item, so a stream can update an item in place.
   */
  key?: (item: T) => unknown;
}

/**
 * Gathers the values of a stream into a list, and gives the list so far
 * after each one, starting with an empty list:
 *
 * ```ts
 * const tokens = $memo(gather(reply(prompt)));
 * ```
 *
 * - The memo starts again with an empty list when the stream changes, such
 *   as for a new prompt, and stops reading the older stream.
 * - The empty list comes before the stream is read, so the server, which
 *   renders the first value of a memo, renders it without starting the
 *   stream. The list fills in the browser, when the memo runs there.
 */
export async function* gather<T>(
  stream: AsyncIterable<T> | PromiseLike<AsyncIterable<T>>,
  options: GatherOptions<T> = {},
): AsyncGenerator<T[], void, undefined> {
  yield [];
  const items: T[] = [];
  const places = new Map<unknown, number>();
  for await (const item of await stream) {
    const key = options.key?.(item);
    const place = options.key ? places.get(key) : undefined;
    if (place === undefined) {
      if (options.key) {
        places.set(key, items.length);
      }
      items.push(item);
    } else {
      items[place] = item;
    }
    // A new array, so the memo sees a new value.
    yield [...items];
  }
}
