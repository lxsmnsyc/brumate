---
'brumate': patch
---

A function that a page uses in its own markup and again in children or a `#template` that a component renders later is defined in the browser. Before, the second use threw `ReferenceError: <name>$ is not defined`. The same fix defines a wrapper from `brumate/events`, such as `prevent`, that a handler prop of a component in those children calls.
