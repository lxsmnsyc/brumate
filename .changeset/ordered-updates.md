---
'brumate': patch
---

A write runs the memos it reaches once each, in the order they are declared, and then the bindings once each. Before, a memo or a binding that read a signal and a memo of it ran twice, and a child that got both as props computed with one new prop and one old one, so `letters[last]` could read past the end of the old list and throw. Memos still compute before the write returns, and the effects of a child still run before those of its parent.
