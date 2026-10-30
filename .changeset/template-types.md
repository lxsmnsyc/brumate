---
'brumate': patch
'@brumate/language-core': minor
'@brumate/typescript-plugin': patch
---

An untyped `#template` parameter takes its type from the prop it is passed to. With `<ListBox items=(animals) item=row>` and `#template row(a)`, `a` is an `Animal`, so `a.nope` is an error at its place in the file. Hover, go to definition, references and rename on the template name still work. The TypeScript server plugin drops a diagnostic that repeats another at the same place, as the error of a template used twice does. `@brumate/language-core` exports `dedupeDiagnostics` for it.
