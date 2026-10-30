---
'brumate': minor
---

A dynamic tag checks its attributes, `ref`, spreads and children against its tag: the attributes of an element name, or the props of a component. Its handlers are typed from the tag, so `<{tag} onClick=((event) => ...)>` types `event.currentTarget`. A component with any props is accepted as the tag, such as `<{as}>` where `as` is a `.brm` component type.

Breaking: an unknown attribute, a wrong value, a wrong `ref` or a wrong value in a spread is now an error. A tag that can name any element or component checks the global attributes and leaves its spreads unchecked.
