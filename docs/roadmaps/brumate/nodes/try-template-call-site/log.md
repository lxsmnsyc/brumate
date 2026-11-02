# Log: try-template-call-site

## 2026-11-02

- Started from origin/fix/try-template (71aed243, PR #420, open).
- Wrote fixtures tryTemplateFor, tryTemplateBlock, tryTemplateIf, tryTemplatePropIf, tryTemplatePropToggle (+ TryTemplateToggle) and tests in resume.test.ts, describe "a #try around a #template". A new test clicks the inside call of tryTemplateTwice.
- On 71aed243, 7 of the new tests fail (Twice, For a/b, Block, If, PropIf, Nested). On main, 18 of the describe fail, the 8 new ones among them.
- Cause: a template scope's parent is the scope where the template is declared. `fail` walked `p ?? o`, so it never passed the `#try` body around the call. #420 patched some cases with `t` entries on template scopes, which only works when the template is declared in the scope that holds the block. `calledTemplates` left out a template also called outside, so that `#try` shipped no catch code.
- Fix: a runtime link `l` from a template scope to the scope of the insert that renders its output.
  - `raw(html, scope)`: the template's output names its scope (codegen emitTemplate).
  - Server `insert` records `l` in the state (`ctx.call`). The server wrapper of a template prop (`ctx.fn`) renders through `insert` with the insert scope, which `Children` now passes to its body.
  - Client `insert`, `write` and the `TemplateCall` html link the scope (`linkCalls`, arrays too). Client inserts that call a template or a function now pass their scope.
  - Resume reads `l`; `SCOPE_IDS` lists it as an ID field.
  - `fail` walks `l ?? p ?? o`.
- Removed: the template roots of `triesTable` (the `calledTemplates` import, the claim check, the declared-in-owner check, the distance map). Each scope now takes the entry of the nearest `#try` body above it, and the walk stops at a template scope. `calledTemplates` is private and no longer excludes templates also called outside.
- Changed the #420 test tryTemplateNested: the inner `#catch` now catches, which #420 left uncaught as a gap.
- Updated the #420 bullet in website/docs/control-flow.md, which described the gap.
- Snapshots blocks, list, template-update: the new `raw` scope argument and a `putText` scope.
- Bench todos: 14.9 kB gzip JS before load (main 14.8).

## Review round 1

- No blocking findings. Non-blocking: a function that returns a template call (`{make(name)}`) was not caught, because `calledTemplates` only followed direct calls, while the client codegen already passed the scope for function calls. A comment in errors.ts had a long line.
- Fix: `calledTemplates` follows the functions and templates that the body calls, transitively. Fixture tryTemplateFunction. Re-wrapped the comment.

## Review round 2

- Clean. Reviewer probed recursive functions, function to template to template, a function declared in the body, and a handler-only function (no new try entry).
