---
'brumate': minor
---

The devtools have three new tabs:

- **Elements** shows a picked element with its place in the `.brm` file, which opens in the editor, its handlers and their parts, and the values its updates read.
- **Loading** lists each part of client code that loaded, with why, how long it took and its size, and marks preloads that nothing used.
- **Blocks** lists the `#loading`, `#defer` and `#client` blocks and `$client` callbacks with their state, and fires a trigger now.
