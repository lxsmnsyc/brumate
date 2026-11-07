---
'brumate': patch
---

A component can pass a function that it imports from a module as a prop, as it can a function that it declares. The build failed before with "holds a Function, which cannot be sent to the browser". An imported value that is not a function, such as a list, still goes to the browser in the page state.
