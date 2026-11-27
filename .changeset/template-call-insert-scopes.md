---
'brumate': minor
---

- The server gives each place that shows a `#template` call its own scope, also when a memo, signal, `const`, prop or context holds it.
- A `#template` body runs once for each place that shows its call, and not at all for a call that no place shows.
- The page state sends such a call, so the browser can insert it again, such as in a block that opens later.
- A memo of the call of a `#template` that a prop passes no longer breaks the page state.
- A `const` of a template call shown twice keeps both copies in markup that the browser renders.
- A handler that calls a `#template` no longer throws that the template is not defined.
