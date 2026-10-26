---
'brumate': patch
---

A shorthand of a handler, such as `<button {onClick}>`, is now a handler, the same as `onClick=onClick`, as in Svelte. Before, it was a plain attribute, and the element got no handler.

`brumate-tsc` also reads a shorthand prop of a component, such as `<Feed {page} />`. Before, it wrote invalid code for it and reported a syntax error.
