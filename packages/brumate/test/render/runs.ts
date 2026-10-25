/** What memos and bindings computed in the browser, for tests that check how often updates run. */
export function ran(name: string, value: string): string {
  const runs = ((globalThis as { runs?: string[] }).runs ??= []);
  runs.push(`${name} ${value}`);
  return value;
}
