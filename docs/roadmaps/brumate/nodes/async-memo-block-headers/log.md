# Log: async-memo-block-headers

- 2026-11-02: Wrote fixtures gapBlock*.brm and a describe in resume.test.ts. On main the browser cases for `#if`, `#switch`, `#for`, a prop, a function in markup and `#if (user)` with `null` fail (11 of 16). The server controls (`open: true`) pass.
- First prop fixture used `user={user}`, which in brm is an object literal `{ user: user }`. Switched to the `{user}` shorthand.
- Fix: `settledMemos` takes a list of expressions. `emitNodesBlock` passes the `#if`/`#switch` conditions and the `#for` list or `#repeat` count; `emitComponent` passes the prop values (not handlers). template.ts carries `settled` on `component` writes, and `place` goes through `addLine`, so it lands in `fillSettled`. Dropped the `!reference.inFunction` filter so `list.map(() => user.name)` waits too.
- Probed, not changed: a handler in the held block reads the settled value on click; a header that mixes the memo with a live signal shows the right branch already.
- Full brumate suite passes, no snapshot changes. Bench todos: 14.8 kB gzip JS before load, same as main.
- Review round 1: no blocking findings. Fixed: a function-valued prop (`format=(() => name)`) held the component; now skipped, with a test that fails without the skip. Changeset now says a child gets the settled value. Left: the observer in the browser test ignores empty states, since a held insert leaves its element empty until the value settles.
