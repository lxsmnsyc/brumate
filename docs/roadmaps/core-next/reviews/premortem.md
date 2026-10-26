# Premortem

It is some weeks from now. Ordered updates did not ship. Why?

1. **The split of client.ts conflicted with every open branch.** A 4,700-line move breaks every branch that edits the file. Change: split-client-runtime is gated, runs when no other branch edits client.ts, and merges at once.
2. **The topological order broke the client size budget.** Memo lists in every `g` entry grow the tables. Change: ordered-updates measures the size before and after, and the budget in GOAL.md is a hard limit.
3. **Batching broke the parts of @brumate/ui that focus right after they open.** Change: batching audits the ui handlers and runs the ui suite and the ui e2e.
4. **client-size's drop-marker-index rewrote the same runtime code at the same time.** Change: the two roadmaps note it, and drop-marker-index waits for split-client-runtime.
5. **Fields typed early read back a value the page had changed.** Change: the acceptance compares the field with the value that the server rendered.
