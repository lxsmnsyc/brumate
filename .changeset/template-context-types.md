---
'brumate': patch
'@brumate/language-core': patch
'@brumate/typescript-plugin': patch
---

An untyped `#template` parameter takes its type from the prop it is passed to. With `<ListBox items=(animals) item=row>` and `#template row(a)`, `a` is an `Animal`, so `a.nope` is an error at its place in the file. The type check writes such a template at each use, as an arrow function in the prop, and keeps its name declared, so hover, go to definition, references and rename on the name still work. A typed template, one without parameters, and one that the code calls or reads in another way stay function declarations, and still need types on their parameters.

The TypeScript server plugin drops a diagnostic that repeats another at the same place, as the error of a template used twice does. `dedupeDiagnostics` of @brumate/language-core does it.
