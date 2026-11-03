interface Entry {
  name: string;
  settled: boolean;
  done: (value: string) => void;
  fail: (error: Error) => void;
}

/** The test settles the promises of the page from `window.gates`. */
export interface Gates {
  /** The promises of `name` that have not settled. */
  pending: (name: string) => number;
  /** Resolves the pending promises of `name`. */
  settle: (name: string, value: string) => void;
  /** Rejects the pending promises of `name`. */
  reject: (name: string, message: string) => void;
}

const all: Entry[] = [];

function countPending(name: string): number {
  let total = 0;
  for (const entry of all) {
    if (entry.name === name && !entry.settled) {
      total++;
    }
  }
  return total;
}

const registry: Gates = {
  pending: countPending,
  settle(name, value) {
    for (const entry of all) {
      if (entry.name === name && !entry.settled) {
        entry.settled = true;
        entry.done(value);
      }
    }
  },
  reject(name, message) {
    for (const entry of all) {
      if (entry.name === name && !entry.settled) {
        entry.settled = true;
        entry.fail(new Error(message));
      }
    }
  },
};

(globalThis as { gates?: Gates }).gates = registry;

/** A promise that stays pending until the test settles `name`. */
export function gate(name: string): Promise<string> {
  return new Promise((done, fail) => {
    all.push({ name, settled: false, done, fail });
  });
}
