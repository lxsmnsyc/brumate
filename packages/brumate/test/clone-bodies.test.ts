import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { analyzeProject, compile } from '../src/index.ts';
import { resolveFromDisk } from '../src/modules.ts';

const input = resolve(import.meta.dirname, 'render');
const forms = {
  path: join(input, 'forms.brm.ts'),
  source: readFileSync(resolve(import.meta.dirname, '../forms/forms.brm.ts'), 'utf8'),
};

/**
 * Every `r` and `n` function of the pages in `render/` that the browser calls for a body clones a
 * template, also with `<template>` elements and markers in it. A body that gives an HTML string
 * fails the test: fix the markup that keeps it from cloning. `#template` functions are not
 * counted, and they return a fragment.
 */
it('renders every body of the pages as a clone', () => {
  const sources = new Map<string, string>();
  for (const name of readdirSync(input)) {
    if (name.endsWith('.brm')) {
      sources.set(name, readFileSync(join(input, name), 'utf8'));
    }
  }
  const liveProps = analyzeProject(sources);
  const found: string[] = [];
  let bodies = 0;
  for (const [name, source] of sources) {
    const { client, parts } = compile(source, {
      filename: name,
      liveProps: liveProps.get(name),
      path: join(input, name),
      resolveModule: (specifier, importer) =>
        specifier === 'brumate/forms' ? forms : resolveFromDisk(specifier, importer),
      sendableClasses: ['Money'],
    });
    for (const code of [client, ...Object.values(parts)]) {
      // The functions that the core calls for a body: `r` for a block, `n` for children.
      for (const match of code.matchAll(/^export function ([rn]\d+)\(.*\{\n([\s\S]*?)^\}/gm)) {
        bodies++;
        if (/^ {2}return \$\$html;$/m.test(match[2]!)) {
          found.push(`${name}:${match[1]}`);
        }
      }
    }
  }
  expect(bodies).toBeGreaterThan(200);
  expect(found.sort()).toEqual([]);
}, 60000);
