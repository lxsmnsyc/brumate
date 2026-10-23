// The file of environment variables, `src/env.ts`, which calls `defineEnv`
// from `brumate/env` with the schemas of the server and the public
// variables. The compiler reads which variables are server values, and the
// Vite plugin writes the copy of the file that the browser gets: without the
// server schemas, and with the values of the public variables.

import { parseSync } from 'oxc-parser';
import type { oxc } from './oxc.ts';

/** The name of the function that declares the variables. */
const DEFINE = 'defineEnv';

export interface EnvFile {
  /** The names of the server variables. */
  server: string[];
  /** The names of the public variables. */
  public: string[];
  /** The range of the `server: { … }` property, with its comma, or undefined without one. */
  serverRange?: { start: number; end: number };
  /** The end of the first argument of `defineEnv`, where the options go. */
  schemaEnd: number;
  /** True if the call has options already. */
  hasOptions: boolean;
}

/** The names of the properties of an object literal. Other keys throw. */
function keysOf(node: oxc.Node, group: string, filename: string): string[] {
  if (node.type !== 'ObjectExpression') {
    throw new Error(
      `The ${group} variables of ${filename} must be an object literal, so the compiler can read their names`,
    );
  }
  return node.properties.map((property) => {
    if (property.type === 'Property' && !property.computed) {
      return property.key.type === 'Identifier'
        ? property.key.name
        : String((property.key as { value?: unknown }).value);
    }
    throw new Error(
      `The ${group} variables of ${filename} must be plain properties, so the compiler can read their names`,
    );
  });
}

/** Finds the `defineEnv` call of the file. */
function findCall(program: oxc.Program): oxc.CallExpression | undefined {
  let found: oxc.CallExpression | undefined;
  const visit = (node: unknown): void => {
    if (found || typeof node !== 'object' || node === null) {
      return;
    }
    const value = node as oxc.Node & { callee?: oxc.Node & { name?: string } };
    if (value.type === 'CallExpression' && value.callee?.name === DEFINE) {
      found = value as oxc.CallExpression;
      return;
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) {
        child.forEach(visit);
      } else if (typeof child === 'object') {
        visit(child);
      }
    }
  };
  visit(program);
  return found;
}

/**
 * Reads the variables that a file of environment variables declares. The
 * schemas are written in the call, as object literals, so their names can
 * be read without running the file.
 */
export function parseEnvFile(source: string, filename: string): EnvFile {
  const { program, errors } = parseSync(filename, source, { lang: 'ts' });
  if (errors[0]) {
    throw new Error(`${errors[0].message} (${filename})`);
  }
  const call = findCall(program);
  const schema = call?.arguments[0];
  if (!call || schema?.type !== 'ObjectExpression') {
    throw new Error(
      `${filename} must call ${DEFINE} with an object literal of server and public variables`,
    );
  }
  const result: EnvFile = {
    server: [],
    public: [],
    schemaEnd: schema.end,
    hasOptions: call.arguments.length > 1,
  };
  schema.properties.forEach((property, index) => {
    if (property.type !== 'Property' || property.computed || property.key.type !== 'Identifier') {
      throw new Error(`${DEFINE} in ${filename} takes server and public variables only`);
    }
    const group = property.key.name;
    if (group !== 'server' && group !== 'public') {
      throw new Error(`${DEFINE} in ${filename} takes server and public variables, not ${group}`);
    }
    result[group] = keysOf(property.value, group, filename);
    if (group === 'server') {
      // The property with its comma, so the browser's copy stays valid code.
      const next = schema.properties[index + 1];
      const comma = source.indexOf(',', property.end);
      let end = property.end;
      if (next) {
        end = next.start;
      } else if (comma !== -1 && comma < schema.end) {
        end = comma + 1;
      }
      result.serverRange = { start: property.start, end };
    }
  });
  return result;
}

/**
 * The copy of the file that the browser gets: the server schemas are gone,
 * and the values of the public variables, read when the build or the dev
 * server ran, are the source of the call. The public schemas check them in
 * the browser, as the server's do on the server.
 */
export function clientEnvModule(
  source: string,
  filename: string,
  values: Record<string, string | undefined>,
): string {
  const file = parseEnvFile(source, filename);
  if (file.hasOptions) {
    throw new Error(
      `${DEFINE} in ${filename} takes no options, because the Vite plugin writes the values of the browser`,
    );
  }
  const given: Record<string, string> = {};
  for (const name of file.public) {
    const value = values[name];
    if (value !== undefined) {
      given[name] = value;
    }
  }
  const edits: { start: number; end: number; text: string }[] = [
    { start: file.schemaEnd, end: file.schemaEnd, text: `, { source: ${JSON.stringify(given)} }` },
  ];
  if (file.serverRange) {
    edits.push({ ...file.serverRange, text: '' });
  }
  let result = '';
  let position = 0;
  for (const edit of edits.toSorted((a, b) => a.start - b.start)) {
    result += source.slice(position, edit.start) + edit.text;
    position = edit.end;
  }
  return result + source.slice(position);
}
