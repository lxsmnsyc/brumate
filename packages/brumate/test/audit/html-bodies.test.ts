// client-audit: for each body that still gives an HTML string (test/clone-bodies.test.ts), the
// constructs in it that keep it on HTML.
// Run: AUDIT_OUT=<file> npx vitest run test/audit/html-bodies.test.ts
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { analyzeProject, compile } from '../../src/index.ts';
import { resolveFromDisk } from '../../src/modules.ts';

const input = resolve(import.meta.dirname, '../render');
const forms = {
  path: join(input, 'forms.brm.ts'),
  source: readFileSync(resolve(import.meta.dirname, '../../forms/forms.brm.ts'), 'utf8'),
};

it('lists the reasons of each HTML body', () => {
  const sources = new Map<string, string>();
  for (const name of readdirSync(input)) {
    if (name.endsWith('.brm')) {
      sources.set(name, readFileSync(join(input, name), 'utf8'));
    }
  }
  const liveProps = analyzeProject(sources);
  const rows: string[] = [];
  let templates = 0;
  let children = 0;
  for (const [name, source] of sources) {
    const { client, parts, render } = compile(source, {
      filename: name,
      liveProps: liveProps.get(name),
      path: join(input, name),
      resolveModule: (specifier, importer) =>
        specifier === 'brumate/forms' ? forms : resolveFromDisk(specifier, importer),
      sendableClasses: ['Money'],
    });
    for (const code of [client, render ?? '', ...Object.values(parts)]) {
      templates += [...code.matchAll(/\$\$b\.raw\(/g)].length;
      children += [...code.matchAll(/return \$\$html;\n\s*\}/g)].length;
      for (const match of code.matchAll(/^export function ([rn]\d+)\(.*\{\n([\s\S]*?)^\}/gm)) {
        const body = match[2]!;
        if (!/^ {2}return \$\$html;$/m.test(body)) {
          continue;
        }
        const reasons: string[] = [];
        if (/\$\$before\d+ = \$\$html/.test(body)) reasons.push('try-in-place');
        if (/windowList|windowStart/.test(body)) reasons.push('window');
        if (/offscreen/.test(body)) reasons.push('offscreen');
        if (/\$\$b\.wait\(|\bawait\b/.test(body)) reasons.push('wait');
        rows.push(`${name}:${match[1]} ${reasons.join(',') || '?'}`);
      }
    }
  }
  writeFileSync(
    process.env.AUDIT_OUT ?? '/dev/stdout',
    `${rows.length} bodies\n${rows.toSorted().join('\n')}\n$$b.raw calls ${templates}`,
  );
  expect(rows).toHaveLength(20);
});
