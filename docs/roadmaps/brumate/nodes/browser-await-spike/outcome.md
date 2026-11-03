# Outcome: browser-await-spike

Recommendation: option 3, with the root boundary. The compiler splits a browser render at each `await $memo` into a continuation. The runtime gets `wait`, `loading` and `hold`. A block outside every `#loading` keeps what it shows until its new body settles, as the server holds the page.

- **Prototype:** runs on the real client runtime, 13 tests pass, in both modes (fill in place and root boundary).
- **Todos (uses none of it):** 0 B. Raw JS is 35,467 B with and without the prototype (`pnpm bench`).
- **An app that uses it:** about +365 B gzip with the 2 insert sites the prototype changes, and an estimated +455 to +505 B with all 11. Fill in place costs +169 B (`wait`) or +305 B (with `loading`). The flag is per build, so one component that waits turns it on for every page of the app.

Gate: decided. The maintainer chose option 3, the root boundary, topological awaits on the server and in the browser, and the node list under "Proposed nodes". See "Decided".

## Built

- `prototype/option3.patch`: the option 3 prototype. `git apply` it on `feat/browser-async`, then run `npx vitest run test/_spike/await.test.ts` in `packages/brumate`.
  - `src/runtime/client/waits.ts`: `wait(scope, value, then)`, `loading(body, fallback, row?)` and `hold(render, show, stale)`. `wait` and `loading` are exported from `brumate/client`.
  - `src/runtime/client/branches.ts`: `branch` renders the new body through `hold` when `HAS_ROOT_WAIT` is on.
  - `src/runtime/client/lists.ts`: a new row renders through `loading` with an empty fallback when `HAS_ROOT_WAIT` is on.
  - `src/runtime/features.ts` and `src/features.ts`: the flag `__BRUMATE_HAS_ROOT_WAIT__`. The plugin turns it on when a compiled part of any component of the build calls `$$b.wait(`. `SPIKE_ROOT_WAIT=1` forces it on for the bench.
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

- **`branch`:** renders the new body through `hold` first, and sets the start comment to the new index. With no waits, the old body goes and the new one goes in. With waits, the old body stays. When they settle, the scopes of the old body are destroyed and the new body goes in. A switch back meanwhile changes the start comment, so `hold` drops the stale body.
- **Order of a swap (open for the build):** with the flag on, `hold` renders the new body before the old scopes are destroyed, also when nothing waits. Today `removeBlock` runs before the render. So on an app with the flag on, the cleanups of the old body run after the script of the new body. The suites pass, but no test covers this order. The build either keeps the old order when nothing waits (destroy first, render, and hold only when a wait shows up) or tests the new order.
- **B, A, B while B waits (open for the build):** `hold` compares only the start comment. The first B is dropped when A shows, and the second B renders again, so B loads twice (the review measured `[7, 7]`). The page ends right, with one user. The build can keep the held render of B and reuse it.
- **New `#for` rows:** render through `loading` with an empty fallback. A row that waits holds an item marker, `<!--i<row scope id>-->` and `<!--/i-->`, with nothing in it. The next update of the list finds the row by that marker and does not render it again. The row shows when its waits settle.
- **First render with nothing to keep:** an `#if` that opens from nothing, a new `#for` row, or a page that only the browser renders shows nothing until its waits settle. The server sends no markup in the same case, since it waits. A `#loading` is the way to show a fallback sooner.
- **Insert sites:** the 15 places that insert what a render returns, and which need `hold`:

  | Site                                                                 | File            | Needs `hold`                                                          | Prototype |
  | -------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------- | --------- |
  | `branch` (`#if`, `#switch`)                                          | `branches.ts`   | yes                                                                   | changed   |
  | New rows of `list` (also `windowList`, which calls it)               | `lists.ts`      | yes                                                                   | changed   |
  | `rekey` (`#key`, and `retag` for a dynamic tag, which calls it)      | `branches.ts`   | yes                                                                   | no        |
  | `reset` (the `reset` of `#try`)                                      | `branches.ts`   | yes                                                                   | no        |
  | `fill` (`#client`, which keeps its fallback until the body is ready) | `branches.ts`   | yes                                                                   | no        |
  | `offscreen`, the first show                                          | `branches.ts`   | yes                                                                   | no        |
  | The fallback of `list`                                               | `lists.ts`      | yes                                                                   | no        |
  | `catchInto` (the `#catch` body)                                      | `errors.ts`     | yes                                                                   | no        |
  | Late `children`                                                      | `children.ts`   | yes                                                                   | no        |
  | `content` (a value that renders)                                     | `inserts.ts`    | yes                                                                   | no        |
  | The portal insert                                                    | `inserts.ts`    | yes                                                                   | no        |
  | `place` and `componentNodes`                                         | `components.ts` | no: they run inside another render, whose boundary counts their waits | no        |
  | Template calls                                                       | `templates.ts`  | no: same, inside another render                                       | no        |
  | `replaceTry`                                                         | `errors.ts`     | no: it inserts HTML that the server rendered                          | no        |
  | `addHead` and `addPortal` HTML                                       | `page.ts`       | no: HTML, no render                                                   | no        |

- **Cost:** `HAS_ROOT_WAIT` is a flag per build, not per page. `buildFeatures` (`src/vite.ts:684`) joins the features of every component of the build into one core. The count follows the imports of the scanned files, packages included (`visit`, `src/vite.ts:690`), and `generateBundle` (`src/vite.ts:1853`) fails the build when a loaded component uses a feature that the count left out. So an app with no `await $memo` in a browser render pays nothing, and an app with one pays on every page.
  - Todos with the flag off: raw 35,467 and 35,468 B, gzip 14,819 and 14,820 B, the same as without the prototype.
  - Todos with the flag forced on: raw 36,000 and 36,001 B (+533 B), gzip 15,010 and 15,014 B (+190 to +195 B). That covers `hold`, `loading` and the 2 changed sites. With `wait` (+169 B), about +365 B.
  - The 9 sites left: an estimated 10 to 15 B gzip each, from the size of the `branch` change, so +90 to +140 B. About +455 to +505 B in all.
- **Compared to fill in place:** fill in place changes no insert site and costs +169 B (`wait`), or +305 B with `#loading`. Its siblings show before the component, and the old branch goes at once (test "fill in place: the old branch goes at once"). The root boundary costs about 150 to 200 B more than fill in place with `loading`, once all 11 sites have `hold`. It matches the server, and no half-rendered block shows.

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

- **Analysis:** for each awaited memo, the compiler takes the names that its expression reads (`site.reads`), and follows calls of script-local functions to the names those functions read. It splits the names into awaited memos and the rest.
- **Start point:** the load starts right after the last statement that mentions one of its non-memo names: a declaration, a write without a declaration (`q = props.x;`), a call that can change it (`params.set('a', 1);`), or a call of a local function that reads it. With none, it starts at the top of the script. A read of another awaited memo does not hold the start. The memo reads that memo as a memo, so the load chains.
- **Local functions:** a function declaration is hoisted, but the names it reads are not. `function f() { return n; }` with a memo of `f()` must not start before `let n = $signal(0)`, or the server throws a TDZ `ReferenceError`. Following the call to the names of `f` places the start after `n`.
- **Server output:** the `$$b.memo(...)` line of the memo moves to its start point, followed by `$$b.start($$p_x);`. At the original `await`, `awaitRun` emits the same `waitAll` or `ready` as today. `waitAll` stays as it is.
- **Server errors at the start point:** `start` must hold both kinds of error for the `await`. `ready` (`src/runtime/server.ts:1416`) rethrows a synchronous throw of the compute, which would fail the render at the start point, before the statements in between. `start` catches that throw and the rejection, and leaves the memo failed, so the `await` throws where the source has it. About 30 B on the server.
- **Browser output:** at the start point, `const $$w_x = $$b.started(load(id));` for a memo with no memo reads. A memo that reads awaited memos gets `const $$w_x = $$b.after([$$w_a], (a) => loadTags(a));`, which is `Promise.all` and `then`. At the original `await`, `return $$b.wait($$s1, $$w_x, (x) => { ... })`, or `waitAll($$s1, [$$w_x, $$w_y], (x, y) => { ... })` for a run.
- **Browser errors at the start point:** the load of a second `await` starts at the top, but its `wait` attaches a handler only inside the first continuation. A rejection before that is an `unhandledrejection`. `started` and `after` attach a handler where the load starts, and `wait` still gets the rejection. A synchronous throw of the expression is caught there too and turned into a rejected promise.
- **Browser size:** `after`, `started` and `waitAll` are about 50 B gzip together over `wait`. Each moved declaration adds about 20 B raw to the compiled part.
- **Limits:** a memo that reads a value computed from an earlier awaited memo still waits for it. In `const user = await $memo(a()); const q = user.id; const tags = await $memo(b(q));`, `b(q)` cannot start before `user` settles, because `q` reads `user`. Parent to child chains stay.
- **Order of side effects:** the load of a moved memo starts before the statements it moved over. Its expression runs earlier than the source shows. The docs must say so, since this is the point of the change. Statements other than awaited memo declarations do not move.
- **Statements that end a run today:** `endRun()` runs before the skip of `$effect`, `$client`, imports and type declarations (`src/codegen/markup.ts:748`). So those end a run, though they emit nothing on the server. The new rule fixes that. The server node tests that they no longer hold a later load.
- **decisions.md:27:** "A run of `await $memo` declarations loads at the same time" becomes "Each `await $memo` starts its load as soon as the values it reads are ready, and waits where it is declared." browser-await rewrites the sentence about the browser. topological-awaits-server changes this one.
- **Owner:** topological-awaits-server for the server and the shared analysis. browser-await-blocks reuses that analysis for the browser.

### What the build must fix that the prototype skips

- **`MARKER` names:** the start comments of `wait` and `loading` must match `MARKER`, or `rangeEnd` pairs them wrong and a closed block keeps markup. The prototype now uses `l<scope id>w` and `l0b`. `l0b` also matches `/^l\d/` in the `SWAP` script of the server (`src/runtime/server.ts:2289`), which counts depth. It pairs with `/l`, so it works today, but the build should pick names that no other code reads or counts. Take the review's probe into the tests: wait for the load, close the block, compare the DOM with the DOM before the open, reopen and check one user.
- **`rendered`:** the scope leaves `rendered` (`blocks.ts`) while it waits. Otherwise the insert of the markup around it runs its memos on a scope with no slots (`TypeError` on `user.name`, seen in the first run).
- **The slot value:** the rest must write the settled value into the memo's slot, not the promise. With the promise, `setSlots` marks it loading and `startLoading` runs the text updates with the promise.
- **The computed memo:** the memo of the awaited slot must count as computed, so the refresh of the new scope does not load it again. The prototype keeps the scope out of `rendered` for good, so the refresh skips its other memos too. The build needs a set of settled keys, next to `renderedLoads`.
- **Props during the wait:** the scope has no slots yet. The prefix should set the slots it has (props, signals, the memo as a promise in `loadingValues`). The rest then reads those slots again, and waits again if the memo slot holds a newer promise.
- **`#try` in a browser render:** a `t` entry or a runtime boundary, so `fail` finds it. Throws in the rest go to `fail`.
- **The other insert sites:** the 9 sites of the table above that the prototype did not change go through `hold`.
- **The order of a swap and B, A, B:** see "The root boundary".
- **Plain promises:** `generateRender` throws "only the server can render it" for a component that awaits a plain promise (`awaitsPromise`). `await $memo` is excluded from that check already. Option 3 could also wait on a plain promise later. Out of scope here.

## Compostate `toResult`

- **Internal read:** the client runtime has the three states already. A slot that holds a promise in `loadingValues` is pending, with the promise as the request. A `MemoError` is a failure. Anything else is a value. `wait` reads the slot through one internal function that returns these three cases, about 60 B. Then a memo that already failed goes to `#try` at once, once browser-try lands, and a value goes on in the same render. For option 1, `use` would be the throwing form of the same read.
- **No macro (the maintainer, 2026-11-01):** no `$result` macro, and no backlog outline for one. `$resolve` returns a promise, so `Promise.all`, `race`, `any` and `allSettled` cover what Compostate's `waitForAll` and `waitForNone` do. The internal three-way read in `wait` stays.
- **Guard over several memos:** a separate backlog node, is-pending-many: `$isPending(a, b, c)`, true while any of them loads. Not part of this story.

## Proposed nodes

Nodes 1 to 8 are on `feat/browser-async`, and topological-awaits-server is on `next`. The outlines browser-loading-fallback, promise-in-markup and loading-on stay, refined as below. The others are new.

- The root boundary splits out of browser-await as its own M node, browser-root-boundary, after browser-await.
- docs/decisions.md:27 goes to browser-await only. topological-awaits-server changes only the sentence about runs.
- browser-await-blocks reuses the analysis of topological-awaits-server, so it depends on that node merged forward into `feat/browser-async`.

1. **browser-await (M, must):** the compiler split for one `await $memo` in the instance script. Runtime: `wait` with the three-case read, the `MARKER` names, the `rendered`, slot-value and computed-memo fixes, props set before the wait, a second wait on a newer promise. Updates docs/decisions.md:27 and website/docs/async-data.md. Tests in `resume.test.ts`, gzip of todos from `pnpm bench`. Provides the contract `client-pending-boundary`: a boundary counts waits and runs `done` at 0, and keeps the `rendered` and `afterInsert` work of its body.
2. **browser-root-boundary (M):** `HAS_ROOT_WAIT`, `hold` at the 11 insert sites, the order of a swap, and B, A, B. Depends on browser-await.
3. **browser-await-blocks (M):** `await $memo` in block scripts and `#for` row scripts, `await` in markup, and the topological starts with `after`, `started` and `waitAll`. Depends on browser-await, and on topological-awaits-server merged forward for the analysis.
4. **browser-try (S):** a `t` entry, or a runtime boundary, for a `#try` that the browser renders, so a rejected wait and a throw in the rest of a render show its `#catch`. Tests with a component that awaits a rejected memo inside `#try` in an `#if`. Depends on browser-await.
5. **browser-loading-fallback (M):** compiles `#loading` in client mode to `$$b.loading(body, fallback)`, with `#reveal` order. Depends on browser-await (hard, for the contract). It can start once the contract is written.
6. **promise-in-markup (S):** a promise in text or an attribute of a browser render shows its value when it settles, and counts as a wait of the boundary. Depends on browser-await.
7. **loading-on (M):** `#loading (memo)` shows the fallback again while a named memo loads again, through the same boundary. Depends on browser-loading-fallback, and waits on the approval of docs/debates/loading-on-update/debate.md.
8. **browser-async-e2e (S):** the e2e cases of the story acceptance: an `#if` branch and a `#for` row that the browser renders, each with an awaited memo, a `#loading` fallback and a promise in text. Depends on browser-loading-fallback and promise-in-markup.
9. **topological-awaits-server (S, on `next`):** the start rule on the server, with the analysis that browser-await-blocks reuses: `start` after the last statement that mentions a non-memo read, `start` holding synchronous throws and rejections, `waitAll` unchanged, and the sentence about runs in docs/decisions.md:27. Tests that `$effect`, `$client`, imports and type declarations no longer end a run.

## Decisions for the maintainer

- **Option:** pick one of the three. The spike recommends option 3.
- **Without `#loading`:** the root boundary or fill in place. The spike recommends the root boundary. It matches the server, and its cost stays off apps that do not use `await` in a browser render.
  - Root boundary: about +455 to +505 B gzip on every page of an app that uses it, 0 B on other apps, `hold` at 11 insert sites.
  - Fill in place: +169 B (+305 B with `#loading`), no insert site changes, and siblings show before the waiting component.
- **Topological awaits:** take the start rule on the server too (node 9), so the browser and the server agree.

## Decided

- No `$result` macro and no outline for one (the maintainer, 2026-11-01). is-pending-many is a separate backlog node.
- After the second review, the maintainer chose option 3, the root boundary, topological awaits on both sides, and this node list. The coordinator writes the briefs. The "Decisions for the maintainer" above are kept as the record of the choice.

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
