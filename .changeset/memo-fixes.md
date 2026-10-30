---
'brumate': patch
---

- A function that the markup calls on the server can read a memo that nothing else reads. It threw `ReferenceError` when that memo read another memo.
- A state record of a streamed memo that arrives after the memo loaded again in the browser no longer replaces the value of the newer load.
- A memo of an object with a shorthand property that reads another memo, such as `$memo({ id, value })`, compiles on the server.
