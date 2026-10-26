---
'brumate': patch
---

The render module of a component with `#if` and `#for` blocks clones a template too, and fills the blocks with the render functions of the component's client module. The stylesheet of a component that the browser renders is no longer part of its markup.
