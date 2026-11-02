# Log: try-template

## 2026-11-02

- Wrote 7 fixtures and 15 tests in resume.test.ts, describe "a #try around a #template".
- On main, 7 of them fail, in two shapes:
  - A template declared outside the `#try` and called in it (tryTemplatePlain, tryTemplateOutside). The server creates the template scope with the scope where it is declared as its parent, so `fail` walks past the `#try` body. `tryCatchesClient` only looked at sites inside the body scope, so no `t` entry and no `#catch` code were sent.
  - A template declared in the `#try` that holds a component (tryTemplateChild). `holdsComponent` walks `getChildren`, which does not visit `body.templates`.
- A template declared in the `#try` with a plain button or an effect already works on main (#418 gave the body scope an ID).
- Fix: `calledTemplates` in graph.ts lists the templates declared outside the body whose calls are all in the body, transitively. `tryCatchesClient` counts their sites and the components of any template in or called by the body. `triesTable` in codegen/client.ts adds the scopes of called templates whose declaring instance is the scope that holds the block.
- Probed two cases that stay uncaught, by design of the lexical scope link: a template called both inside and outside the `#try`, and a top-level template called in a `#try` inside a `#for`. Kept a test that the outside call of the first is not caught.

## Review round 1

- Two blocking findings, both wrong catches from the `t` table, where the last of two entries for one scope won:
  - A `#try` inside a template declared above an outer `#try` that calls it lost its errors to the outer `#try`. A regression from main.
  - In `#try { #try { {kid()} } }` with a top-level `kid`, the outer `#catch` caught the error, which belongs to the inner `#try` (uncaught, as on main).
- Fix: `triesTable` gives each scope the entry of the nearest `#try` root above it, and a nested `#try` whose body holds each call of a template claims it, so an outer `#try` does not catch in its place.
- Added tests for both, a recursive template and a template passed as a prop (caught, it renders in the `#try`).
