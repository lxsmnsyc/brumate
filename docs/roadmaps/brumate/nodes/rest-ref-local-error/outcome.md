# Outcome: rest-ref-local-error

## Built

- A compile error in the analyzer (packages/brumate/src/analyze.ts, `Resolver.visit`): the props object and the rest of `$props()` may only be destructured, spread in markup (an element, a dynamic tag or a component), or read one key at a time. A spread in script code (also inside `$memo`), and passing it to a function, `$memo`, `$setContext`, a signal, a variable or a prop value, are errors. The declaration flag is `whole` in model.ts.
- Catalog entry in error-catalog.ts ("... is the props object, so read one key at a time, destructure it, or spread it in markup"), with a fix that spreads in markup. references/errors.md of the skill is regenerated.
- Tests in packages/brumate/test/check.test.ts ("props used as a whole"): 9 cases that error, one that must not.
- One hit in the repo: packages/ui/src/NavigationTreeItem.brm. It now passes `data-href`, `data-current`, `data-current-ancestor` and `{...rest}` to `<TreeItem>` in markup. `TreeItemAttributesContext` (tree.ts) and its read in TreeItem.brm are removed. Its own attributes still win over the three computed ones, as before.
- A `ref` given to a NavigationTreeItem now reaches the row (it was dropped before). Test: navigation-tree.test.ts "gives the ref of an item to its row", fixture nav-tree-ref-page.brm.
- Changeset `.changeset/rest-ref-local-error.md` (minor brumate, patch @brumate/ui).

## Deviations

- The tests are inline in check.test.ts, not in test/check/propsWhole*.brm fixtures: the cases are small and need the error text.
- Edited outside the shared list: packages/brumate/src/model.ts (one field), packages/brumate/skills/brumate/references/errors.md (generated), packages/ui/test/ (the ref test).

## Stubs left

- None.

## Gotchas

- `rest as T`, `rest!` and `(rest)` used whole are errors too. `(rest as T).key` is also an error, since its object is not a plain identifier. Write `rest.key`.
- A key read through a computed key, `rest[name]`, is allowed.
- Fixtures that test something else: none broke the rule.

## Proposed learnings

- None.

## Verification

- `npx oxlint`: no errors. Root `npx oxfmt --check`: pass. `npx tsc --noEmit` in packages/brumate and `npx brumate-tsc --noEmit` in packages/ui: pass.
- packages/brumate: 758 passed at first, with 5 timeouts under load (devtools, features, resume), each passing alone. packages/ui: 538 passed, 1 expected fail.
- website: `node scripts/check-samples.ts` 63 samples, 0 problems; `npm run build` exit 0.

## Size

- Estimated M, actual S. One check and one part to rewrite.
