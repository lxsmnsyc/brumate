/** Throws at once, with the label in the message. */
export function bad(label: string): string {
  throw new Error(`Err ${label}`);
}
