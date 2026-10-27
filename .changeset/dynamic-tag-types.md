---
'brumate': minor
---

A dynamic tag checks its attributes, `ref`, spreads and children against its tag: the attributes of an element name, or the props of a component. Its handlers are typed from the tag, so `<{tag} onClick=((event) => ...)>` types `event` and `event.currentTarget`. For an element name or a component, an unknown attribute, a wrong value, a wrong `ref` or a wrong value in a spread is now an error. A tag that can name any element or component, such as a generic `T extends AsTarget`, checks the global attributes of its own attributes and leaves its spreads unchecked, and its handlers get `HTMLElement | SVGElement`. The types that the generated check uses are in `brumate/check`, an internal entry that may change in any release.
