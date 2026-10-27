---
'@brumate/ui': patch
---

The `as` prop reads the element types of brumate. A field of the DOM that is not an attribute, such as `tabIndex` or `className`, is now an error. SVG elements are targets of `as`, and the `currentTarget` of a handler is the element.
