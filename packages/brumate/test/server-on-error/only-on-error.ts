export const seen: unknown[] = [];

export function onError(error: unknown): void {
  seen.push(error);
}
