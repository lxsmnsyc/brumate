---
'brumate': patch
---

`$memo` of a promise prop, and a memo that loads (`await`, a server function call), now load in a component that the browser renders, such as a child inside `#if`. Before, the markup of a memo that read a prop stayed on the promise (`[object Promise]`) and never showed the value or the `#catch` body. A `#loading` fallback still does not show in markup that the browser renders.
