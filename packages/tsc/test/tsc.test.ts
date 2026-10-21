import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const bin = fileURLToPath(new URL('../bin/brumate-tsc.js', import.meta.url));
const project = fileURLToPath(new URL('./fixture/tsconfig.json', import.meta.url));

it('reports type errors in .brm files at their place in the file', () => {
  const result = spawnSync(process.execPath, [bin, '-p', project], { encoding: 'utf8' });
  const errors = result.stdout
    .split('\n')
    .filter((line) => line.includes('error TS'))
    .map((line) => line.replace(/^.*src\//, ''));
  // `sign-in.brm` imports `SignIn`, the name that its file name gives the component, with no error.
  expect(errors).toEqual([
    // A prop with the wrong type, at the prop.
    "App.brm(9,19): error TS2322: Type 'string' is not assignable to type 'number'.",
    // A missing prop, at the tag.
    "App.brm(10,1): error TS2345: Argument of type '{ label: string; }' is not assignable to parameter of type '{ label: string; count: number; }'.",
    // An expression in the markup.
    "App.brm(11,10): error TS2551: Property 'toFixed' does not exist on type 'string'. Did you mean 'fixed'?",
    // Values that the page state sends to the client, which it cannot serialize.
    "Sent.brm(18,7): error TS2345: Argument of type 'Point' is not assignable to parameter of type 'Point & { x: number; move: { 'A function cannot be sent to the client. Keep it out of the signal or memo': never; }; }'.",
    "Sent.brm(19,7): error TS2345: Argument of type '(value: number) => string' is not assignable to parameter of type '((value: number) => string) & { 'A function cannot be sent to the client. Keep it out of the signal or memo': never; }'.",
    "Sent.brm(21,7): error TS2345: Argument of type 'RegExp' is not assignable to parameter of type 'RegExp & { 'A regular expression cannot be sent to the client. Send its source and flags': never; }'.",
  ]);
  expect(result.status).not.toBe(0);
});
