# Log: function-prop-reads

- 2026-10-31: probe on main with three pages in `packages/brumate/test/render` (`fnReadSync`, `fnReadLater`, `fnReadAsync`, child `FnReadChild`). A function prop that reads state fails in all three: the memo `title` and the markup call `{label()}` both stay at the first value after the parent writes `first` (server-rendered, resumed), after it writes `first` in a child that the browser renders, and after `id` changes a memo that `nameOf` reads. The markup call fails too, not only the memo.
- Cause: `graph.ts` skips every `prop` site whose value is a function, so the prop never depends on the state the function reads, and the child's `label` slot never gets a write.
- Fix: a function prop of a component whose site and callees write nothing, and whose name is not `on` plus a capital, gets the dependencies of the state it reads. `codegen/client.ts` adds the prop sites that are live to the update part, so `nameOf$` is placed in shared. A handler that writes stays fixed, so handler props add no update code.
- First try without the name rule made 5 tests of packages/ui fail (Radio `onChange=change`): a handler that calls a context function writes nothing the compiler sees, so the name rule keeps `onX` props and `provide` sites fixed.
- Limit: a function that reads one state and writes another is a handler for this rule, and does not update the child.
- Size: sum of the gzip -9 size of the 7 client JS files of benchmarks/brumate (todos) is 29,805 B on main and 29,797 B on the branch. todos has no function prop that only reads.
