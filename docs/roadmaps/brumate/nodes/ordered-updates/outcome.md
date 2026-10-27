# Outcome: ordered-updates

## Built

- A write is a pass, in `packages/brumate/src/runtime/client/updates.ts`. `trigger` calls `pass(() => queueWrite(scope, slot))`. `queueWrite` looks up the code of the component and queues the updates of `g` for the slot, keyed by scope and update, so each waits once.
- The queue is `levels`, one `Level` for each depth of scope. `depthOf(scope)` is one more than the deeper of `t` (where children or a template that another component inserts render) and `p ?? o` (the parent), applied at each step. So children that a provider inserts come after the provider, and a template that a deep component hands up to a shallower one comes after the component that wrote it. A level holds its memos in buckets by rank (`m`), its bindings and block updates (`b`), and its effects (`e`).
- `drain` takes the lowest depth that has work. It runs that depth's bucket of the lowest rank in one loop, which also visits memos that join the bucket while it runs, then its bindings as one round. After each bucket or round it scans again from depth 0 and rank 0, so a memo or binding that queues a lower rank or depth, such as a `$bind` write into a parent, runs next.
- So the bindings of a component, its props and contexts, reach the components inside before their memos compute. A child, or a leaf that gets one value through a context and another through a prop of a middle child, computes once with all the new values.
- The rank of a memo is the number in its name, `m<site id>`. Sites are numbered in source order and a memo is declared after the memos it reads, so it is a topological order inside a component. Across components, the depth orders them. A wrong rank would only cost an extra compute, never a wrong value, because a memo that runs leaves its bucket and a later write queues it again.
- `set` of a slot that a parent bound with `$bind` writes both slots in one pass, so the memos of the child and of the parent see both new values.
- Effects run after the pass, the deepest first, so the effects of a child run before those of its parent, as on main (Transition relies on it). When a pass throws, its memos and bindings are dropped, and its effects stay in `pendingEffects` for the next pass, as on main.
- Each update runs inside a try: an error goes to `fail` on the scope of the update that threw, so the nearest `#try` around the update catches it whether the write ran at once or waited for code. A pass stops after a million update runs in one pass, for updates that keep writing what they read (such as a cycle through `ref=$bind`): past the limit each update that waits fails without running, so the queue empties. In DEV the message says so; in production it is `Update loop`. A cycle through a `$bind` with a setter is not caught: each step goes through `call` and starts a new pass, so the count starts again, and the page runs out of memory, as on main.
- Writes made inside one pass that wait for code, such as two props of a child whose update code is loading, join one list (`waiting`) and run as one pass. Each one that joins starts loading its code at once (`updateCode`). Writes outside a pass wait as on main, one pass each, with the same awaits.
- Tests under "updates of a signal and a memo of it" in `packages/brumate/test/resume.test.ts`: the 5 `it.fails` are `it`, and 4 new tests cover a context plus a prop through a middle child (fixtures `diamondContext.brm`, `DiamondContextMid.brm`, `DiamondContextLeaf.brm`), a `$bind` write with a memo passed back (`diamondBind.brm`, `DiamondBindChild.brm`), children inserted into a provider that get a context and a prop (`diamondChildren.brm`, `DiamondChildrenWrap.brm`, `DiamondChildrenKid.brm`), and a template that a deep component hands up to the page (`diamondLift.brm`, `DiamondLiftMid.brm`, `DiamondLiftKid.brm`, `DiamondLifter.brm`). All 9 fail on main and pass here. Another test, "catches the error of a memo in the #try around it, also when the write waited for the code" (`tryWaitingUpdate.brm`), failed before the try in `queue`.
- No compiler change: `g` and plan.ts are as before, so the tables do not grow.

## Deviations

- Docs outside the owned paths: `website/docs/reactive-graph.md` (step 7 now describes the queue: memos, then bindings, then effects, components from the outside in) and `docs/proposals.md` (the Ordered updates section starts with what was built). Fixtures in `packages/brumate/test/render/` for the 2 new tests.
- plan.ts and codegen/client.ts, owned, were not needed.
- `run` and `runUpdate` are gone. `pass`, `queueWrite`, `queue`, `drain` and `updateCode` replace them.
- An update queued for a scope that left the page in the pass does not run (`scopes.get(id) === target`). Effects checked `scopes.has(id)` before, so an effect of a scope replaced under the same ID no longer runs on the old scope.

## Stubs left

- None.

## Gotchas

- Memos stay eager: `set` returns after the whole pass, so a handler that writes `count` and reads `double` reads the new value. Inside a pass, bindings run after the memos of their depth, not in the middle of them.
- The order of writes that wait for code against handlers whose code loads at the same time depends on the number of awaits in `trigger` and `updateCode`. Three tests fail if a waiting write resumes a few microtasks later than on main: the `#offscreen` test "renders a body that is hidden at first on the client", and the ColorSlider and ColorWheel tests where `onChangeEnd` reads the value. Main has the same race. Batching (a handler as one pass) is the place to remove it.
- `treeChanges` in scopes.ts has no reader now (`queueWrite` runs no update while it finds descendants). It is still counted, because resume.ts, owned by fields-typed-early, calls `treeChanged()`. A later node can remove both.
- For batching: a pass is still one write outside a pass. `pass(fn)` is the place to make a handler a pass: call the handler inside it. `waiting` is set only while a pass runs, and reset when the outermost pass ends.
- A `#for` with a memo per row costs about 1.2x main per write (see Verification). Each queued update makes a key string and a closure, and walks its scope's depth. `queueWrite` finds the descendants of a kind once for each entry of `g`, without a cache, to keep the size in budget.

## Proposed learnings

- Effects of a child run before those of its parent, and parts rely on it | Transition leaves its parent after its child by effect order | packages/brumate/src/runtime/client | yes (packages/ui/test/transition.test.ts)
- A memo update is named `m<site id>`, and the runtime reads the id as its rank | the order of memos in a pass | packages/brumate/src/codegen | yes (the diamond tests)

## Verification

- `npx vitest run` in packages/brumate (after `npx tsdown`): 55 files, 1006 passed, 1 expected fail (from main).
- `npx vitest run --maxWorkers=2` in packages/ui: 57 files, 536 passed, 2 expected fail. One run under the same load failed 3 tests on 2 s waits; they passed alone and in the rerun of the suite.
- `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui: exit 0, and fails on a deliberate error.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0, and fails on a deliberate error.
- `npx oxlint` and `npx oxfmt --check` from the root: exit 0, no warnings in updates.ts.
- Timing, by hand: the reviewer's probe, `#for` of N rows each with `$memo(item + count)`, time of `count++` until the last row shows it, 5 clicks after a warm-up, happy-dom. The probe was not committed.

| rows  | origin/main | first head (09deb071) | round 1 (713d810c) | this head  |
| ----- | ----------- | --------------------- | ------------------ | ---------- |
| 1000  | 1.4-2.8 ms  | 5.2-8.8 ms            | 2.3-3.5 ms         | 1.7-3.4 ms |
| 4000  | 5.5-9.8 ms  | 59-90 ms              | 11-17 ms           | 7.3-11 ms  |
| 10000 | 24-27 ms    | 378-649 ms            | 49-59 ms           | 29-38 ms   |

main and this head were timed in the same session, two runs each.

- Not run: `pnpm bench`, `node e2e/run.mjs`.

## Size

Gzip -9. Base: this branch with main's updates.ts (main at 533c3919 plus this tree). Head: this branch.

- Todos app of benchmarks/brumate (`vite build`, all JS of dist/client), on main 0c1e00f8: 28000 to 28291 (+291, budget 300). Its core chunk: 9706 to 9989 (+283). The other chunks move by a few bytes between builds, because they hold the hashed names of the chunks they import.
- The App chunk with its `g` table: 889 to 889.
- dist of `npx tsdown`: client 32871 gzip on head (unminified); produce and client-routes do not change.

Estimated L, actual L: no compiler change, but the depth order, the `$bind` pass and the load timing took several rounds.
