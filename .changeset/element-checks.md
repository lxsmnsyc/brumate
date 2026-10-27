---
'brumate': minor
'@brumate/ui': patch
---

The type check reads the attributes of a plain element as one object against `ElementProps` of its tag. An unknown attribute, a wrong value, a wrong value or name in a spread, a computed attribute and a `ref=$bind(x)` of another element are errors at the attribute. The children of a component are `Markup`, so a component that takes no children reports them. The rest of a `$props` call leaves out the props that another call names, as it does at runtime.

The parts of @brumate/ui that spread their other props onto an element type them as the attributes of that element, in place of any attribute.
