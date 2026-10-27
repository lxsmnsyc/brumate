---
'brumate': patch
---

A write runs each memo it reaches once, after the memos it reads, and then each binding once. The updates of a component run before those of the components inside it, so a child gets every new prop and context value before its memos compute, and a `$bind` write from a child changes the slots of both before either computes. Before, a memo or a binding that read a signal and a memo of it ran twice, and a child could compute with one new value and one old one, so `letters[last]` could read past the end of the old list and throw. Memos still compute before the write returns, and the effects of a child still run before those of its parent.

An error of a memo or a binding no longer stops the handler that wrote. It goes to the nearest `#try` around the code that threw, also when the write waited for its code, and the rest of the updates of that write do not run. A write whose updates have not settled after 10000 rounds, such as a loop through `ref=$bind`, stops with an error.
