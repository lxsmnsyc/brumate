// `brumate/serial`: plugins for values of the app, such as a class, so the
// page state and server function calls can hold them. An entry of the app,
// `src/serial.ts`, exports them as `plugins`. This module has no code of
// seroval, so the browser loads it with the entry and nothing more.

/**
 * How a value of the app becomes data that brumate can send, and back.
 * `data` can hold anything that brumate sends, such as numbers, strings,
 * arrays, plain objects and dates.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- The data of a plugin is any value that brumate sends.
export interface ValuePlugin<T = any, D = any> {
  /** A name of the plugin that no other plugin has, such as `app/money`. */
  tag: string;
  /** True for a value of the plugin, such as `value instanceof Money`. */
  test: (value: unknown) => boolean;
  /** The data of a value, such as `[money.amount, money.currency]`. */
  toData: (value: T) => D;
  /** Makes the value again from its data, in the browser or on the server. */
  fromData: (data: D) => T;
}

/**
 * Makes a plugin for a value of the app. Export it from the entry,
 * `src/serial.ts`, in `plugins`:
 *
 * ```ts
 * export const plugins = [
 *   definePlugin({
 *     tag: 'app/money',
 *     test: (value) => value instanceof Money,
 *     toData: (money: Money) => [money.amount, money.currency],
 *     fromData: ([amount, currency]) => new Money(amount, currency),
 *   }),
 * ];
 * ```
 */
export function definePlugin<T, D>(plugin: ValuePlugin<T, D>): ValuePlugin<T, D> {
  if (!plugin.tag || plugin.tag.startsWith('brumate/')) {
    throw new Error(
      `A plugin needs a tag of its own, such as 'app/money', and "${plugin.tag}" is not one`,
    );
  }
  return plugin;
}

/** The exports of the serial entry, `src/serial.ts`. Each is optional. */
export interface SerialEntry {
  /** Plugins for values of the app, which `definePlugin` makes. */
  plugins?: readonly ValuePlugin[];
  /**
   * The features of seroval that are off, as its `Feature` flags. Brumate
   * turns off `ErrorPrototypeStack` and `RegExp`, and warns when the entry
   * turns one of them on.
   */
  disabledFeatures?: number;
  /** How deep a value can be. Deeper values throw instead of being sent. */
  depthLimit?: number;
}

/**
 * The values that plugins of the app send, for the type checker. Add each
 * class to it, so a signal or memo can hold one:
 *
 * ```ts
 * declare module 'brumate/serial' {
 *   interface SendableValues {
 *     money: Money;
 *   }
 * }
 * ```
 */
// oxlint-disable-next-line typescript/no-empty-interface -- Apps add to it with declaration merging.
export interface SendableValues {}

/** A value that a plugin of the app sends. */
export type AppValue = SendableValues[keyof SendableValues];
