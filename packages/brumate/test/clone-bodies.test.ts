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
 * The render functions of the bodies that the browser renders and that still give an HTML
 * string, as `page:function`. Every other `r` and `n` function of the pages in `render/`
 * clones a template, also with `<template>` elements and markers in it. What keeps a body on
 * this list: a `#try` that renders in place between its markers, a `#for` with a window, an
 * `#offscreen` block, or a wait in its script. A body that clones leaves this list; one that
 * cannot must not join it. `#template` functions and children closures are not counted.
 */
const HTML_BODIES = new Set<string>([
  'awaitInline.brm:r2',
  'cloneTemplate.brm:r2',
  'clonedForeignTry.brm:r2',
  'cloneTry.brm:r2',
  'fields.brm:r2',
  'offscreen.brm:r2',
  'offscreen.brm:r7',
  'offscreenInChildren.brm:n0',
  'streamedCatchNested.brm:r2',
  'tryInChildren.brm:n0',
  'tryTemplateIf.brm:r3',
  'tryTemplateNested.brm:r3',
  'tryTemplatePropIf.brm:r3',
  'tryWait.brm:r2',
  'tryWaitKidHost.brm:r2',
  'tryWaitLoading.brm:r2',
  'tryWaitNested.brm:r2',
  'tryWaitRows.brm:r2',
  'windowedChildren.brm:n0',
  'windowedNested.brm:r2',
]);

it('renders every body of the pages as a clone, but the ones that are listed', () => {
  const sources = new Map<string, string>();
  for (const name of readdirSync(input)) {
    if (name.endsWith('.brm')) {
      sources.set(name, readFileSync(join(input, name), 'utf8'));
    }
  }
  const liveProps = analyzeProject(sources);
  const found = new Set<string>();
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
          found.add(`${name}:${match[1]}`);
        }
      }
    }
  }
  expect(bodies).toBeGreaterThan(200);
  expect([...found].sort()).toEqual([...HTML_BODIES].sort());
}, 60000);
