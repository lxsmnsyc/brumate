---
'brumate': patch
---

A `$memo` whose expression can throw by conversion, such as `big + 1` for a BigInt, `[big]` or a template with a part, now keeps its error until something reads it, in the browser render and on the server. It used to throw where it was declared, so a `#try` around the component showed its `#catch` even when nothing read the memo. Memos that cannot throw, such as `a === b`, `!a` or `a ?? b`, stay plain values.

Memos with arithmetic or a template part, such as `count * 2`, are no longer computed in place: the browser render wraps them in its memo read, and the server computes them as lazy memos. Values and update order are the same; the client code of such a component grows by a few bytes per memo.
