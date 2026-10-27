# Outcome: fields-typed-early

## Built

- `readFields()` in `packages/brumate/src/runtime/client/resume.ts`, called by `init` after the markers are indexed. It visits each element whose `b-on` has a `$bind#` or `$set:` entry (a `value` or `checked` binding, also from a spread) and calls `handle` for those entries when the user changed the field, so the signal is written as an `input` event would, or the setter of `$bind(name, fn)` is called.
- "Changed" is `typedInto`: `value !== defaultValue` for inputs and textareas, `checked !== defaultChecked` for boxes and radios, and for a `<select>` the selected index against the expected one: the last option with a `selected` attribute, else the first option that is not disabled (`:disabled`, which also covers a disabled optgroup) for a single select, else none for `size` above 1. For `multiple`, any option whose selection differs from its attribute. The `selected` and `size` attributes are read, because the test DOM has no `defaultSelected` or `size`. The defaults are what the server rendered, and `init` runs before any update writes a field, so a field that still has the rendered value is not read.
- Hook: `hooks.field(element)` in `state.ts` for a part with its own field. It returns `{ value }` when the field changed, `false` when not, and nothing for an element of the core. The value goes to the binding through a new optional fourth parameter of `handle` (`typed`).
- `handle` in `handlers.ts` computes the field value once for both `$set:` and `$bind#`.
- Tests: `packages/brumate/test/early-input.test.ts` (13 tests, own inline fixture): untouched fields are not read (no setter call, signals unchanged), text, textarea, checked and unchecked boxes, select, a select with no `selected` option, a select whose first option is disabled, a list box (`size=3`), a list box the user picked from, a radio group (each radio written once; untouched group not read), `select multiple` (writes the first selected option, as an input event does), a `$bind(name, fn)` setter, typed text kept after later updates, and the hook. 7 of them fail without the `readFields` call.
- Changeset `.changeset/fields-typed-early.md` (brumate, patch).

## Deviations

- `handlers.ts` and `state.ts` are in `shared`, edited minimally as the brief allows. No fixtures were added to `test/render/`: the new test compiles its own.
- Not covered: fields in a `#loading` body that streams in after `init`, and markup the page inserts later. Only the markup present when the core starts is read. No test covers them.

## Stubs left

- None. No part sets `hooks.field` yet. TokenField keeps its own fix (#206); a later node can move it onto the hook.

## Gotchas

- The hook must be set before `init` runs (the core starts at once at boot). In a test, import `client/state.ts` after `vi.resetModules()` and before the loader.
- `typedInto` relies on `defaultValue`. If an update writes the `value` attribute before `init` reads, the comparison is lost. None does today.

- A number or range input, or any value the browser cleans, can differ from `defaultValue` without the user, and counts as typed. The write is the cleaned value, which an input event would also give.
- A radio group: choosing one radio also unchecks another, which differs from its rendered state, so both are written, once each.
- The list box test sets `selectedIndex = -1` itself, since the test DOM selects the first option.

- Comparing a select with `cloneNode(true)` was tried to drop the expected-index code. The test DOM copies the selection into the clone, so the tests cannot confirm a browser's behavior; the attribute code stays.

## Proposed learnings

- Test "typed" against `defaultValue`, `defaultChecked` and `defaultSelected`, never against the signal | the signal holds the old value by definition | packages/brumate/src/runtime/client | no

## Verification

- `pnpm --filter brumate exec vitest run test/early-input.test.ts`: 13 passed. `npx vitest run` in packages/brumate: 56 files, 1022 passed, 1 expected fail.
- `pnpm lint` (no errors; existing warnings), `pnpm format:check`, `pnpm typecheck`: pass.
- Not run: `node e2e/run.mjs`, the ui suite, `pnpm bench` itself.

## Size

Gzip -9 of all JS in `dist/assets` of the todos app of benchmarks/brumate (`vite build`, as the earlier nodes measured): 28181 to 28462 (+281 B, within 0.3 kB). `pnpm bench --only brumate --scenario todos --metrics dist` reports jsGzip 28462. `pnpm bench` itself was not run.

Estimated M, actual M.
