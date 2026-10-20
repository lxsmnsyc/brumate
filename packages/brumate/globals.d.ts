// The compile-time functions of .brm files. The compiler replaces every call,
// so they need no import and have no runtime code.

declare global {
  /** Returns the props of the component. Destructure the call to keep each prop reactive. */
  function $props<T = Record<string, any>>(): T;

  /** Declares writable state. The variable reads and writes the signal. */
  function $signal<T>(value: T): T;
  function $signal<T>(): T | undefined;

  /** Declares a value computed from other values. A promise is awaited where it is read. */
  function $memo<T>(value: T): Awaited<T>;

  /** Runs a callback when the values it reads change, after the page resumes. Never on load. */
  function $effect(callback: () => void | (() => void)): void;

  /** Runs a callback in the browser when a trigger fires. */
  function $client(
    callback: () => void | (() => void),
    trigger?: 'visible' | 'idle' | 'load',
  ): void;

  /** Reads a value without depending on it. */
  function $untrack<T>(value: T): T;

  /** Changes an object or an array in a signal through a draft, and writes the signal with the result. */
  function $produce<T>(signal: T, recipe: (draft: T) => T | void): void;
}

export {};
