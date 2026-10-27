---
'brumate': minor
'@brumate/ui': patch
---

The props object and the rest of `$props()` can only be destructured, read one key at a time, or spread in markup. A spread in script code, and passing them to a function, `$memo`, `$setContext`, a signal or a variable, are now a compile error, since such a copy loses the `ref` and the live props. Spread them in markup instead: `<button {...rest} class="box">`. A `NavigationTreeItem` passes its attributes to its `TreeItem` in markup, so its `ref` reaches the row, and the `TreeItemAttributesContext` is removed.
