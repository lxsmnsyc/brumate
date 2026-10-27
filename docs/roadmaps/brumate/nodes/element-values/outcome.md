# Outcome: element-values

## Built

- packages/brumate/elements.d.ts accepts every value that the runtime accepts:
  - `class` takes `ClassValue` (string, array, object, nested, where `false`, `null` and `undefined` add nothing); `style` takes `string | StyleObject` (camel-case names of CSS properties, and `--*`).
  - `select` has `value`; `value` of `input`, `select` and `textarea` and `checked` of `input` take `$bind(name)`, typed `BindableMark<unknown> & WritableMark<string>` (`WritableMark<boolean>` for `checked`).
  - `action` of `form` and `formaction` of `button` and `input` take `string | ServerFunction`.
  - Number attributes take `number | \`${number}\``.
  - `autocomplete` takes a boolean on `input`, `textarea`, `select` and `form`.
  - `onToggleEnd` is gone, `onKeyPress` exists.
  - New exports: `EventHandler<E, Ev>`, `ClassValue`, `StyleObject`, `ServerFunction`.
- contracts/element-types.md is v1.1, with the change listed.
- packages/brumate/test/elements-types.ts has a case for each widened value and 9 more rejections (a number for `class`, a function in a class array, a kebab-case or unknown style name, a string for `checked`, a signal of a number or of a string for the wrong binding, a number for `action`, `rows="three"`). On the old types `tsc --noEmit -p .` exits 1 with 26 errors; now it exits 0.
- .changeset/element-values.md (patch).

## Deviations

- None. The change request was accepted, so the contract file was edited.

## Stubs left

- None.

## Gotchas

- A number for `class` is rejected although the runtime prints it (`String(value)`), as the brief asks.
- `ServerFunction` matches any async function, so `action=someAsyncFn` type checks even if the compiler reports that it is not a server function.
- A `$signal<number>` cannot be bound to `value`: the field writes a string.
- `StyleObject` leaves out `cssText`, `cssFloat` and `webkit*` names, since the kebab-casing of the runtime would print wrong property names.
- Number attributes still reject a non-numeric string (`rows="three"`).

## Proposed learnings

- Widen an element type only after reading the runtime that renders or binds it, and cite the line in the log | the types stay sound | packages/brumate/elements.d.ts | no

## Verification

- `npx tsc --noEmit -p .` in packages/brumate: exit 1 on the old types with the new cases, exit 0 after.
- `npx tsc --noEmit -p tsconfig.elements.json`: exit 0.
- `npx vitest run` in packages/brumate: 972 passed, 5 expected fail.
- `npx oxlint`: exit 0 (warnings only, none new). `npx oxfmt --check`: pass.
- packages/ui not run: no change there.

## Size

- Estimated M, actual M. No runtime change, so no size numbers.
