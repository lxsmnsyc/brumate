// `AsyncLocalStorage` for the server runtime of the live samples, which runs
// in the browser. It keeps one value at a time, which is enough for samples
// that render one after another.

export class AsyncLocalStorage<T> {
  private value: T | undefined;

  getStore(): T | undefined {
    return this.value;
  }

  run<R>(value: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R {
    const previous = this.value;
    this.value = value;
    let result: R;
    try {
      result = callback(...args);
    } catch (error) {
      this.value = previous;
      throw error;
    }
    if (result instanceof Promise) {
      return result.finally(() => {
        this.value = previous;
      }) as R;
    }
    this.value = previous;
    return result;
  }
}
