/** Throws for 1, as the body of a template that fails. */
export function check(value: number): number {
  if (value === 1) {
    throw new Error('bad');
  }
  return value;
}
