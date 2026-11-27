---
'brumate': minor
---

- The server gives each place that shows a `#template` call its own scope, also when a memo, signal, `const` or prop holds the call.
- The page state sends such a call, so the browser can insert it again, such as in a block that opens later.
- A `const` of a template call shown twice keeps both copies in markup that the browser renders.
- A handler that calls a `#template` no longer throws that the template is not defined.
