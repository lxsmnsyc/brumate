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

/** Templates that render from HTML: their top element is `<a>`, `<title>`, `<style>` or `<script>`, which HTML and SVG both have, so the insert parses them where they go. */
const RAW_TEMPLATES = new Set(['tplSvgLink.brm:lnk']);

/**
 * Every `r` and `n` function of the pages in `render/` that the browser calls for a body clones a
 * template, also with `<template>` elements and markers in it. A body that gives an HTML string
 * fails the test: fix the markup that keeps it from cloning. `#template` functions are not
 * counted here, and they return `$$b.rawNodes`, as a `#template` function does.
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
    const { client, parts, render } = compile(source, {
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
    // A `#template` function returns its clone, not its HTML, in the render module too.
    for (const code of [client, render, ...Object.values(parts)]) {
      for (const match of code.matchAll(/^\s+return \$\$b\.raw\(.*$/gm)) {
        const names = [...code.slice(0, match.index).matchAll(/function ([\w$]+?)\$?\(/g)];
        const template = names.at(-1)?.[1];
        if (!RAW_TEMPLATES.has(`${name}:${template}`)) {
          found.push(`${name}:template ${template} ${match[0].trim()}`);
        }
      }
    }
  }
  expect(bodies).toBeGreaterThan(200);
  expect(found.sort()).toEqual([]);
}, 60000);

/**
 * The constants of templates that update code defines are shared by a key of their code, so an
 * edit of a template in development does not find the constant of the old markup.
 */
it('keys the shared constants of templates by their code', () => {
  const name = 'gapTemplate.brm';
  const source = readFileSync(join(input, name), 'utf8');
  function keys(text: string): string[] {
    const { client, parts } = compile(text, {
      filename: name,
      path: join(input, name),
      resolveModule: (specifier, importer) =>
        specifier === 'brumate/forms' ? forms : resolveFromDisk(specifier, importer),
    });
    const found: string[] = [];
    for (const code of [client, ...Object.values(parts)]) {
      for (const match of code.matchAll(/\$\$b\.shared\("([^"]+)"/g)) {
        found.push(match[1]!);
      }
    }
    return found;
  }
  const before = keys(source);
  const after = keys(source.replace('{label}', '<b>{label}</b>'));
  expect(before.length).toBeGreaterThan(0);
  expect(after).toHaveLength(before.length);
  expect(after).not.toEqual(before);
  expect(keys(source)).toEqual(before);
});
