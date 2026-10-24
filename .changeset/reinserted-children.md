---
'brumate': minor
---

Children of a component now behave as the body of a block, as in Svelte and Solid. Each time a component shows its children again, such as after an `#if` or a `#portal` opens again, they render with new state, and closing them runs their cleanups.

- The page state sends children as a reference to code that renders them in the browser, not as their HTML.
- The values that children read go in the page state, so the browser can render them.
- Before, a click in children that a block showed a second time threw an error, and a `ref` among them could point at the element that had left the page.
