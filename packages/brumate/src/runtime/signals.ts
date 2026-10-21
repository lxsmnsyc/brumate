// The compile-time functions of `.brm` files. The compiler replaces every
// call and removes the import, so this module only gives them their types.
// A call outside a `.brm` file throws.

import type { Context } from './context.ts';

function compileTimeOnly(name: string): never {
  throw new Error(`${name} works only in .brm files, which the brumate compiler compiles`);
}

/** Returns the props of the component. Destructure the call to keep each prop reactive. */
// oxlint-disable-next-line typescript/no-explicit-any -- Props are any object unless typed.
export function $props<T = Record<string, any>>(): T {
  return compileTimeOnly('$props');
}

/** Declares writable state. The variable reads and writes the signal. */
export function $signal<T>(value: T): T;
export function $signal<T>(): T | undefined;
export function $signal(): never {
  return compileTimeOnly('$signal');
}

/** The value of a memo: what a promise settles to, or the latest value of an async iterable. */
export type MemoValue<T> = Awaited<T> extends AsyncIterable<infer U> ? U : Awaited<T>;

/**
 * Declares a value computed from other values. A promise is awaited where it
 * is read. An async iterable gives each of its values in turn.
 */
export function $memo<T>(_value: T): MemoValue<T> {
  return compileTimeOnly('$memo');
}

/**
 * Declares a value that follows a memo, and that handlers can write. A write
 * shows a guess, such as a new item while the form that adds it posts. The
 * value goes back to the memo when the memo changes, or when the server
 * calls of the page finish, such as after a failed post.
 */
export function $optimistic<T>(_source: T): T {
  return compileTimeOnly('$optimistic');
}

/** Runs a callback when the values it reads change, after the page resumes. Never on load. */
export function $effect(_callback: () => void | (() => void)): void {
  compileTimeOnly('$effect');
}

/** Runs a callback in the browser when a trigger fires. */
export function $client(
  _callback: () => void | (() => void),
  _trigger?: 'visible' | 'idle' | 'load',
): void {
  compileTimeOnly('$client');
}

/** Reads a value without depending on it. */
export function $untrack<T>(_value: T): T {
  return compileTimeOnly('$untrack');
}

/** True while a new value of a memo, or of a memo it reads, loads on the client. Always false on the server. */
export function $isPending(_memo: unknown): boolean {
  return compileTimeOnly('$isPending');
}

/** Returns an ID that is unique in the page and the same on the server and the client. */
export function $id(): string {
  return compileTimeOnly('$id');
}

/** Provides a value of a context to the components inside this one. */
export function $provide<T>(_context: Context<T>, _value: T): void {
  compileTimeOnly('$provide');
}

/** Reads a context from the nearest component above that provides it, or its default value. */
export function $context<T>(_context: Context<T>): T {
  return compileTimeOnly('$context');
}

/** Changes an object or an array in a signal through a draft, and writes the signal with the result. */
export function $produce<T>(_signal: T, _recipe: (draft: T) => T | void): void {
  compileTimeOnly('$produce');
}

/** Sets the title of the page. The last component that sets it wins. */
export function $title(_value: unknown): void {
  compileTimeOnly('$title');
}

/**
 * The latest result of a server function that a form of this component posts
 * to, or undefined before the first post. Pending while the form sends.
 */
export function $action<F extends (...args: never[]) => unknown>(
  _fn: F,
): Awaited<ReturnType<F>> | undefined {
  return compileTimeOnly('$action');
}
