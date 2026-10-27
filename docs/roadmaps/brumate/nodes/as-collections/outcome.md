# Outcome: as-collections

## Built

- `as` and `ref` on ListBox, ListBoxItem, Menu, MenuItem, GridList, GridListItem, Tree, TreeItem, TabList, Tab, TabPanel, TagList and Tag (packages/ui/src). Each exports `<Name>OwnProps` and `<Name>Props<T extends AsTarget = 'div'>`, renders `<{as ?? 'div'}>` with its role, binds `ref=$bind(ref)` on its root, and no longer takes `[attribute: string]: unknown`.
- The parts that read their root (ListBox, Menu, GridList, Tree, TagList, TabPanel) read the `ref` prop where they read their own signal, as the part-props contract says. No lookup by ID, no new `id` prop.
- TreeItem style selector is `[role='row']` instead of `div[role='row']`, so it holds for any element.
- packages/ui/test/as-collections.test.ts (13 tests), with fixtures `as-collections.brm`, `AsTarget.brm` (byte for byte as the brief gives it), `AsTreeItem.brm` and `as-collections-template.brm`.
- Type tests appended in one block at the end of packages/ui/test/props-types.ts.
- Changeset .changeset/as-collections.md (minor).

## Deviations

- Fixtures `AsTreeItem.brm`, `as-collections.brm` and `as-collections-template.brm` are not in the brief's paths. They are test files of this node.
- Two core gaps remain (below). Each has an `it.fails` test, and the parts have no workaround. `AsTreeItem.brm` is a test-side wrapper, so the main Tree test does not hit gap 2.
- No change request: the contract holds. The gaps are in the core.
- `test/tree.test.ts` "opens and closes with the chevron" failed after this node merged, on main too. The cause was the fixture `AsTreeItem.brm`, which spread `{...rest}` onto TreeItem: a spread onto a component makes all of its props live in the project analysis, and that changes how every TreeItem of the test project renders its children (the open core issue that a spread onto a component makes children live). A fix on main passes the props of the wrapper by name. The same change fixed the test "renders a second page in the same loaded code", which is now `it`.

## Stubs left

- None.

## Gotchas

- Gap 1: a component that a page gives to a part through `as` gets static props from the part. After Tab selects, its `aria-selected`, `tabindex` and `data-selected` do not change on a component target. Same for `aria-checked` of a MenuItem. Tests: `it.fails` "updates the attributes that a part gives to a component in as" and "updates the checked attribute of a menu item...". A probe in packages/brumate passed with RestLink (already given live props by another test) and failed with a copy of AsTarget, so the project analysis marks live props only for components it can see.
- Gap 2: in `fixtures/as-collections-template.brm`, a `#template` that names `as=AsTarget` fails with `ReferenceError: AsTarget is not defined` when the browser renders its rows (a folder that opens again). A smaller fixture did not reproduce it, so the trigger is not known. Test: `it.fails` "renders a template that names the component...".
- Gap 3, closed: a second page in the same loaded code rendered Tree rows without the component. The cause was the spread in `AsTreeItem.brm` (see Deviations), not the parts. The test "renders a second page in the same loaded code" is now `it`.
- Gap 2 has a smaller reproduction from the review of #272: a client part of a `#template` imports the part (`GapPart`) but not a component named only in an attribute value (`as=GapTarget`).
- When a gap is fixed, each `it.fails` fails with "Expect test to fail". Change it to `it`.
- `ref=$bind(signal)` in a fixture needs a signal typed `any`, since `$signal<HTMLElement>()` is not a `Bindable<HTMLElement>` for the type checker.
- The compiler reads `Bindable` only from a type literal or a named interface, so `ref` is its own `$props` line.

## Proposed learnings

- A part that reads its own root uses the `ref` prop, never a lookup by ID | a lookup hides a core gap and the contract already gives the rule | packages/ui/src | no

## Verification

- Before the parts: `npx vitest run --maxWorkers=2 test/as-collections.test.ts` had 5 of 9 tests failing on main. Now 9 pass and 4 fail as expected.
- `npx vitest run --maxWorkers=2` in packages/ui: 513 passed, 4 expected fail, 1 failed (tree.test.ts chevron, caused by the spread in `AsTreeItem.brm`; see Deviations). After the fix on main: 515 passed, 3 expected fail.
- `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui: exit 0, and the `@ts-expect-error` lines of props-types.ts each hold.
- `npx oxlint --quiet` and `npx oxfmt --check` from the root: exit 0.
- packages/brumate has no change, so its suite was not run.

## Size

- No change to the runtime, so no gzip numbers. The brief's budget does not apply.
- Estimated M, actual M.
