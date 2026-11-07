// Every context is static, so a part gives a changing value through a store. The compiler refuses
// a context value that reads a changing name (BRM196), and no compiled part updates a context.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'brumate';
import { expect, it } from 'vitest';

/** The `.brm` parts of the library. */
function partNames(): string[] {
  const names: string[] = [];
  for (const file of readdirSync(join(import.meta.dirname, '../src'))) {
    if (file.endsWith('.brm')) {
      names.push(file.slice(0, -'.brm'.length));
    }
  }
  return names;
}

function compilePart(name: string): ReturnType<typeof compile> {
  const path = join(import.meta.dirname, `../src/${name}.brm`);
  return compile(readFileSync(path, 'utf8'), { filename: `${name}.brm`, path });
}

it('compiles every part with no context value that reads a changing name', () => {
  const found: string[] = [];
  let compiled = 0;
  for (const name of partNames()) {
    try {
      compilePart(name);
    } catch (error) {
      found.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
    compiled++;
  }
  expect(compiled).toBeGreaterThan(100);
  expect(found).toEqual([]);
});

it('compiles no part with code that updates a context', () => {
  const found: string[] = [];
  let providers = 0;
  for (const name of partNames()) {
    const { parts, client, server } = compilePart(name);
    const text = [client, ...Object.values(parts)].join('\n');
    if (text.includes('updateContext')) {
      found.push(name);
    }
    if (server.includes('.provide(')) {
      providers++;
    }
  }
  expect(found).toEqual([]);
  // A scan that finds few providers is broken.
  expect(providers).toBeGreaterThan(40);
});
