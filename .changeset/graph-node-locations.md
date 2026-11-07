---
'brumate': minor
---

Each node of the graph in the devtools has its place in the file. The inspect endpoint gives each node `at`, with the line and column of the name of a signal, prop or memo, or of the start of the markup, block or effect. A node from a module function also gives `file`, the module. In the Graph tab, `line N` in the side panel opens the editor there, and the tooltip names the place. The label of a markup node is the site label alone, such as `insert`, without the place.
