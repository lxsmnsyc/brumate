import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// The TypeScript 7.1 compiler, which runs content mappers. It runs the mapper from `dist`.
const tsc = path.join(
  path.dirname(createRequire(import.meta.url).resolve('typescript/package.json')),
  'bin/tsc',
);

function check(project: string): { errors: string[]; status: number | null } {
  const result = spawnSync(
    process.execPath,
    [tsc, '-p', fileURLToPath(new URL(project, import.meta.url)), '--runExternalCode'],
    { encoding: 'utf8' },
  );
  const errors = result.stdout
    .split('\n')
    .filter((line) => / error [A-Z]+\d+:/.test(line))
    .map((line) => line.replace(/^.*test\/[a-z]+\/(src\/)?/, ''));
  return { errors, status: result.status };
}

it('reports type errors in .brm files at their place in the file', () => {
  const { errors, status } = check('./fixture/tsconfig.json');
  // `sign-in.brm` imports `SignIn`, the name that its file name gives the component, with no error.
  expect(errors).toEqual([
    // A prop with the wrong type, at the prop.
    "App.brm(9,19): error TS2322: Type 'string' is not assignable to type 'number'.",
    // A missing prop, at the tag.
    "App.brm(10,1): error TS2741: Property 'count' is missing in type '{ label: string; }' but required in type '{ label: string; count: number; }'.",
    // An expression in the markup.
    "App.brm(11,10): error TS2551: Property 'toFixed' does not exist on type 'string'. Did you mean 'fixed'?",
    // A position after characters that take two UTF-16 units.
    "Emoji.brm(3,9): error TS2322: Type 'string' is not assignable to type 'number'.",
    // Values that the page state sends to the client, which it cannot serialize.
    "Sent.brm(18,7): error TS2345: Argument of type 'Point' is not assignable to parameter of type 'Point & { x: number; move: { 'A function cannot be sent to the client. Keep it out of the signal or memo': never; }; }'.",
    "Sent.brm(19,7): error TS2345: Argument of type '(value: number) => string' is not assignable to parameter of type '((value: number) => string) & { 'A function cannot be sent to the client. Keep it out of the signal or memo': never; }'.",
    "Sent.brm(21,7): error TS2345: Argument of type 'RegExp' is not assignable to parameter of type 'RegExp & { 'A regular expression cannot be sent to the client. Send its source and flags': never; }'.",
    // A .ts file that renders a component gets the type of its props.
    "page.ts(3,41): error TS2322: Type 'string' is not assignable to type 'number'.",
  ]);
  expect(status).not.toBe(0);
});

it('reports a syntax error with the code BRM1', () => {
  const { errors, status } = check('./broken/tsconfig.json');
  expect(errors).toEqual(['Broken.brm(5,11): error BRM1: Unterminated regular expression']);
  expect(status).not.toBe(0);
});
