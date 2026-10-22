// The values of the server environment variables, which `defineEnv` keeps
// when the server starts. The server refuses to send a page whose state
// holds one, so a secret that a helper reads cannot reach the browser.

const SECRETS = Symbol.for('brumate.secrets');

/**
 * The values of the server variables. The server refuses to send a page
 * whose state holds one. They live on `globalThis`, so a second copy of
 * this module, such as one that Vite loads, shares them.
 */
export function serverSecrets(): Set<string> {
  const store = globalThis as { [SECRETS]?: Set<string> };
  return (store[SECRETS] ??= new Set());
}

/**
 * Keeps the value of a server variable, as it came and as its schema gave
 * it. A value under 8 characters is not kept, because a page can hold the
 * same text for another reason, such as `true` or `3000`.
 */
export function addSecret(value: unknown): void {
  if (typeof value === 'string' && value.length >= 8) {
    serverSecrets().add(value);
  }
}
