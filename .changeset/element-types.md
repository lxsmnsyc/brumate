---
'brumate': minor
---

Add the types `Elements`, `ElementProps`, `Markup`, `Component` and `PropsOf` in `brumate/elements`, with the attributes of each HTML and SVG element by tag. They accept every value that the runtime accepts, such as `class` as an array or an object, `style` as an object, a binding for `value` and `checked`, and a server function for `action`.

Breaking: the type check reads the attributes of a plain element against `ElementProps` of its tag.

- An unknown attribute, a wrong value, a wrong value or name in a spread and a computed attribute are errors at the attribute.
- A handler takes its event type from `ElementEvents`, so a custom event that an app merges in reaches the handler. An event name that no element fires, such as `onDoubleClick`, is a type error.
- The children of a component are `Markup`, so a component that takes no children reports them.
- The rest of a `$props` call leaves out the props that another call names, as it does at runtime.
