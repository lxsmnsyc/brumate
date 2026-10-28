---
'brumate': patch
---

A function that a page uses in its own markup and again in children or a `#template` that a component renders later is defined in the browser. Before, the second use threw `ReferenceError: <name>$ is not defined`. The same holds for a function passed as a prop to a component inside those children or that template, such as `<Item cb=bump />`, even with one use. A wrapper from `brumate/events`, such as `prevent`, in a handler prop of a component in those children is defined too.
