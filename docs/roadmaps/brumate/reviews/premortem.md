# Premortem

It is some weeks from now. @brumate/ui is not published. Why?

1. _*#245 sat open, and every as-* and docs node waited for it._* It is the base of the plan, and it is large (126 files), so its review takes time and later merges conflict with it. Change: props-types-main is the first gate. Rebase it on each merge to main until it lands, and merge it before anything that edits the parts.
2. **The props table generator could not read the types of .brm files from the website build.** The types come through the TypeScript plugin, not from plain tsc. Change: docs-generator must prove one table first, and its contract is a gate before the four docs nodes start.
3. **A component in `as` broke the keyboard code of a collection.** The collections read items through refs and `closest()`. A component that does not forward `ref`, or renders a wrapper, breaks focus. Change: as-collections tests a component target with the keyboard tests of each collection.
4. **The four docs nodes wrote four styles of page.** Change: the props-table contract fixes the sections and their order, and the user reviews it (gate).
5. **New parts collided in examples/ui and e2e/suites/ui.mjs.** Change: split-ui-examples comes first, gated on the user's approval. If the user declines, those nodes run one after another.

## Core

1. **The split of client.ts conflicted with every open branch.** A 4,700-line move breaks every branch that edits the file. Change: split-client-runtime is gated, runs when no other branch edits client.ts, and merges at once.
2. **The topological order broke the client size budget.** Memo lists in every `g` entry grow the tables. Change: ordered-updates measures the size before and after, and the budget in GOAL.md is a hard limit.
3. **Batching broke the parts of @brumate/ui that focus right after they open.** Change: batching audits the ui handlers and runs the ui suite and the ui e2e.
4. **drop-marker-index rewrote the same runtime code at the same time.** Change: drop-marker-index has hard edges on split-client-runtime and visible-forwarded-ref.
5. **Fields typed early read back a value the page had changed.** Change: the acceptance compares the field with the value that the server rendered.
