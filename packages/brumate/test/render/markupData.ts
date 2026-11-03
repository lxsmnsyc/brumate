/** A promise of markup that has not settled, which a test settles. */
export interface MarkupLoad {
  key: string;
  done: (value: unknown) => void;
  fail: (error: Error) => void;
}

/** A promise that the test settles. The list keeps each call, so a test counts them. */
export function markupLoad(key: string): Promise<any> {
  const loads = ((globalThis as { markupLoads?: MarkupLoad[] }).markupLoads ??= []);
  return new Promise((done, fail) => {
    loads.push({ key, done, fail });
  });
}

/** A promise of `value` that settles after `ms`. */
export function markupLater<T>(value: T, ms = 10): Promise<T> {
  return new Promise((done) => setTimeout(() => done(value), ms));
}

/** A promise that rejects after a few milliseconds. */
export function markupFail(): Promise<string> {
  return new Promise((_done, reject) => setTimeout(() => reject(new Error('markup failed')), 10));
}

/** A promise of `value` that counts its calls in `markupCalls`. */
export function markupCounted(value: string): Promise<string> {
  ((globalThis as { markupCalls?: string[] }).markupCalls ??= []).push(value);
  return Promise.resolve(value);
}
