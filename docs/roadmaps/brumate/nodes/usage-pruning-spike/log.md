# Log: usage-pruning-spike

## 2026-11-01

- Started on `spike/usage-pruning-spike` from `next` at 6adea8fb. No earlier work on this node.
- The core already exports one helper per function (client.ts), and Rolldown drops the exports no compiled component imports. What stays is reached from `loader` (init, handle, dispose) through data: state records, `b-on` strings, module tables. That is the part the spike is about.
- Wrote size.mjs and build.sh. Baseline (raw/gzip -9 bytes, start JS of the page; core chunk alone):
  - todos: page 35,468/14,825; core 28,217/11,070
  - dashboard: page 115,906/24,767; core 25,707/10,117
  - rows: page 34,980/14,566; core 27,316/10,725
  - website (hints.all, which every page loads): 103,850/35,687; core 53,855/19,565
- smoke.mjs: todos (counter, toggle, add) and rows (select, update, swap, remove, create, clear) in Chrome, with V8 block coverage of the core and the names of cold functions from the source maps. Base: todos runs 47% of the core bytes, rows 49%.
- Approach F (five more feature flags: tries, fields, windows, dynamic, routes; facts from the compiled output, joined per build). All five off:
  - todos 14,825 -> 13,806 (-1,019 B gzip); dashboard 24,767 -> 23,880 (-887); rows 14,566 -> 13,552 (-1,014); website +22 (it builds with `features: 'all'`, so only the `noop` is added).
  - Smoke passes on todos and rows.
  - Each flag off alone (todos, B gzip): tries -271, fields -299, windows -202, dynamic -187, routes -202. Sum 1,161; together 1,019 (gzip overlaps).
  - Each takes about 3 to 10 lines in the runtime and one regex in features.ts.
- Approach T (tree shaking by imports): the core reaches the same paths through `hooks`; installers (`useTries`, `useFields`, `useDynamic`, `useRoutes`) set them, and the client module of a component that uses a path imports and calls its installer (the prototype appends them in compile.ts from the same facts; real codegen would emit them). Windowed lists: `windowList` passes the park code to `list` as functions, so no installer and no fact. b-catch moves under `lateMarkup` (it comes only from `#loading`).
  - todos 13,918 (-907); dashboard 23,980 (-787); rows 13,680 (-886); website 35,918 (+231: every hook and installer, nothing pruned).
  - Smoke passes. Tests: 1,303 pass; the two render snapshots (blocks, retry) change only by the installer lines, and pass when updated.
  - T costs 100 to 130 B gzip more than F on each benchmark: each hook is a property read and a call, each installer an export and an import.
- Feature use by app (components with the path): hackernews none; tracker none; examples/todos none; website routes 3, dynamic 3; packages/ui dynamic 44 of 107, windows 4. An app with @brumate/ui keeps `dynamic` on.
- Saved prototype-flags.patch (F) and prototype-imports.patch (T, with the snapshot update), both against `next`. The branch keeps F.
- Wrote outcome.md. Recommendation: go, build F (usage-pruning-flags).
