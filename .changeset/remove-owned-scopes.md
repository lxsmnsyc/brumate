---
'brumate': patch
---

A block that removes a component now removes the component's scopes too. Its effects run their cleanups, and the content of its `#portal` blocks leaves the page. Before, only the markup went, so a portal stayed in the page and the effects never cleaned up.
