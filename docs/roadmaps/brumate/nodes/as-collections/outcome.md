# Outcome: as-collections

## Built

- `as` and `ref` on ListBox, ListBoxItem, Menu, MenuItem, GridList, GridListItem, Tree, TreeItem, TabList, Tab, TabPanel, TagList and Tag (packages/ui/src). Each exports `<Name>OwnProps` and `<Name>Props<T extends AsTarget = 'div'>`, renders `<{as ?? 'div'}>` with its role, forwards `ref=$bind(ref)`, and no longer takes `[attribute: string]: unknown`.
- ListBox, Menu, GridList and Tree take an own `id` prop (the ID of the root).
- packages/ui/test/as-collections.test.ts with fixtures/as-collections.brm, fixtures/AsTarget.brm (forwards `ref`, spreads the rest onto a `div`) and fixtures/AsTreeItem.brm. Type tests added to test/props-types.ts.
- Changeset .changeset/as-collections.md.

## Deviations

- Contract part-props is not fully true for a component in `as`: see contracts/part-props.change-request.md. `ref` reaches the caller through element names, and through a component only when it does not spread its props onto its root.
- Parts that read their root use `ref ?? document.getElementById(id)`; TagList uses `event.currentTarget`. This replaces the contract's "read `ref` where it read its own signal".
- ListBox renders `<div>` when `as` is not given and `<{as}>` otherwise, with the content in a `#template`, because a dynamic tag with a spread of handlers lost its keys in the list of a Select.
- TreeItem style selector is `[role='row']` instead of `div[role='row']`, so it holds for any element.

## Stubs left

- None. AsTarget.brm is the file that as-controls was to write; if it writes its own, keep one.

## Gotchas

- A component in `as` renders nothing when the browser renders it later: the TabPanel of a tab that gets selected, rows that a Tree opens, items added later. Only what the server renders works. Needs a core fix (change request, points 2 and 3).
- `ref` through a component that spreads its props stays empty (point 1).
- `ref=$bind(signal)` of a part needs a signal typed `any`, since `$signal<HTMLElement>()` is not Sendable and not a `Bindable<HTMLElement>` for the typechecker.
- Do not duplicate a `window` block in one file: it fails to compile (duplicate export).
- Tests of components in `as` must load the page afresh (`vi.resetModules()`).

## Proposed learnings

- A part with `as` that spreads handlers must keep a plain element for the case with no `as` if the browser renders it | a dynamic tag with a spread of handlers lost its keys in client renders | packages/ui/src | yes (select.test.ts)
- Read the root of a part by its ID as well as by `ref` | a component target can leave `ref` empty | packages/ui/src | yes

## Verification

- `npx vitest run --maxWorkers=2 test/as-collections.test.ts`: 9 pass.
- `npx vitest run --maxWorkers=2` in packages/ui: 513 pass, 1 fails (test/tree.test.ts "opens and closes with the chevron", which fails with the original Tree and TreeItem too).
- `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui: exit 0, with `@ts-expect-error` lines in test/props-types.ts proving it checks.
- `npx oxlint` exit 0, `npx oxfmt --check` clean.

## Size

- Estimated M, actual L. The pattern was one step, but component targets hit four core gaps that needed workarounds and a change request.
