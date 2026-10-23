---
'brumate': minor
---

A spread on a component can change in the browser, such as `<Button {...rest} />` with props that a parent changes. A key that the spread no longer has becomes undefined, and a prop after the spread wins over it. A binding in the spread passes on to the component.
