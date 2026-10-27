# Log: as-controls

- Branch is on origin/main 3b2bb404. Linked node_modules, built packages/brumate and packages/tsc.
- Applied the pattern of Button to the 15 parts: `<Name>OwnProps`, `<Name>Props<T>`, `as` in the props, `ref=$bind(ref)` on the root. Parts that bound their own signal (Toolbar, ToggleButtonGroup, DisclosurePanel, Popover, Tooltip, ToastRegion) read `ref` where they read the signal.
- `$bind` must be imported in a file that binds `ref` on a component (ToggleButton passes it to Button). On an element it needs no import.
- ToggleButton passed `role=undefined` to Button when it was not a radio. Button spreads its rest last, so that erased the role of a Button that is not native. Now it spreads `state(radio, selected)`, which holds only the attributes that apply.
- Types: `ref?: Bindable<HTMLElement>` of the contract rejects `ref=$bind(signal)` for a signal of `HTMLElement | undefined`, and `ref` is not a prop of an element target. The own props of each part now declare `ref?: Bindable<HTMLElement | undefined>`. Change request: part-props-ref.change-request.md.
- Dialog read `rest['aria-label']`, which the typed rest does not allow. It destructures `'aria-label'` and writes the attribute itself.
- Core gaps found with a component in `as`, kept as `it.fails` tests in test/as-controls.test.ts:
  - live attributes of the part (`aria-pressed`, `data-expanded`, `hidden`) do not update, since the live props go only to the components that a file imports (gap 1 of component-tag-live-props);
  - a template that reads the component as a value (`<Toast as=AsTarget>`) has a client part without the import, so `AsTarget is not defined` when the browser renders it;
  - the children of a ToastRegion that is a component do not update, so a closed toast stays.
- A client function that loops over a list of refs with `for (const ... of Object.entries(...))` or `.map` made that import disappear in the full fixture, but not in a trimmed one. Not chased. The fixture probes with a plain sum of calls.
- Test on main: 9 of the 18 tests fail without the changes in src, the others are `it.fails` or pass already.
