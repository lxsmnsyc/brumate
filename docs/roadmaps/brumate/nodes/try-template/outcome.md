# Outcome: try-template

## Built

- `calledTemplates` in packages/brumate/src/graph.ts: the templates declared outside a `#try` body whose calls are all in the body, or in another such template.
- `tryCatchesClient` counts the sites of those templates, and a component in any template that the body declares or calls. `holdsComponent` takes markup nodes so it can check template bodies, which `getChildren` does not visit.
- `triesTable` in packages/brumate/src/codegen/client.ts adds a `t` entry for the scopes of a called template when the template is declared in the scope that holds the block. Each scope takes the entry of the nearest `#try` above it, and a nested `#try` whose body holds each call of a template claims it.
- Tests in packages/brumate/test/resume.test.ts, describe "a #try around a #template": control without a template, template in the body, template outside the body, template holding TryKid, by 3 errors (handler, async handler, effect); 2 plain-button cases; 1 test that a call outside the `#try` is not caught; 5 tests for the nearest `#catch` (a `#try` in the template, a recursive template, a template prop, a template in nested `#try` blocks). Fixtures tryTemplate*.brm.
- A bullet in website/docs/control-flow.md. Changeset .changeset/try-template.md (patch, brumate).

## Deviations

- The reported shape, a template in the `#try` with a plain button, already works on main since #418. Two other shapes failed: a template declared outside the `#try` and called in it, and a template in the `#try` that holds a component.

## Stubs left

- None.

## Gotchas

- A template scope links to the scope where it is declared, not where it is called. So these stay uncaught, on main and after this fix: a template called both inside and outside the `#try`, and a template declared above the scope that holds the `#try`, such as a top-level template called in a `#try` inside a `#for`. A fix needs a runtime link from a template scope to its call site.
- In the second case `tryCatchesClient` still holds, so the `#catch` body ships without catching.

## Proposed learnings

- A template scope links to where it is declared | code that walks scopes at runtime misses the call site | packages/brumate/src/codegen/client.ts | yes

## Verification

- On main 7 of the 20 new tests fail; all pass with the fix. The 2 review tests for nested `#try` blocks fail on the first commit of the PR.
- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (1364 passed).
- `pnpm bench --only brumate --scenario todos`: JS before `load` 14.8 kB gzip, the same as main.

## Size

- Estimated S, actual S.
