---
'brumate': patch
---

An untyped `#template` parameter takes its type from the prop it is passed to. With `<ListBox items=(animals) item=row>` and `#template row(a)`, `a` is an `Animal`, so `a.nope` is an error at its place in the file. The type check writes such a template at each use, as an arrow function in the prop. A typed template, one without parameters, and one that the code calls or reads in another way stay function declarations, and still need types on their parameters.
