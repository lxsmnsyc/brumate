# Outcome: ref-from-as

## Built

- packages/ui/src/as.ts exports `TargetElement<T>`: `ElementOf<T>` for an element name, the element of the `Bindable<E>` in the `ref` prop of a component target (`undefined` removed), and `Element` for a component with no typed `ref`.
- 31 parts declare `ref?: Bindable<TargetElement<T> | undefined>`: Button, CheckboxGroup, Dialog, Disclosure, DisclosureGroup, DisclosurePanel, GridList, GridListItem, Heading, Link, ListBox, ListBoxItem, Menu, MenuItem, Meter, Popover, ProgressBar, RadioGroup, Tab, TabList, TabPanel, Tag, TagList, Toast, ToastRegion, ToggleButton, ToggleButtonGroup, Toolbar, Tooltip, Tree, TreeItem. Their `<Name>OwnProps` take `T extends AsTarget = <default>`, and `<Name>Props<T>` passes it on.
- packages/ui/test/props-types.ts: a button signal on Button passes, an anchor signal on `<Button as="a">` passes, a button signal on `<Button as="a">` is an error, an anchor signal on a default Button is an error, and cases for `TargetElement` of a tag, of a component with a typed `ref` (AsTarget gives `HTMLElement`), and of one without (Switch gives `Element`).
- The part-props contract is v1.4, with the interface, the rule for `TargetElement` and the change entry.
- Changeset .changeset/ref-from-as.md (minor).

## Deviations

- Test fixtures outside the owned paths changed, since a signal of `HTMLElement` no longer fits a part with a narrower element: test/fixtures/refForward.brm, as-collections.brm, as-collections-template.brm and asControls.brm. The `$signal<any>()` workaround in as-collections-template.brm and its comment are gone.
- The brief lists the parts under `shared` as a run-on list. All 31 parts that had `ref?: Bindable<HTMLElement | undefined>` are changed.

## Stubs left

- None.

## Gotchas

- 8 of 31 parts needed a local cast in the body, since `T` is generic and `TargetElement<T>` is not an `HTMLElement`: DisclosurePanel, GridList, ListBox, Menu, Popover, TagList, Tooltip, Tree. They read `ref as HTMLElement | undefined` where they read the root. The other 23 compile unchanged.
- `Bindable` is covariant, so a signal of a subtype fits and a signal of a supertype does not. `$signal<HTMLElement>()` no longer binds to `<Button>` (a button is narrower), and `<Part as=AsTarget>` (a component whose `ref` is `Bindable<HTMLElement>`) takes any element signal. Callers that bound `$signal<HTMLElement>()` to a part must name the element. The contract says so.
- Without `as`, the part gets the element of its default (`div`, `button`, `a`). A part that renders a different element by default than its type default would be typed wrong.
- The analyzer finds the `Bindable` props by the name of the interface, so `<Name>OwnProps<T>` is found as before.
- website/docs/typescript.md still shows a part with a non-generic `CardOwnProps`. It stays valid, but could show `TargetElement`. It is outside this node.

## Proposed learnings

- A part forwards `ref` typed `Bindable<TargetElement<T> | undefined>` and reads the root as `ref as HTMLElement | undefined` | `T` is generic in the body | packages/ui/src | no

## Verification

- `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui: exit 0, after `npx tsdown` in packages/brumate, language-core and tsc. With the old `HTMLElement` type on Button, the new `@ts-expect-error` lines failed as unused (TS2578), so the cases and the check are live. Before the fixture changes it failed with TS2322 in the fixtures.
- `npx vitest run --maxWorkers=2` in packages/ui: 57 files, 536 passed, 2 expected fail, exit 0.
- `npx oxlint --quiet`: exit 0. `npx oxfmt --check`: exit 0.
- The runtime is unchanged, so packages/brumate has no check to run.

## Size

- No change to the runtime, so no gzip numbers. Estimated M, actual M.
