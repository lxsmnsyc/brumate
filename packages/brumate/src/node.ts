// Node built-ins that the compiler uses only for some features, loaded when
// they are needed, so the compiler also runs in a browser.

import type * as NodeModule from 'node:module';
import type * as NodePath from 'node:path';
import type * as NodeURL from 'node:url';
import type * as NodeZlib from 'node:zlib';

interface Builtins {
  'node:module': typeof NodeModule;
  'node:path': typeof NodePath;
  'node:url': typeof NodeURL;
  'node:zlib': typeof NodeZlib;
}

/** Returns a Node built-in, or undefined outside Node. */
export function builtin<K extends keyof Builtins>(name: K): Builtins[K] | undefined {
  const process = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } })
    .process;
  return process?.getBuiltinModule?.(name) as Builtins[K] | undefined;
}
