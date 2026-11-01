# Outcome: browser-await-spike

Recommendation: option 3, with the root boundary. The compiler splits a browser render at each `await $memo` into a continuation. The runtime gets `wait`, `loading` and `hold`. A block outside every `#loading` keeps what it shows until its new body settles, as the server holds the page.

- **Prototype:** runs on the real client runtime, 13 tests pass, in both modes (fill in place and root boundary).
- **Todos (uses none of it):** 0 B. Raw JS is 35,467 B with and without the prototype (`pnpm bench`).
- **A page that uses it:** about +365 B gzip. Fill in place costs +169 B (`wait`) or +305 B (with `loading`).

Gate: the maintainer picks the option. The open questions are under "Decisions for the maintainer". Answer them before the other children of browser-async are refined.

## Built

- `prototype/option3.patch`: the option 3 prototype. `git apply` it on `feat/browser-async`, then run `npx vitest run test/_spike/await.test.ts` in `packages/brumate`.
  - `src/runtime/client/waits.ts`: `wait(scope, value, then)`, `loading(body, fallback, row?)` and `hold(render, show, stale)`. `wait` and `loading` are exported from `brumate/client`.
  - `src/runtime/client/branches.ts`: `branch` renders the new body through `hold` when `HAS_ROOT_WAIT` is on.
  - `src/runtime/client/lists.ts`: a new row renders through `loading` with an empty fallback when `HAS_ROOT_WAIT` is on.
  - `src/runtime/features.ts` and `src/features.ts`: the flag `__BRUMATE_HAS_ROOT_WAIT__`. The plugin turns it on when a compiled part calls `$$b.wait(`. `SPIKE_ROOT_WAIT=1` forces it on for the bench.
  - `test/_spike/await.test.ts`: compiles the fixtures in `prototype/`, edits the compiled code as the compiler would (`splitAtAwaits`, `wrapLoading`), and runs the pages in happy-dom with the loader. The test sets the flag before the core loads.
- `prototype/*.brm` and `prototype/data.ts`: the fixtures. `User.brm` declares a signal, then `const user = await $memo(load(id))`, then a memo of `user`. The load takes 150 ms. `User.brm` is rendered by:
  - `WithLoading.brm`: in an `#if`, inside `#loading`.
  - `NoLoading.brm`: in an `#if`, without `#loading`.
  - `Switch.brm`: in the `#if` branch of an `#if`/`#else`, without `#loading`.
  - `Rows.brm`: in `#for` rows.
- `prototype/options-1-2.patch`: the code that the numbers of options 1 and 2 come from. `option1-sketch.ts` holds `use()` and `retry()` of option 1. The `branches.ts` diff makes `branch`, `rekey`, `fill` and `offscreen` await an async render, as option 2 needs. `hops.test.ts` times async row renders.
- No product code changes. The branch holds only files under `docs/roadmaps/brumate/nodes/browser-await-spike/`.

## The problem, as the code has it

- `generateRender` (`src/codegen/render.ts`) compiles `const user = await $memo(load(id))` to `const user = (load(id));`. The rest of the render reads `user.name` of a promise.
- A browser render of `#loading` drops the block and renders its body (`case 'loading'` in `src/codegen/markup.ts`, client mode). The fallback is never compiled for the browser.
- In client mode, `#try` compiles to an inline `try`/`catch` around the render, and the module has no `t` table entry for it. `fail` finds no `#try` for an error that arrives later.
- Every render function is synchronous and returns `string | DocumentFragment`. About 15 places in `src/runtime/client/` insert what a render returns: `branches.ts` (5), `lists.ts` (3), `children.ts`, `templates.ts`, `errors.ts`, `inserts.ts`, `components.ts`.

## Comparison

|                                 | 1. Throw and run again                                              | 2. Async render functions                                                                                    | 3. Continuations at `await`                                                                                             |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Evidence                        | Sketch, measured size                                               | Partial patch, measured size, time and tests                                                                 | Prototype, 13 tests pass                                                                                                |
| Codegen                         | `const x = $$b.use(() => load())`                                   | Every render `async`, every child render and `place` awaited                                                 | Code after the `await` moves into `$$b.wait(scope, load(), (x) => { ... })`                                             |
| Runtime                         | `use` with a load cache by call order, `retry` at every insert site | Every insert site awaits and checks that the block did not change meanwhile; `list` reconciles in two phases | `wait` and `loading`. `hold` in the insert sites for the root boundary                                                  |
| Gzip, helpers when used         | +225 B (`use` 105, `retry` 120), plus 10 call sites                 | +53 B for 4 of 15 sites; about +200 B for all, before the `list` rewrite                                     | +169 B (`wait`), +305 B (with `loading`), about +365 B with the root boundary                                           |
| Gzip, todos (uses none)         | Pays `retry` in `list` unless a new feature flag strips it          | Pays: its rows render in the browser                                                                         | 0 B (raw 35,467 B both ways)                                                                                            |
| Script before the `await`       | Runs again on each rerun. Signals, `$client` and IDs are made again | Runs once                                                                                                    | Runs once                                                                                                               |
| Memo loads                      | Need a cache across reruns, or each rerun loads again               | Once                                                                                                         | Once (the tests count loads)                                                                                            |
| k awaits in a row               | k + 1 runs of the whole insert unit                                 | One run, k waits                                                                                             | One run, k waits                                                                                                        |
| Siblings of a waiting component | The throw stops the whole insert unit                               | Render, then wait                                                                                            | Render now. They show with the component (root boundary) or before it (fill in place)                                   |
| `#try`                          | Every `try` in compiled code and in scripts must rethrow the token  | Needs the browser `#try` work of option 3                                                                    | Needs a `t` entry or a runtime boundary for a browser-rendered `#try`                                                   |
| `pass` and the effect flush     | Insert of a rerun lands after the flush                             | Breaks the `flush()` contract of batching: 2 of 414 `resume.test.ts` tests fail                              | Only waiting renders insert later. `resume.test.ts`, `order.test.ts` and `batch.test.ts` pass with the root boundary on |
| Time, 1,000 rows                | Twice the render for each rerun                                     | +0.05 ms per 1,000 async calls, +0.11 ms two levels deep (node 26); +5% in happy-dom with clones             | Unchanged when nothing waits                                                                                            |

How the sizes were measured:

- Helpers: `esbuild --bundle --minify` of an entry that exports the helpers of a page with a branch, a list and a child (`branch`, `list`, `place`, `componentNodes`, `memo`, `get`, `set`, `setSlots`, `createScope`, `clone`, `template`, `keepText`, `text`, `fail`), with and without the helpers of each option, then `gzip -9`. Base: 26,071 B raw, 10,254 B gzip. The review measured `wait` +169 B and both +305 B on the same entry.
- Todos: `pnpm bench --only brumate --scenario todos --metrics browser`, JS before `load`, on `6adea8fb`. Raw is 35,467 B with the helpers exported and without. Gzip differs by 2 to 5 B between runs, from the hashes in chunk names.
- Root boundary: the same bench, with the flag off (detected, todos calls no `wait`) and forced on (`SPIKE_ROOT_WAIT=1`). Two runs each.

## Option 1: throw and run again

- A read of an awaited memo that is not settled throws a token with the promise. The insert site catches it, disposes the scopes the attempt made, waits, and renders again.
- Each rerun calls `load()` again unless a cache returns the promise of the last attempt. The scope is new on each attempt, so the cache must be keyed by call order. `use()` in `option1-sketch.ts` does this.
- The script before the `await` runs again. Nothing can observe the first run, since no markup or handler is in the page yet. The cost is the work, k + 1 runs for k awaits in a row, and new scope IDs on each run.
- The sketch's `retry` empties `rendered` and `afterInsert`, which drops the work of other inserts of the same pass. A working version keeps marks to cut back to, a few more bytes on top of +120 B.
- `reset` in `branches.ts`, `catchInto` in `errors.ts` and any `try` in a script catch the token. Each must rethrow it.
- Todos pays for `retry` in `list`, unless a feature flag strips it.

## Option 2: async render functions

- A parent cannot know whether a child from another file awaits, so every render function must be async, and every parent awaits every child.
- Every insert site must await the render and then check that the block still shows the same body. `branch` compares `start.data`, `rekey` the key. `list` must render the new rows first and reconcile after, since the cursor moves while rows are awaited.
- Every browser insert lands one microtask after the update that started it. With the `branches.ts` hunks of `options-1-2.patch` applied, 412 of 414 `resume.test.ts` tests pass. The 2 that fail are the batching tests "flush() runs the waiting bindings at once" and "flush() sees the DOM when the update code loads at the same time as the handler". `flush()` no longer shows the new markup. The diamond tests of ordered-updates still pass.
- Time is not the cost: +0.05 ms per 1,000 awaited calls. The cost is the rewrite of the 15 insert sites, the broken `flush()` contract, and bytes on every page with browser renders, todos included.

## Option 3: continuations at `await` (recommended)

What the compiler emits, as `splitAtAwaits` in the test does by hand:

```ts
export default function User($$props) {
  const $$s1 = $$b.createScope(1, undefined, "User_1co0zon");
  const { id } = $$b.unbind($$props, ["id"], undefined, $$b.sink($$s1));
  let n = (0);
  return $$b.wait($$s1, (load(id)), (user) => {
    const upper = (user.name.toUpperCase());
    const $$e = $$b.clone($$t0), $$f = $$e[4];
    // ... the markup, as today
    $$b.setSlots($$s1, [id, n, user, upper]);
    return $$f;
  });
}
```

- `wait` with a settled value calls the rest at once, in the same render. With a promise, it returns a fragment of two comments, `<!--l<scope id>w-->` and `<!--/w-->`. When the promise settles, the rest renders and `insertHTML` puts its markup between them. The two comments stay, so a `#for` row keeps stable first and last nodes.
- The start comments must match `MARKER` (`/^[btilP]-?\d/` in `blocks.ts`). `rangeEnd` ends a range at any comment that starts with `/`, but counts only start comments that match `MARKER`. The first prototype used `<!--w-->`, so a block that closed stopped at the first `<!--/w-->` and kept the rest of its markup.
- `loading` renders the body with its own boundary, which counts the waits in it. With no waits, the body shows at once. Otherwise the fallback shows between `<!--l0b-->` and `<!--/l-->`, and the body takes its place when the count reaches 0. The boundary keeps the `rendered` scopes and `afterInsert` work of the body until then, and inserts the body with one `insertHTML`.
- A block that removes the component while it waits drops the rest. `wait` checks `scopes.get(scope.id) === scope` and that the end comment is still in a parent. `loading` checks its end comment.
- Components without `await` compile as today.

### The root boundary

The server holds the whole page outside every `#loading`. The root boundary does the same in the browser. A block outside every `#loading` that renders a new body on an update keeps what it shows until every wait in the new body settles.

- **`branch`:** renders the new body through `hold` first, and sets the start comment to the new index. With no waits, the old body goes and the new one goes in, as today. With waits, the old body stays. When they settle, the scopes of the old body are destroyed and the new body goes in. A switch back meanwhile changes the start comment, so `hold` drops the stale body.
- **New `#for` rows:** render through `loading` with an empty fallback. A row that waits holds an item marker, `<!--i<row scope id>-->` and `<!--/i-->`, with nothing in it. The next update of the list finds the row by that marker and does not render it again. The row shows when its waits settle.
- **First render with nothing to keep:** an `#if` that opens from nothing, a new `#for` row, or a page that only the browser renders shows nothing until its waits settle. The server sends no markup in the same case, since it waits. A `#loading` is the way to show a fallback sooner.
- **Insert sites:** the prototype changes 2 of the 15, `branch` (+20 lines) and the row render of `list` (+3 lines). `rekey`, `fill`, `offscreen`, `reset`, the list fallback, `catchInto` and the inserts of `children.ts` and `templates.ts` need the same `hold` wrapper.
- **Cost:** `HAS_ROOT_WAIT` strips all of it from a page whose parts call no `$$b.wait(`. Todos with the flag off: raw 35,467 and 35,468 B, gzip 14,819 and 14,820 B, the same as without the prototype. Todos with the flag forced on: raw 36,000 and 36,001 B (+533 B), gzip 15,010 and 15,014 B (+190 to +195 B). That covers `hold`, `loading` and the 2 changed sites. `wait` adds 169 B on a page that calls it, so about +365 B in all. The other 7 sites add an estimated 60 to 100 B more.
- **Compared to fill in place:** fill in place changes no insert site and costs +169 B (`wait`), or +305 B with `#loading`. Its siblings show before the component, and the old branch goes at once (test "fill in place: the old branch goes at once"). The root boundary costs about 60 B more than fill in place with `loading`, plus the 7 sites left. It matches the server, and no half-rendered block shows.

### What the tests show

`prototype/option3.patch`, 13 of 13 pass, 3 runs in a row. Each of the first 4 runs in both modes:

- **`#loading`:** shows `wait`, then the sibling `<p>` and the user together, and the fallback goes. `load` runs once, and the `+` handler of the split component updates its text.
- **`#loading` closed during the fallback:** after 300 ms, past the load, the closed block holds no markup. Opening it again shows one user.
- **`#if` closed while its child waits:** after 300 ms the block holds no markup. Opening it again shows one user.
- **`#for` rows:** two rows, each with a waiting child, render in order, and each loads once.
- **Fill in place:** without `#loading`, the sibling shows first, and the user fills in after the load. The old branch of `Switch.brm` goes at once.
- **Root boundary:** without `#loading`, the sibling and the user show together after the load. The old branch of `Switch.brm` stays until the new one is ready. A switch back while the new branch waits keeps one old branch, and the held body never shows.
- **Root boundary in the whole suite:** with the flag on, `test/resume.test.ts`, `test/order.test.ts` and `test/batch.test.ts` pass, 426 of 426.

### Answers to the questions of the brief

- **`await` in a block or a `#for` row:** the render of the block body or of the row splits the same way. A `<script>` in a block body is one more program that `generateRender` reads (`scope.body.script`). The row is the unit that waits, and its comments keep its place among the other rows.
- **`await` in markup, such as `{(await user).name}`:** wait for the memo before the markup clones, as the server does for a `#loading` body (`awaitedMemos` in `emitLoading`). The compiler moves the wait to the start of the markup.
- **Several awaits:** see "Topological awaits" below. The prototype has one `await` only.
- **`#loading`:** counts the waits of the renders inside it, as the prototype shows. On an update, the shown body stays. A memo that loads again keeps its old value until it settles (`asyncMemo`), so nothing waits. Showing the fallback again on a named memo is loading-on.
- **`#reveal`:** each `loading` boundary in a `#reveal` shows its body only after the boundary before it. One promise chain per `#reveal`. Not prototyped.
- **`#try`:** a rejected wait calls `fail(scope, error)`, but a `#try` that the browser renders has no `t` entry, so `fail` reports the error as unhandled. The page keeps the empty range (probe in the review). The build needs a `t` entry for a browser-rendered `#try`, or a runtime boundary like `loading`, with a test. A throw in the rest of a render must go to `fail` too. The prototype does neither.
- **Server-rendered components:** no change. The server waited, and the page state has the settled values. The review checked one more case: a server-rendered `User` resumes, its handler works, then its `#if` closes and opens and renders it in the browser through `wait`.
- **IDs:** `createScope` runs before the `await`, so the parent's `c[anchor] = nextId` still names the child. Scopes made in the rest get later client IDs, which only need to be unique and negative.
- **BRM182 and the runtime error of streamed-memo-reads:** no markup and no handler of the component is in the page until the rest runs. A handler can then read an awaited memo only after it settled, so the BRM182 exemption holds in the browser too. The error stays for the other cases.

### Topological awaits

Today a run of adjacent `await $memo` declarations starts together, and any other statement ends the run. The proposal: each awaited memo starts as soon as its inputs are ready, even across statements. Code between awaits still runs once and in order. Only the memo loads start earlier. The wait stays where the `await` is.

What the server does today (`emitStatements` and `awaitRun` in `src/codegen/markup.ts`, `memo`, `read` and `waitAll` in `src/runtime/server.ts`):

- `$$b.memo(...)` makes an idle memo where the declaration is. It computes on its first `read` or `ready`.
- In a run, `waitAll([$$p_a, $$p_b])` calls `ready` on each. A memo that reads another memo of the run throws `NotReady`, and computes again when that load settles. So a run is topological already: independent memos start at once, a child starts when its parent settles.
- A statement between two awaits ends the run. `const user = await $memo(a()); let n = $signal(0); const tags = await $memo(b());` waits for `user` before `b()` starts, though `b()` reads nothing of `user`. docs/decisions.md:27, "A run of `await $memo` declarations loads at the same time", describes this rule.

The change, the same on the server and in the browser:

- **Analysis:** for each awaited memo, the compiler takes the declarations that its expression reads (`site.reads`). It splits them into awaited memos and the rest.
- **Start point:** the memo starts right after the last statement that defines one of its non-memo reads, or at the top of the script when there is none. A read of another awaited memo does not hold the start. The memo reads that memo as a memo, so the load chains.
- **Server output:** the `$$b.memo(...)` line of the memo moves to its start point, followed by `$$b.start($$p_x);`. `start` calls `ready` and catches its rejection, about 30 B on the server. At the original `await`, `awaitRun` emits the same `waitAll` or `ready` as today. `waitAll` stays as it is.
- **Browser output:** at the start point, `const $$w_x = load(id);` for a memo with no memo reads. A memo that reads awaited memos gets `const $$w_x = $$b.after([$$w_a], (a) => loadTags(a));`, which is `Promise.all` and `then`. At the original `await`, `return $$b.wait($$s1, $$w_x, (x) => { ... })`, or `waitAll($$s1, [$$w_x, $$w_y], (x, y) => { ... })` for a run. `after` and `waitAll` are about 40 B gzip together over `wait`. Each moved declaration adds about 20 B raw to the compiled part.
- **Limits:** a memo that reads a value computed from an earlier awaited memo still waits for it. In `const user = await $memo(a()); const q = user.id; const tags = await $memo(b(q));`, `b(q)` cannot start before `user` settles, because `q` reads `user`. Parent to child chains stay. A memo whose expression calls a function declared later in the script keeps its place.
- **Order of side effects:** the load of a moved memo starts before the statements it moved over. Its expression runs earlier than the source shows. The docs must say so, since this is the point of the change. Statements other than awaited memo declarations do not move.
- **decisions.md:27:** "A run of `await $memo` declarations loads at the same time" becomes "Each `await $memo` starts its load as soon as the values it reads are ready, and waits where it is declared."
- **Owner:** browser-await-blocks (below) for the browser, and one S node for the server, so both follow the same rule.

### What the build must fix that the prototype skips

- **`MARKER` names:** the start comments of `wait` and `loading` must match `MARKER`, or `rangeEnd` pairs them wrong and a closed block keeps markup. The prototype now uses `l<scope id>w` and `l0b`. The build should pick names that no other code reads, and add a test that closes a block after the load settles.
- **`rendered`:** the scope leaves `rendered` (`blocks.ts`) while it waits. Otherwise the insert of the markup around it runs its memos on a scope with no slots (`TypeError` on `user.name`, seen in the first run).
- **The slot value:** the rest must write the settled value into the memo's slot, not the promise. With the promise, `setSlots` marks it loading and `startLoading` runs the text updates with the promise.
- **The computed memo:** the memo of the awaited slot must count as computed, so the refresh of the new scope does not load it again. The prototype keeps the scope out of `rendered` for good, so the refresh skips its other memos too. The build needs a set of settled keys, next to `renderedLoads`.
- **Props during the wait:** the scope has no slots yet. The prefix should set the slots it has (props, signals, the memo as a promise in `loadingValues`). The rest then reads those slots again, and waits again if the memo slot holds a newer promise.
- **`#try` in a browser render:** a `t` entry or a runtime boundary, so `fail` finds it. Throws in the rest go to `fail`.
- **The other insert sites:** `rekey`, `fill`, `offscreen`, `reset`, the list fallback, `catchInto`, `children.ts` and `templates.ts` go through `hold`.
- **Plain promises:** `generateRender` throws "only the server can render it" for a component that awaits a plain promise (`awaitsPromise`). `await $memo` is excluded from that check already. Option 3 could also wait on a plain promise later. Out of scope here.

## Compostate `toResult`

- **Internal read:** the client runtime has the three states already. A slot that holds a promise in `loadingValues` is pending, with the promise as the request. A `MemoError` is a failure. Anything else is a value. `wait` reads the slot through one internal function that returns these three cases, about 60 B. Then a memo that already failed goes to `#try` at once, and a value goes on in the same render. For option 1, `use` would be the throwing form of the same read.
- **No macro (the maintainer, 2026-11-01):** no `$result` macro, and no backlog outline for one. `$resolve` returns a promise, so `Promise.all`, `race`, `any` and `allSettled` cover what Compostate's `waitForAll` and `waitForNone` do. The internal three-way read in `wait` stays.
- **Guard over several memos:** a separate backlog node, is-pending-many: `$isPending(a, b, c)`, true while any of them loads. Not part of this story.

## Proposed nodes

All on `feat/browser-async`. The outlines browser-loading-fallback, promise-in-markup and loading-on stay, refined as below. browser-await, browser-await-blocks, browser-try and browser-async-e2e are new, and topological-awaits-server is new on `next`.

1. **browser-await (M, must):** the compiler split for one `await $memo` in the instance script. Runtime: `wait` with the three-case read, the `MARKER` names, the `rendered`, slot-value and computed-memo fixes, props set before the wait, a second wait on a newer promise. The root boundary or fill in place, as the maintainer picks, with `HAS_ROOT_WAIT` and `hold` at all 15 insert sites. Updates docs/decisions.md:27 and website/docs/async-data.md. Tests in `resume.test.ts`, gzip of todos from `pnpm bench`. Provides the contract `client-pending-boundary`: a boundary counts waits and runs `done` at 0, and keeps the `rendered` and `afterInsert` work of its body.
2. **browser-await-blocks (M):** `await $memo` in block scripts and `#for` row scripts, `await` in markup, and the topological starts with `after` and `waitAll`. Depends on browser-await.
3. **browser-try (S):** a `t` entry, or a runtime boundary, for a `#try` that the browser renders, so a rejected wait and a throw in the rest of a render show its `#catch`. Tests with a component that awaits a rejected memo inside `#try` in an `#if`. Depends on browser-await.
4. **browser-loading-fallback (M):** compiles `#loading` in client mode to `$$b.loading(body, fallback)`, with `#reveal` order. Depends on browser-await (hard, for the contract). It can start once the contract is written.
5. **promise-in-markup (S):** a promise in text or an attribute of a browser render shows its value when it settles, and counts as a wait of the boundary. Depends on browser-await.
6. **loading-on (M):** `#loading (memo)` shows the fallback again while a named memo loads again, through the same boundary. Depends on browser-loading-fallback, and waits on the approval of docs/debates/loading-on-update/debate.md.
7. **browser-async-e2e (S):** the e2e cases of the story acceptance: an `#if` branch and a `#for` row that the browser renders, each with an awaited memo, a `#loading` fallback and a promise in text. Depends on browser-loading-fallback and promise-in-markup.
8. **topological-awaits-server (S):** the same start rule on the server: `start` after the last non-memo read, `waitAll` unchanged, and the docs/decisions.md:27 wording. It can run beside browser-await-blocks, and they share the analysis.

## Decisions for the maintainer

- **Option:** pick one of the three. The spike recommends option 3.
- **Without `#loading`:** the root boundary or fill in place. The spike recommends the root boundary. It matches the server, and its cost stays off pages that do not use `await` in the browser.
  - Root boundary: about +365 B gzip on a page that uses it, 0 B on other pages, `hold` at the 15 insert sites.
  - Fill in place: +169 B (+305 B with `#loading`), no insert site changes, and siblings show before the waiting component.
- **Topological awaits:** take the start rule on the server too (node 8), so the browser and the server agree.

## Decided

- No `$result` macro and no outline for one (the maintainer, 2026-11-01). is-pending-many is a separate backlog node.

## Deviations

- Option 3 is a prototype on the real runtime, with the compiler output edited by regular expressions in the test. Options 1 and 2 are measured estimates: sketches whose size was measured, and a timing of async calls. The brief allows either.
- The root boundary and topological awaits were not in the brief. The maintainer asked for both on 2026-11-01. The root boundary is prototyped. Topological awaits is a design with a size estimate.

## Stubs left

- The prototype is not on any shipping path. browser-await, browser-await-blocks, browser-try and browser-loading-fallback replace it.

## Gotchas

- `createScope` returns an ID, not the scope. `wait` takes `ScopeId` and calls `resolveScope`.
- `rangeEnd` ends a range at any comment that starts with `/`. Every new start comment must match `MARKER`.
- A list finds its rows by `<!--i<id>-->` comments or `b-b` elements. A row that waits must keep an item marker, or the next update renders it again and loads again.
- esbuild does not fold a feature constant across modules, so its sizes with `--define` for the flag are the same both ways. Measure the flag with the bench, which builds with Vite.
- `vi.waitFor` polls every 50 ms by default. The fixture loads in 150 ms, and the test polls every 10 ms and checks closed blocks after 300 ms.
- Run `pnpm --filter brumate build` before `pnpm bench`. The bench uses the built package.

## Proposed learnings

- A browser render that waits keeps its scope out of `rendered` until the rest runs | the insert around it would run its memos on empty slots | packages/brumate/src/runtime/client | yes
- A comment that opens a range must match `MARKER` | `rangeEnd` ends at any `/` comment but counts only `MARKER` starts | packages/brumate/src/runtime/client | yes

## Verification

- `npx vitest run test/_spike/await.test.ts` with `option3.patch` applied: 13 passed, 3 runs in a row, no unhandled errors.
- `npx vitest run test/resume.test.ts test/order.test.ts test/batch.test.ts` with `option3.patch` applied and the flag on: 426 passed.
- `git apply --check` of both patches on `6adea8fb`: pass.
- `pnpm bench --only brumate --scenario todos --metrics browser`:
  - Helpers exported, before the flag (first round): gzip 14,829 B, and 14,824 B without. The review measured raw 35,467 B both ways.
  - Root boundary flag off: raw 35,468 / 35,467 B, gzip 14,819 / 14,820 B.
  - Root boundary flag forced on: raw 36,001 / 36,000 B, gzip 15,010 / 15,014 B.
- `pnpm lint` (warnings only, none in this node), `pnpm format:check` and `pnpm typecheck`: pass, after building `packages/tsc` and `packages/language-server` in the worktree.

## Size

- Estimated M, actual L. The review round added the root boundary prototype and the topological design.
