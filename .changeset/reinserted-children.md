---
'brumate': minor
---

Children of a component behave as the body of a block, as in Svelte and Solid. Each time a component shows its children again, such as after an `#if` or a `#portal` opens again, they render with new state, and closing them runs their cleanups. Before, a click in children that a block showed a second time threw an error, and a `ref` among them could point at an element that had left the page.

- Bodies that the browser adds to a `#for`, `#if` or `#key` in children read the contexts of the component where the children are finally inserted, also when other components pass them on, and in `#offscreen`, `#client`, `#try` and `#portal` bodies.
- Children that a component passes on to another, as `<Select>{children}</Select>`, read the contexts of the component that inserts them.
- Children that the browser renders again render on a page that client navigation loaded.
- A spread onto a component keeps the children and the `as` component that the server rendered when markup updates after a change.
