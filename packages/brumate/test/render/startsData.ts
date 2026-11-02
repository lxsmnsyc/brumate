// Loads that a test settles by hand, for the start points of awaited memos on the server.
const opens = new Map<
  string,
  { resolve: (value: string) => void; reject: (error: Error) => void }
>();

/** The loads and the statements that ran so far, in order. */
export const calls: string[] = [];

/** How many loads are in flight now, and the most at once. */
export const flight = { active: 0, peak: 0 };

export function reset(): void {
  opens.clear();
  calls.length = 0;
  flight.active = 0;
  flight.peak = 0;
}

export function load(key: string): Promise<string> {
  calls.push(key);
  flight.active++;
  flight.peak = Math.max(flight.peak, flight.active);
  return new Promise<string>((resolve, reject) => {
    opens.set(key, { resolve, reject });
  }).finally(() => {
    flight.active--;
  });
}

export function release(key: string, value: string): void {
  opens.get(key)!.resolve(value);
}

export function fail(key: string, error: Error): void {
  opens.get(key)!.reject(error);
}

/** A statement of the script, which the test sees run. */
export function note(name: string): void {
  calls.push(name);
}

/** A compute that throws before it returns a load. */
export function explode(): Promise<string> {
  calls.push('explode');
  throw new Error('boom');
}
