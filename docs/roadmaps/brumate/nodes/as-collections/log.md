# Log: as-collections

- Nothing existed on main: the 13 parts had no `as`. Built them with the part-props pattern (`<Name>OwnProps`, `<Name>Props<T>`, `as ?? 'div'`, `ref=$bind(ref)`).
- The compiler reads `Bindable` only from a type literal or a named interface, so `ref` is its own `$props<{ ref?: Bindable<HTMLElement> }>()` line, not an intersection.
- Dead end: with a component in `as` that spreads its props, the forwarded `ref` stays empty (the anchor of the dynamic tag replaces the anchor of the component). Parts that read their root now use `ref ?? document.getElementById(id)`; TagList uses `event.currentTarget`. Written up in contracts/part-props.change-request.md.
- A component in `as` renders nothing when the browser renders it later, so the tests keep to what the server renders (Tree starts open, TabPanel tests the selected panel).
- Dead end: a dynamic tag with `{...keys()}` loses its keys when the browser renders it (Select tests failed). ListBox is a plain div without `as`, with the content in a `#template` (duplicating a `window` block fails to compile: duplicate export).
- Tests load the page afresh for each test (`vi.resetModules`), because a second mount after the code has loaded re-renders the items.
- test/tree.test.ts "opens and closes with the chevron" fails also with the original Tree and TreeItem in this checkout, so it is not from this node.
