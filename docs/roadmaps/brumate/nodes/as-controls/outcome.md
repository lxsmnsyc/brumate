# Outcome: as-controls

## Built

- 15 parts take `as` (an element name or a component) and forward `ref` to the element they render: ToggleButton, Toolbar, ToggleButtonGroup, Disclosure, DisclosureGroup, DisclosurePanel, RadioGroup, CheckboxGroup, Meter, ProgressBar, Toast, ToastRegion, Dialog, Popover, Tooltip (packages/ui/src/<Name>.brm).
- Each part exports `<Name>OwnProps` and `<Name>Props<T extends AsTarget = '<default>'>` (the contract pattern), and renders `<{as ?? '<default>'} ref=$bind(ref) ...>`. Defaults: `div`, `button` for ToggleButton, `section` for Dialog. ToggleButton passes `as` and `ref` on to its Button.
- Toolbar, ToggleButtonGroup, DisclosurePanel, Popover, Tooltip and ToastRegion used their own signal for the root (`element`, `panel`, `region`). They read the `ref` prop instead, as the contract says: with nothing bound it is a local value.
- ToastRegion puts `as` on the element with `role="region"` (the one with the toasts), not on the wrapper that listens for `toastchange`. Popover and Tooltip put it on the panel, not on the layer. DisclosurePanel puts it on the panel.
- Tests: packages/ui/test/as-controls.test.ts with the fixtures test/fixtures/AsTarget.brm (byte for byte as the orchestrator gave it, it works as written) and test/fixtures/asControls.brm. 14 tests pass and 4 are `it.fails` (see Gotchas). Types: a block at the end of packages/ui/test/props-types.ts.
- Changeset .changeset/as-controls.md (minor, @brumate/ui).

## Deviations

- `ref` is declared in the own props of each part as `Bindable<HTMLElement | undefined>`, not as the contract's `Bindable<HTMLElement>` read from a separate `$props` type. With the contract's type a caller's `$signal<HTMLElement>()` does not type-check, and an element target has no `ref`. Change request: contracts/part-props.change-request-ref.md. The existing `part-props.change-request.md` (as-collections, rejected) is untouched.
- ToggleButton spreads `state(radio, selected)` in place of three attributes with `undefined` values. Otherwise `role=undefined` replaced the role that Button gives a component target. This is a small behavior fix, with no change for an element target.
- Dialog destructures `'aria-label'` and writes it, since the typed rest has no string index.
- Added test/fixtures/asControls.brm, outside the brief's owned list (a new file in the test folder).
- Not done: Checkbox, Radio, Switch, the Table parts, Modal, ModalOverlay, Sheet, MenuSection, ListBoxSection, Slider and Color parts, as the brief says. Checkbox, Radio and Switch would be cheap by the same pattern, but their element is their meaning.

## Stubs left

- None.

## Gotchas

Core gaps that remain with a component in `as`. Each has an `it.fails` test in packages/ui/test/as-controls.test.ts. Flip it to `it` when the core fix lands.

- Live attributes do not update. The part's `aria-pressed`, `data-selected`, `data-expanded` and `hidden` stay as the server wrote them. The live props of a dynamic tag go only to the `.brm` imports of the file (gap 1 in component-tag-live-props). Here `as` comes from a prop, so the part does not import the target. Tests: "updates the ARIA of a ToggleButton that is a component", "updates the attributes of a Disclosure and its panel that are components".
- A template that reads the component as a value, such as `<Toast as=AsTarget>` in the `toast` template of a ToastRegion, has a client part without the import: `ReferenceError: AsTarget is not defined` when the browser renders it. In a small page it works (the part is merged into the update part), so the gap shows when the template gets its own part. Test: "renders a Toast that is a component".
- The children of a component target do not update. A ToastRegion with `as` shows its first toast, but a closed toast stays. Test: "removes a toast from a ToastRegion that is a component". Likely the open core issue "children re-render".
- The type check of a signal bound to a component prop takes `$signal<HTMLElement>()` for data that the server cannot send. The fixture types its ref signals as `$signal<any>()`. On an element's `ref` the same signal passes.
- A component in `as` must forward `ref` and spread its rest, as AsTarget does. A function in a fixture that loops over refs with `.map` or `Object.entries` made an import of the template part disappear in the full fixture. It did not reproduce in a trimmed one, so it is not reported as a gap.
- `$bind` must be imported in a file that passes `ref=$bind(x)` to a component. On an element it needs no import.

## Proposed learnings

- A part that spreads a prop onto an element must not pass `undefined` for an attribute that its target may set itself | the spread replaces the value, so `role=undefined` erased the role of a component target | packages/ui/src | no

## Verification

- `npx vitest run --maxWorkers=2 test/as-controls.test.ts` in packages/ui: 14 passed, 4 expected fail. On main (src from HEAD): 9 failed, 6 passed, 3 expected fail.
- `npx vitest run --maxWorkers=2` in packages/ui: 55 files, 519 passed, 4 expected fail. Exit 0.
- `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui: exit 0 with no errors. Before the `ref` type fix it reported 45 errors, so the check works.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0. `npx oxlint --quiet` and `npx oxfmt --check` from the root: exit 0.
- packages/brumate was not changed, so its suite was not run.

## Size

- No change to the runtime, so no size number. Estimated M, actual M.
