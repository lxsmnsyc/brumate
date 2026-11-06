# Outcome: split-ui-examples

## Built

- `examples/ui/src/sections/<Name>Section.brm`: one component for each part of the page (48), plus `ToastsSection.brm` for the toast region.
- `examples/ui/src/sections.brm`: the list. A part adds `<Name>Section.brm` and two lines here (an import and a tag).
- `examples/ui/src/routes/index.brm`: the head, the title, the intro, `<Sections />` and the page style.
- `e2e/suites/ui/<part>.mjs`: the steps of one part (45 modules, 56 steps); `e2e/suites/ui/index.mjs`: the list, one `() => import('./<part>.mjs'),` line for each part; `e2e/suites/ui.mjs` runs them in order.

## Result

Not an experiment node.

## Deviations

- A new part needs two lines in the page list (import and tag), not one. A section component cannot be named without an import, and the page has no dynamic component for a value.
- The e2e steps of a part are one module, while a part can have several steps (Tabs, Toast, GridList...).

## Stubs left

- None.

## Gotchas

- A function passed as a prop (`isDateUnavailable=closed`) must be declared in the script of the component that passes it. An import of the function fails on the server ("holds a Function, which cannot be sent to the browser"). `closed` is copied into CalendarSection and RangeCalendarSection.
- Generated ids on the page change (the id counter counts each section component); no selector uses them.
- The server function URL of the createForm part now names `CreateFormSection`, not `Index`.
- `routes/index.brm` still holds the page style (all `:global`, shared by many parts). A new part that needs a rule adds it there, so that file can still conflict.
- `examples/ui` has no unit tests.

## Proposed learnings

- A function prop is declared in the script of the component that passes it, never imported | the server cannot send an imported function to the browser | examples/ui, packages/ui | no

## Verification

- `pnpm lint` exit 0; `pnpm format:check` clean; `pnpm --workspace-concurrency=2 -r typecheck` and `pnpm --filter example-ui build` pass.
- SSR markup of `/` equals the base after removing hashes and generated ids.
- `node e2e/run.mjs --only ui` on this branch and on origin/next: see the pull request.

## For the maintainer

- The page list takes two lines per part, the e2e list one. A single line per part on the page would need `import.meta.glob` or a dynamic component, which this node did not add.
- The page style could move into the section files with their own `:global` rules, but the cascade order would change. Left as it is.

## Size

- Estimated M, actual M.
