// The compile-time functions of .brm files. The compiler replaces every call,
// so they need no import and have no runtime code.

/** Returns the props of the component. Destructure the call to keep each prop reactive. */
declare function $props<T = Record<string, any>>(): T;

/** Declares writable state. The variable reads and writes the signal. */
declare function $signal<T>(value: T): T;
declare function $signal<T>(): T | undefined;

/** Declares a value computed from other values. A promise is awaited where it is read. */
declare function $memo<T>(value: T): Awaited<T>;

/** Runs a callback when the values it reads change, after the page resumes. Never on load. */
declare function $effect(callback: () => void | (() => void)): void;

/** Runs a callback in the browser when a trigger fires. */
declare function $client(
  callback: () => void | (() => void),
  trigger?: 'visible' | 'idle' | 'load',
): void;

/** Reads a value without depending on it. */
declare function $untrack<T>(value: T): T;

/** Changes an object or an array in a signal through a draft, and writes the signal with the result. */
declare function $produce<T>(signal: T, recipe: (draft: T) => T | void): void;
