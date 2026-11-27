import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { getFeatures } from '../src/features.ts';
import { analyzeProject, compile } from '../src/index.ts';
import { resolveFromDisk } from '../src/modules.ts';

const input = resolve(import.meta.dirname, 'render');
const forms = {
  path: join(input, 'forms.brm.ts'),
  source: readFileSync(resolve(import.meta.dirname, '../forms/forms.brm.ts'), 'utf8'),
};

/** Templates that render from HTML: their top element is `<a>`, `<title>`, `<style>` or `<script>`, which HTML and SVG both have, so the insert parses them where they go. */
const RAW_TEMPLATES = new Set([
  'tplSvgLink.brm:lnk',
  'tplSvgMixed.brm:lnk',
  'tplAmbiguousInner.brm:lnk',
  'tplAmbiguousBox.brm:boxed',
  'tplChildrenParam.brm:lnk',
  'tplFunctionText.brm:boxed',
  'tplMarkText.brm:lnk',
  'tplSvgWrap.brm:lbl',
  'tplSvgWrap.brm:wrap',
]);

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
    // The marks of inserts that may hold nodes become a scope, or go with a clone.
    // The mark has the first number that the source does not hold.
    let number = 0;
    while (source.includes(`$$n${number}:`)) {
      number++;
    }
    for (const code of [client, render, ...Object.values(parts)]) {
      expect(code).not.toContain(`/*$$n${number}:`);
    }
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
 * A page turns `clientHTML` on only when one of its functions builds an HTML string, or a
 * template that renders from HTML holds a place for nodes. The body of a `#loading` that waits
 * clones: its markers are in the rest of the render, after the `await`.
 */
it('builds HTML in the browser only for templates that render from HTML', () => {
  const sources = new Map<string, string>();
  for (const name of readdirSync(input)) {
    if (name.endsWith('.brm')) {
      sources.set(name, readFileSync(join(input, name), 'utf8'));
    }
  }
  const liveProps = analyzeProject(sources);
  const found: string[] = [];
  for (const [name, source] of sources) {
    const result = compile(source, {
      filename: name,
      liveProps: liveProps.get(name),
      path: join(input, name),
      resolveModule: (specifier, importer) =>
        specifier === 'brumate/forms' ? forms : resolveFromDisk(specifier, importer),
      sendableClasses: ['Money'],
    });
    if (getFeatures(result).clientHTML) {
      found.push(name);
    }
  }
  // The templates with an ambiguous top element that hold places for what they insert build HTML,
  // and so do the components whose top element is ambiguous (`<a>`): with no owner, the place of
  // their markup is not known, so they render from HTML that the insert parses (0.9.1).
  expect(found).toEqual([
    'AsLink.brm',
    'ClonedAnchor.brm',
    'Forward.brm',
    'RestLink.brm',
    'SpikeLink.brm',
    'tagSpreadRest.brm',
    'tplAmbiguousBox.brm',
    'tplAmbiguousInner.brm',
    'tplChildrenParam.brm',
    'tplFunctionText.brm',
    'tplMarkText.brm',
    'tplSvgWrap.brm',
    'viewTransition.brm',
  ]);
}, 60000);

/** A `<title>` or a `<textarea>` that starts with a value keeps the markup before it in its template. */
it('keeps the markup of a template whose title starts with a value', () => {
  const name = 'tplLeadingValue.brm';
  const { client, parts, render } = compile(readFileSync(join(input, name), 'utf8'), {
    filename: name,
    path: join(input, name),
    resolveModule: resolveFromDisk,
  });
  const code = [client, render, ...Object.values(parts)].join('\n');
  expect(code).toContain('<title b-x=\\"1\\" b-t></title>');
  expect(code).toContain(
    '<textarea b-x=\\"0\\" class=\\"area\\" aria-label=\\"Notes\\"></textarea><p class=\\"z\\">z</p>',
  );
  expect(code).toContain('$$b.setText($$e[0], [(tail), " end"])');
});

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
