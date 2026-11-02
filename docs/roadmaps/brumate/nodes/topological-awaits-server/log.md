# Log: topological-awaits-server

- 2026-11-02: read the brief, the "Topological awaits" section of the browser-await-spike outcome and the browser-await outcome. The server makes idle memos (`$$b.memo`), and `waitAll` or `ready` computes them, so moving the `$$b.memo(...)` line and adding a start is enough. `start` calls `ready` and catches both the throw and the promise, so a failed memo throws again at its `await`.
- First cut held a load at every statement that mentioned a name it reads. `let q = id` then held a memo of `id`, so the rule now counts a mention only in a place that can change the name: the root of a write target, of a callee, of `delete`, and every name in an argument. A mention of a local function always counts, through the names that the function mentions.
- First cut also moved every load that read nothing to the top, which added `$$b.start` to components that gain nothing (an awaited memo after `let id = $signal(1)`). A load now moves only over a statement that waits: the end of an earlier run of awaits, a memo that the markup waits for, or an `await` in the script.
- Loads with no inputs start at the top, before an earlier await, so the order of the load calls changes (`['second', 'first']` in the tests). That is the rule of the brief.
- `start` shadowed two locals named `start` in server.ts (oxlint warning); renamed the locals.
- Bench: todos JS before `load` 13.5 kB gzip, as on the base. The click checks fail on the base too (feat/browser-async; the bench server passes no `bundles` since bundle-urls-from-server). Not this node.
