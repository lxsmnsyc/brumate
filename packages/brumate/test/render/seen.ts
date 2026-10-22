/** The names that components render, for tests that check which components rendered. */
export const seen: string[] = [];

export function see(name: string): string {
  seen.push(name);
  return name;
}
