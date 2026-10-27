# Log: as-collections

- Started from origin/main 3b2bb404. Read draft #252 for the pattern only. Applied its part changes, then removed its workarounds: the `rootOf()` lookup by ID, the own `id` prop, the plain `<div>` branch of ListBox and `event.currentTarget` in TagList. The parts read `ref` where they read their own signal, as the part-props contract says.
- The dynamic tag with a spread of keys in ListBox works now (dynamic-spread-handlers), so ListBox is one `<{as ?? 'div'}>`.
- The compiler reads `Bindable` only from a type literal or a named interface, so `ref` is its own `let { ref } = $props<{ ref?: Bindable<HTMLElement> }>()` line.
- Test first: the new file failed on main for the parts (5 of 9 failed before the parts changed).
- Gap 1: a component that a page gives to a part through `as` gets static props. The Tab sends `aria-selected=(selected ...)`, the state changes, the attribute stays. A probe in packages/brumate with the same shape (a component Q with `<{as} aria-selected=(x) {...rest}>`, a page giving `as=Component`) passed when the target was RestLink, which another test already gives live props, and failed with a copy of AsTarget. So the live props reach only components that the project analysis marks. Shown by two `it.fails` tests.
- Gap 2: in the fixture, a template that names `as=AsTarget` fails with `ReferenceError: AsTarget is not defined` when the browser renders a row (a folder that opens again). A smaller fixture with only a Tree did not reproduce it, so the cause is unknown. AsTreeItem.brm wraps TreeItem in the main fixture, and the `it.fails` test uses the direct form.
- Gap 3: after the code of one page has loaded, a second page in the same loaded code renders the Tree rows without the component. The tests reset the modules for each test. Shown by one `it.fails` test.
- test/tree.test.ts "opens and closes with the chevron" fails on origin/main too, in this checkout: with every change of packages/ui/src reverted it fails the same way (focus does not return to the row). Not touched.
- oxfmt: the draft failed because of its test file. The new test is formatted with oxfmt.
