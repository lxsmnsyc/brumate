import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, expect, it } from 'vitest';

// The type of `items` reaches a `#template` in markup, typed or not. The check runs brumate-tsc on
// a copy of the fixture in a folder that the main typecheck skips (it starts with a dot).
const bin = resolve(process.cwd(), '../tsc/bin/brumate-tsc.js');
const folder = `${resolve(process.cwd(), 'test/.generics-markup')}/`;
const fixture = readFileSync(resolve(process.cwd(), 'test/fixtures/generics-markup.brm'), 'utf8');

function check(source: string): string[] {
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder);
  writeFileSync(
    `${folder}tsconfig.json`,
    JSON.stringify({ extends: '../../tsconfig.json', include: ['./*.brm'] }),
  );
  writeFileSync(`${folder}Page.brm`, source);
  const result = spawnSync(process.execPath, [bin, '-p', `${folder}tsconfig.json`], {
    encoding: 'utf8',
  });
  return result.stdout.split('\n').filter((line) => line.includes('error TS'));
}

afterAll(() => rmSync(folder, { recursive: true, force: true }));

it('accepts a template typed as the items', () => {
  expect(check(fixture)).toEqual([]);
}, 60_000);

it('rejects a template typed as something else than the items', () => {
  const wrong = fixture
    .replace('a: Animal', 'a: { id: string; size: number }')
    .replace('a.name', 'a.size');
  const errors = check(wrong);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('Page.brm(11,');
  expect(errors[0]).toContain(
    "'Animal[]' is not assignable to type 'readonly { id: string; size: number; }[]'",
  );
}, 60_000);

// An untyped template takes its type from the prop it is passed to.
const untyped = fixture.replace('row(a: Animal)', 'row(a)');

it('types an untyped template from the items', () => {
  expect(check(untyped)).toEqual([]);
}, 60_000);

it('rejects a wrong field of an untyped template, at the field', () => {
  const errors = check(untyped.replace('<p>(a.name)</p>', '<p>{a.nope}</p>'));
  expect(errors).toEqual([
    expect.stringContaining(
      "Page.brm(14,9): error TS2339: Property 'nope' does not exist on type 'Animal'.",
    ),
  ]);
}, 60_000);

it('types an untyped template at each use, also in #for and #if', () => {
  const source = untyped
    .replace(
      "const animals: Animal[] = [{ id: 'cat', name: 'Cat' }];",
      "const animals: Animal[] = [{ id: 'cat', name: 'Cat' }];\n  const cars = [{ id: 'a', model: 'A' }];\n  const name = 'outer';",
    )
    .replace(
      '<ListBox items=(animals) item=row />',
      [
        '<ListBox items=(animals) item=row />',
        '<ListBox items=(cars) item=row />',
        '#for (group of [animals]) {',
        '  #if (group.length) {',
        '    <ListBox items=(group) item=row />',
        '  }',
        '}',
      ].join('\n'),
    )
    .replace('<p>(a.name)</p>', '<p>{a.name} {name}</p>');
  const errors = check(source);
  // Only the use with cars has no `name`.
  expect(errors).toEqual([
    expect.stringContaining(
      "Page.brm(22,9): error TS2339: Property 'name' does not exist on type '{ id: string; model: string; }'.",
    ),
  ]);
}, 60_000);
