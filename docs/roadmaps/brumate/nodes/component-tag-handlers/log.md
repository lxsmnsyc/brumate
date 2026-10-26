# Log: component-tag-handlers

- Test first: `componentTagHandlers.brm` (a block that opens AsButton with `as=ScopeWrap`) fails on main: `b-on` is only `click=ScopeWrap_1pqzfbq#h1`.
- First version: `tagProps` in client.ts added the scope at run time. It cost +0.146 kB, over the budget.
- Rework after the review: the compiler writes the scope in each `b-on` entry of a dynamic tag, `spread` uses `{ ...attributes, 'b-on': undefined }`, and the server code that added scopes is removed. +0.034 kB.
- The new test "keeps its own handlers when its spread updates" showed that `updateSpreadEntries` drops own entries that carry `@`. Fixed by passing the own entries in the values of `attrs` (codegen/client.ts, `ownEvents`).
- Merged origin/main (#261 and others) into the branch first.
