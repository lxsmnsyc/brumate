# Outcome: ordered-updates

## Built

- A write is a pass, in `packages/brumate/src/runtime/client/updates.ts`. `trigger` calls `pass(() => queueWrite(scope, slot))`. `queueWrite` looks up the code of the component and queues the updates of `g` for the slot, keyed by scope and update, so each waits once.
- The queue is `levels`, one `Level` for each depth of scope (the hops through `p` and `o` to the root of the page). A level holds its memos in buckets by rank (`m`, with the cursor `a` at the lowest rank that can have one), its bindings and block updates (`b`), and its effects (`e`).
- `drain` takes the lowest depth that has work. It runs that depth's memo of the lowest rank, until none waits, then its bindings as one round. After each step it looks again from depth 0, since a write can queue work at a lower depth, such as a `$bind` write into a parent. Each pick is O(1) for memos, plus a scan of the depths, which are few.
- So the bindings of a component, its props and contexts, reach the components inside before their memos compute. A child, or a leaf that gets one value through a context and another through a prop of a middle child, computes once with all the new values.
- The rank of a memo is the number in its name, `m<site id>`. Sites are numbered in source order and a memo is declared after the memos it reads, so it is a topological order inside a component. Across components, the depth orders them. A wrong rank would only cost an extra compute, never a wrong value, because a memo that runs leaves its bucket and a later write queues it again.
- `set` of a slot that a parent bound with `$bind` writes both slots in one pass, so the memos of the child and of the parent see both new values.
- Effects run after the pass, the deepest first, so the effects of a child run before those of its parent, as on main (Transition relies on it). When a pass throws, its memos and bindings are dropped, and its effects stay in `pendingEffects` for the next pass, as on main.
- `drain` throws after 10000 rounds of bindings in one pass, for updates that keep writing what they read (such as a cycle through `ref=$bind`). In DEV the message says so; in production it is `Update loop`.
- Writes made inside one pass that wait for code, such as two props of a child whose update code is loading, join one list (`waiting`) and run as one pass. Each one that joins starts loading its code at once (`updateCode`). Writes outside a pass wait as on main, one pass each, with the same awaits.
- Tests under "updates of a signal and a memo of it" in `packages/brumate/test/resume.test.ts`: the 5 `it.fails` are `it`, and 2 new tests cover a context plus a prop through a middle child (fixtures `diamondContext.brm`, `DiamondContextMid.brm`, `DiamondContextLeaf.brm`) and a `$bind` write with a memo passed back (`diamondBind.brm`, `DiamondBindChild.brm`). All 7 fail on main and pass here.
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
- A `#for` with a memo per row costs about 2x main per write (see Size). Each queued update makes a key string and a closure, and walks its scope's depth.

## Proposed learnings

- Effects of a child run before those of its parent, and parts rely on it | Transition leaves its parent after its child by effect order | packages/brumate/src/runtime/client | yes (packages/ui/test/transition.test.ts)
- A memo update is named `m<site id>`, and the runtime reads the id as its rank | the order of memos in a pass | packages/brumate/src/codegen | yes (the diamond tests)

## Verification

- `npx vitest run` in packages/brumate (after `npx tsdown`): 55 files, 990 passed, 1 expected fail (from main).
- `npx vitest run --maxWorkers=2` in packages/ui: 57 files, 536 passed, 2 expected fail.
- `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui: exit 0, and fails on a deliberate error.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0, and fails on a deliberate error.
- `npx oxlint` and `npx oxfmt --check` from the root: exit 0, no warnings in updates.ts.
- Timing, by hand: the reviewer's probe, `#for` of N rows each with `$memo(item + count)`, time of `count++` until the last row shows it, 5 clicks after a warm-up, happy-dom. The probe was not committed.

| rows  | origin/main | first head (09deb071) | this head         |
| ----- | ----------- | --------------------- | ----------------- |
| 1000  | 1.5-2.8 ms  | 5.2-8.8 ms            | 2.3-3.5 ms        |
| 4000  | 5.8-8.6 ms  | 59-90 ms              | 11-17 ms          |
| 10000 | 21-40 ms    | 378-649 ms            | 49-59 ms          |

- Not run: `pnpm bench`, `node e2e/run.mjs`.

## Size

Gzip -9. Base: this branch with main's updates.ts (main at 533c3919 plus this tree). Head: this branch.

- Todos app of benchmarks/brumate (`vite build`, all JS of dist/client): 27974-27978 to 28262 (+284 to +288, budget 300). Its core chunk: 9705-9707 to 9994 (+287 to +289). The other chunks move by a few bytes between builds, because they hold the hashed names of the chunks they import.
- The App chunk with its `g` table: 889 to 889.
- dist of `npx tsdown`: client 31718 to about 32670 (unminified), produce 4617 to 4617, client-routes 1841 to 1841.

Estimated L, actual L: no compiler change, but the depth order, the `$bind` pass and the load timing took several rounds.
