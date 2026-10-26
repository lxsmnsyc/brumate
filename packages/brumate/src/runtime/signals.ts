// The compile-time functions of `.brm` files. The compiler replaces every
// call and removes the import, so this module only gives them their types.
// A call outside a `.brm` file throws.

import type { Context, NavigationState, Route } from './context.ts';
import type { RoutePath, RouteParams } from './routes.ts';

function compileTimeOnly(name: string): never {
  throw new Error(`${name} works only in .brm files, which the brumate compiler compiles`);
}

declare const BINDABLE: unique symbol;
declare const WRITES: unique symbol;

/** The mark of a prop that a parent can bind. It has no value at runtime. */
export interface BindableMark<T> {
  readonly [BINDABLE]: T;
}

/**
 * What a binding writes. A binding of a signal of `T` takes a prop that writes `W` when `W` is
 * assignable to `T`, as a signal of `HTMLElement | undefined` takes the ref of a `div`.
 */
export interface WritableMark<W> {
  readonly [WRITES]: (value: W) => void;
}

/** What `$bind` returns: the mark of a prop, and the write side that checks the type of a ref. */
// oxlint-disable-next-line typescript/no-empty-object-type, typescript/no-empty-interface -- An interface keeps its name in messages.
export interface BoundSignal<T> extends BindableMark<T>, WritableMark<T> {}

/**
 * Marks a prop that a parent can bind with `$bind`, such as
 * `open?: Bindable<boolean>`. The parent passes `T` or `$bind(name)`.
 * Inside the component, `$props<T>()` gives `T`.
 */
export type Bindable<T> = T | BindableMark<T>;

/** The props as the component reads them, with `Bindable<T>` as `T`. */
export type Unbound<T> = { [K in keyof T]: Exclude<T[K], BindableMark<unknown>> };

/**
 * Returns the props of the component. Destructure the call to keep each prop
 * reactive. Destructure it with `let` to write props, such as
 * `let { open = false } = $props()`.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- Props are any object unless typed.
export function $props<T = Record<string, any>>(): Unbound<T> {
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
 * Declares a memo that takes the value once it stops changing for `ms`
 * milliseconds, such as a search query while the user types. On the server,
 * and until the value first changes, it is the value.
 */
export function $debounced<T>(_value: T, _ms: number): MemoValue<T> {
  return compileTimeOnly('$debounced');
}

/**
 * Declares a memo that takes the value at most once every `ms`
 * milliseconds, and the last value after the wait, such as a position while
 * the pointer moves. On the server, and until the value first changes, it is the value.
 */
export function $throttled<T>(_value: T, _ms: number): MemoValue<T> {
  return compileTimeOnly('$throttled');
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

/**
 * True when the parent passed a prop with `$bind`, so a write of it reaches the parent. The prop is
 * one that the component destructures with `let`. Always false on the server, where nothing writes.
 */
export function $isBound(_prop: unknown): boolean {
  return compileTimeOnly('$isBound');
}

/**
 * True when the caller passed the prop, even as `undefined`. A part uses it to tell a controlled
 * value, such as `value=(null)`, from no value. Declare it with `const` in the component script.
 */
export function $isPassed(_prop: unknown): boolean {
  return compileTimeOnly('$isPassed');
}

/** Returns an ID that is unique in the page and the same on the server and the client. */
export function $id(): string {
  return compileTimeOnly('$id');
}

/** Provides a value of a context to the components inside this one. */
export function $setContext<T>(_context: Context<T>, _value: T): void {
  compileTimeOnly('$setContext');
}

/** Reads a context from the nearest component above that provides it, or its default value. */
export function $getContext<T>(_context: Context<T>): T {
  return compileTimeOnly('$getContext');
}

/**
 * The route of the page: its URL, its query string and its params, typed
 * from the route files as `href` is. The server reads the request, and the
 * browser reads `location`. It changes when navigation changes the URL.
 */
export function $route<P extends RoutePath = RoutePath>(_path?: P): Route<RouteParams<P>> {
  return compileTimeOnly('$route');
}

/** The navigation that loads, with `pending` false when none does. Always `{ pending: false }` on the server. */
export function $navigation(): NavigationState {
  return compileTimeOnly('$navigation');
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

/**
 * Passes a child a signal, or a prop that the component writes, so a write
 * of the prop in the child writes it. The child destructures the prop with
 * `let`. Pass it as the value of a prop: `<Dialog open=$bind(open) />`.
 *
 * - Only a prop of type `Bindable<T>` takes it.
 * - With `set`, a write calls `set(next)` in place of writing the signal.
 */
export function $bind<T>(signal: T, set?: (next: T) => unknown): BoundSignal<T>;
export function $bind(): never {
  return compileTimeOnly('$bind');
}

/**
 * Marks a function that a script makes as an event handler, so a spread can
 * pass it on, as it passes on a handler that a caller writes in markup.
 * `args` are JSON values that go with the handler, and it runs as
 * `fn(...args, event)`.
 */
export function $handler<A extends unknown[], E = Event>(
  fn: (...args: [...A, E]) => unknown,
  ...args: A
): (event: E) => unknown;
/** A function that does not read the event. */
export function $handler<A extends unknown[]>(
  fn: (...args: A) => unknown,
  ...args: A
): (event: Event) => unknown;
export function $handler(): never {
  return compileTimeOnly('$handler');
}
