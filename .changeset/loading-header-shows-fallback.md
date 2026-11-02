---
'brumate': minor
---

`#loading (posts) { … } #else { … }` names memos that the body renders from. Once the body has shown, the block shows its `#else` again while a named memo, or a memo that it reads, loads. The cause can be a write of its input, a `refresh` from a server function or a load it starts. The body stays in the page, hidden with the `#offscreen` rules, and comes back with the same elements and their state. A name that is not a memo that markup in the body reads fails to compile, with BRM186 in place of BRM181. A named memo that is or reads a `$debounced` or `$throttled` memo warns.
