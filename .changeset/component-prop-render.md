---
'brumate': patch
---

A component that a prop gets as a value, such as `as=Link`, renders in a block or a new `#for` item that the browser renders. Before, it rendered nothing. The component that sends the value registers its render function with the core, which finds it by its ID. The sender must import the component from a `.brm` file. A component that reaches the prop only through a `.ts` re-export still renders nothing.
