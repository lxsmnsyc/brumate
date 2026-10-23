---
'brumate': minor
---

`$handler(fn, ...args)` from `brumate/signals` marks a function that a script makes as an event handler, so a spread passes it on, as it passes on a handler that a caller writes in markup. Its arguments are JSON values that go with it, and it runs as `fn(...args, event)`, such as `onClick: $handler(prevent(removeAt), index)` in a function that makes the attributes of a button. A module function can call it too.

Spreads in markup that the browser renders, such as a new item of a `#for`, now pass on their handlers, with the modifiers of their wrappers. Before, they kept only the attributes.
