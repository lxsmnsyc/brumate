// Environment variables, checked with a schema when the server starts. The
// app declares them in one file, `src/env.ts`, split into server and public
// values. Server values never reach the browser: the Vite plugin gives the
// browser a copy of the file without them.

import { addSecret } from './secrets.ts';
import type { StandardSchemaV1 } from './standard-schema.ts';

/** A schema for each variable, by name. */
export type EnvSchemas = Record<string, StandardSchemaV1>;

export interface EnvSchema {
  /** Variables that only the server reads, such as secrets. */
  server?: EnvSchemas;
  /** Variables that the browser reads too. The client build has their values. */
  public?: EnvSchemas;
}

/** The output of each schema of a group, by name. */
type Outputs<S extends EnvSchemas | undefined> = S extends EnvSchemas
  ? { readonly [K in keyof S]: StandardSchemaV1.InferOutput<S[K]> }
  : // oxlint-disable-next-line typescript/no-empty-object-type -- No variables add no fields.
    {};

/** The values of the variables that a schema declares. */
export type Env<S extends EnvSchema> = Outputs<S['server']> & Outputs<S['public']>;

export interface EnvOptions {
  /**
   * Where the values come from. Defaults to `process.env`. The client
   * build passes the values of the public variables, read when it ran.
   */
  source?: Record<string, string | undefined>;
}

/**
 * Checks the environment variables of the app, and returns their values
 * with their types:
 *
 * ```ts
 * // src/env.ts
 * import { defineEnv } from 'brumate/env';
 * import * as v from 'valibot';
 *
 * export default defineEnv({
 *   server: { DATABASE_URL: v.pipe(v.string(), v.url()) },
 *   public: { SITE_NAME: v.optional(v.string(), 'Tracker') },
 * });
 * ```
 *
 * Every variable is checked when the file loads, so a server that starts
 * without a secret fails at once, with every missing or wrong variable in
 * the message. A schema must validate without waiting.
 */
export function defineEnv<const S extends EnvSchema>(schema: S, options: EnvOptions = {}): Env<S> {
  const source = options.source ?? processEnv();
  const values: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const [group, isServer] of [
    [schema.server, true],
    [schema.public, false],
  ] as const) {
    for (const [name, variable] of Object.entries(group ?? {})) {
      const props = variable['~standard'];
      if (props?.version !== 1 || typeof props.validate !== 'function') {
        throw new TypeError(`The schema of ${name} is not a Standard Schema of version 1`);
      }
      const input = source[name];
      const result = props.validate(input);
      if (result instanceof Promise) {
        throw new TypeError(
          `The schema of ${name} validates asynchronously. Use one that does not wait`,
        );
      }
      if (result.issues) {
        problems.push(
          input === undefined
            ? `${name} is missing`
            : `${name} is invalid${isServer ? issuePaths(result.issues) : `: ${issueMessages(result.issues)}`}`,
        );
        continue;
      }
      values[name] = result.value;
      if (isServer) {
        addSecret(input);
        addSecret(result.value);
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`Environment variables: ${problems.join('. ')}`);
  }
  return Object.freeze(values) as Env<S>;
}

/** The messages of the issues of a variable, joined. */
function issueMessages(issues: readonly StandardSchemaV1.Issue[]): string {
  const messages: string[] = [];
  for (const issue of issues) {
    messages.push(issue.message);
  }
  return messages.join('; ');
}

/**
 * Where the issues of a server variable are, such as ` at port`. The
 * messages of some schema libraries hold the value, which is a secret, so
 * the error leaves them out.
 */
function issuePaths(issues: readonly StandardSchemaV1.Issue[]): string {
  const paths: string[] = [];
  for (const issue of issues) {
    const keys: string[] = [];
    for (const segment of issue.path ?? []) {
      keys.push(String(typeof segment === 'object' ? segment.key : segment));
    }
    const path = keys.join('.');
    if (path !== '') {
      paths.push(path);
    }
  }
  return paths.length > 0 ? ` at ${paths.join(', ')}` : '';
}

/** The variables of the process, where there is one. */
function processEnv(): Record<string, string | undefined> {
  const process = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  return process?.env ?? {};
}
