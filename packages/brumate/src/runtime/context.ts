/** A value that a component provides to the components inside it. */
export interface Context<T> {
  /** The same on the server and the client, so the page state can name the context. */
  readonly key: string;
  /** The value of a component that reads the context without a provider above it. */
  readonly defaultValue: T;
}

/**
 * Creates a context. `key` names it in the page state, so it must be unique
 * in the app and the same on the server and the client.
 */
export function createContext<T>(key: string, defaultValue: T): Context<T> {
  return { key, defaultValue };
}
