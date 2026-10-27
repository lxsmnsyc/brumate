# Log: ref-from-as

- Probe: Button with `ref?: Bindable<TargetElement<T> | undefined>` and the props-types cases. The ui typecheck passed with the body of Button unchanged. With the old Button type, two new `@ts-expect-error` lines were unused and failed, so the cases are live.
- Applied to the other 30 parts with a script. 8 parts read the root in their body and needed `ref as HTMLElement | undefined`: DisclosurePanel, GridList, ListBox, Menu, Popover, TagList, Tooltip, Tree.
- The analyzer finds the `Bindable` props by the name of the interface, so `<Name>OwnProps<T>` works for it.
- Callers that bound `$signal<HTMLElement>()` to a part with a narrower element fail now. Fixed in the fixtures refForward, as-collections, as-collections-template and asControls.
