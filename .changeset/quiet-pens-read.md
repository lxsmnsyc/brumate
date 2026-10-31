---
'brumate': patch
---

A memo, markup or effect in a child that reads a function prop now runs again when the state the function reads changes. The function stays fixed, as before, when it writes state or calls through a context value or a prop outside `$untrack`, and a prop named `onX` is always fixed. See [the debate](https://github.com/lxsmnsyc/brumate/blob/main/docs/debates/function-prop-derivations/debate.md).
