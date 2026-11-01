# Outcome: browser-await-spike

Recommendation: option 3. The compiler splits a browser render at each `await $memo` into a continuation, and the runtime gets two helpers, `wait` and `loading`. A prototype runs on the real client runtime and passes 4 tests. A page that does not use the helpers pays 5 B gzip (todos, `pnpm bench`). A page that uses both pays about 300 B gzip.

Gate: the maintainer picks one of the three options. The questions under "Decisions for the maintainer" need an answer before the other children of browser-async are refined.

## Built

- `prototype/option3.patch`: the option 3 prototype. `git apply` it on `feat/browser-async`, then run `npx vitest run test/_spike/await.test.ts` in `packages/brumate`.
  - `packages/brumate/src/runtime/client/waits.ts`: `wait(scope, value, then)` and `loading(body, fallback)`, exported from `brumate/client`.
  - `packages/brumate/test/_spike/await.test.ts`: compiles the fixtures in `prototype/`, edits the compiled code as the compiler would (`splitAtAwaits`, `wrapLoading`) and runs the pages in happy-dom with the loader.
- `prototype/*.brm` and `prototype/data.ts`: the fixtures. `User.brm` declares a signal, then `const user = await $memo(load(id))`, then a memo of `user`. `WithLoading.brm` renders it in an `#if` inside `#loading`, `NoLoading.brm` in an `#if` without `#loading`, `Rows.brm` in `#for` rows.
- `prototype/options-1-2.patch`: the code that the size numbers of options 1 and 2 come from. `option1-sketch.ts` holds `use()` and `retry()` of option 1. The `branches.ts` diff makes `branch`, `rekey`, `fill` and `offscreen` await an async render, as option 2 needs. `hops.test.ts` times async row renders.
- No product code changes. The branch holds only files under `docs/roadmaps/brumate/nodes/browser-await-spike/`.

## The problem, as the code has it

- `generateRender` (`src/codegen/render.ts`) compiles `const user = await $memo(load(id))` to `const user = (load(id));`. The rest of the render reads `user.name` of a promise.
- A browser render of `#loading` drops the block and renders its body (`case 'loading'` in `src/codegen/markup.ts`, client mode). The fallback is never compiled for the browser.
- Every render function is synchronous and returns `string | DocumentFragment`. About 15 places in `src/runtime/client/` insert what a render returns: `branches.ts` (5), `lists.ts` (3), `children.ts`, `templates.ts`, `errors.ts`, `inserts.ts`, `components.ts`.

## Comparison

|                                 | 1. Throw and run again                                              | 2. Async render functions                                                                                    | 3. Continuations at `await`                                                 |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Evidence                        | Sketch, measured size                                               | Partial patch, measured size and time                                                                        | Prototype, 4 tests pass                                                     |
| Codegen                         | `const x = $$b.use(() => load())`                                   | Every render `async`, every child render and `place` awaited                                                 | Code after the `await` moves into `$$b.wait(scope, load(), (x) => { ... })` |
| Runtime                         | `use` with a load cache by call order, `retry` at every insert site | Every insert site awaits and checks that the block did not change meanwhile; `list` reconciles in two phases | `wait` and `loading`, new exports. Insert sites unchanged                   |
| Gzip, helpers when used         | +225 B (`use` 105, `retry` 120), plus 10 call sites                 | +53 B for 4 of 15 sites; about +200 B for all, before the `list` rewrite                                     | +301 B (`wait` 167, `loading` 134)                                          |
| Gzip, todos (uses none)         | Pays `retry` in `list` unless a new feature flag strips it          | Pays: its rows render in the browser                                                                         | +5 B measured (14,824 B to 14,829 B)                                        |
| Script before the `await`       | Runs again on each rerun. Signals, `$client` and IDs are made again | Runs once                                                                                                    | Runs once                                                                   |
| Memo loads                      | Need a cache across reruns, or each rerun loads again               | Once                                                                                                         | Once (the test counts loads)                                                |
| k awaits in a row               | k + 1 runs of the whole insert unit                                 | One run, k waits                                                                                             | One run, k waits                                                            |
| Siblings of a waiting component | The throw stops the whole insert unit                               | Render, then wait                                                                                            | Render now, in place                                                        |
| `#try`                          | Every `try` in compiled code and in scripts must rethrow the token  | Rejection goes to `fail`                                                                                     | Rejection goes to `fail`                                                    |
| `pass` and the effect flush     | Insert of a rerun lands after the flush                             | Every browser insert lands after the flush of its update. Changes the order that ordered-updates fixed       | Only waiting renders insert later. Others keep the order                    |
| Time, 1,000 rows                | Twice the render for each rerun                                     | +0.05 ms per 1,000 async calls, +0.11 ms two levels deep (node 26); +5% in happy-dom with clones             | Unchanged when nothing waits                                                |

How the sizes were measured: `esbuild --bundle --minify` of an entry that exports the helpers of a page with a branch, a list and a child (`branch`, `list`, `place`, `componentNodes`, `memo`, `get`, `set`, `setSlots`, `createScope`, `clone`, `template`, `keepText`, `text`, `fail`), with and without the helpers of each option, then `gzip -9`. Base: 26,071 B raw, 10,254 B gzip. The todos numbers are `pnpm bench --only brumate --scenario todos --metrics browser`, JS before `load`, with the option 3 helpers exported (14,829 B) and without (14,824 B), on `6adea8fb`.

## Option 1: throw and run again

- A read of an awaited memo that is not settled throws a token with the promise. The insert site catches it, disposes the scopes the attempt made (`disposeKinds`, then clears `afterInsert` and `rendered`), waits, and renders again.
- Each rerun calls `load()` again unless a cache returns the promise of the last attempt. The scope is new on each attempt, so the cache must be keyed by call order. `use()` in `option1-sketch.ts` does this.
- The script before the `await` runs again. Nothing can observe the first run, since no markup or handler is in the page yet. The cost is the work, k + 1 runs for k awaits in a row, and new scope IDs on each run.
- `reset` in `branches.ts`, `catchInto` in `errors.ts` and any `try` in a script catch the token. Each must rethrow it.
- Todos pays for `retry` in `list`, unless a new feature flag such as `__BRUMATE_HAS_WAITS__` strips it.

## Option 2: async render functions

- A parent cannot know whether a child from another file awaits, so every render function must be async, and every parent awaits every child.
- Every insert site must await the render and then check that the block still shows the same body. `branch` compares `start.data`, `rekey` the key. `list` must render the new rows first and reconcile after, since the cursor moves while rows are awaited.
- Every browser insert lands after the flush of the update that started it. Effects and refs of the new markup then run in another order than today, which undoes what ordered-updates fixed.
- Time is not the cost: +0.05 ms per 1,000 awaited calls. The cost is the rewrite of the 15 insert sites, the order change, and bytes on every page with browser renders, todos included.

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

- `wait` with a settled value calls the rest at once, in the same render. With a promise, it returns a fragment of two comments, `<!--w-->` and `<!--/w-->`. When the promise settles, the rest renders and `insertHTML` puts its markup between them. The two comments stay, so a `#for` row keeps stable first and last nodes.
- `loading` renders the body with its own boundary, which counts the waits in it. With no waits, the body shows at once. Otherwise the fallback shows, and the body takes its place when the count reaches 0.
- Without `#loading`, the rest of the block shows at once, and the place of the waiting component fills when its memo settles. The prototype does this. See the decisions below.
- A block that removes the component while it waits drops the rest: `wait` checks `scopes.get(scope.id) === scope` and that the end comment is still in a parent.
- Components without `await` compile as today. Insert sites do not change.

What the tests show (`prototype/option3.patch`, 4 of 4 pass, 3 runs in a row):

- `#loading` shows `wait`, then the sibling `<p>` and the user together, and the fallback goes. `load` runs once. The `+` handler of the split component updates its text.
- Without `#loading`, the sibling shows first, the user fills in 150 ms later, and the handler works.
- An `#if` that closes while its child waits leaves no markup.
- Two `#for` rows, each with a waiting child, render in order, and each loads once.

### Answers to the questions of the brief

- `await` in a block or a `#for` row: the render of the block body or of the row splits the same way. A `<script>` in a block body is one more program that `generateRender` reads (`scope.body.script`). The row is the unit that waits. Its two comments keep its place among the other rows.
- `await` in markup, such as `{(await user).name}`: wait for the memo before the markup clones, as the server does for a `#loading` body (`awaitedMemos` in `emitLoading`). The compiler moves the wait to the start of the markup.
- Several awaits in a row: emit one `waitAll(scope, [a, b], (a, b) => ...)`, as the server starts every memo of a run and then calls `waitAll`. The prototype has one `await` only.
- `#loading`: counts the waits of the renders inside it, as the prototype shows. On an update, the shown body stays. A memo that loads again keeps its old value until it settles (`asyncMemo`), so nothing waits. Showing the fallback again on a named memo is loading-on.
- `#reveal`: each `loading` boundary in a `#reveal` shows its body only after the boundary before it. One promise chain per `#reveal`. Not prototyped.
- `#try`: a rejected memo calls `fail(scope, error)`, which renders the nearest `#catch` through the owners of the scope. The prototype routes it there, but no test covers it. A throw in the rest must go to `fail` too. The prototype does not do that yet.
- Server-rendered components: no change. The server waited, and the page state has the settled values.
- IDs: `createScope` runs before the `await`, so the parent's `c[anchor] = nextId` still names the child. Scopes made in the rest get later client IDs, which only need to be unique and negative.
- BRM182 and the runtime error of streamed-memo-reads: no markup and no handler of the component is in the page until the rest runs. A handler can then read an awaited memo only after it settled, so the BRM182 exemption holds in the browser too. The error stays for the other cases.

### What the build must fix that the prototype skips

- The scope leaves `rendered` (`blocks.ts`) while it waits. Otherwise the insert of the markup around it runs its memos on a scope with no slots (`TypeError` on `user.name`, seen in the first run).
- The rest must write the settled value into the memo's slot, not the promise. With the promise, `setSlots` marks it loading and `startLoading` runs the text updates with the promise.
- The memo of the awaited slot must count as computed, so the refresh of the new scope does not load it again. The prototype keeps the scope out of `rendered` for good, so the refresh skips its other memos too. The build needs a set of settled keys, next to `renderedLoads`.
- Props that the parent changes while the child waits: the scope has no slots yet. The prefix should set the slots it has (props, signals, the memo as a promise in `loadingValues`). The rest then reads those slots again, and waits again if the memo slot holds a newer promise.
- The `loading` boundary moves its held body into the page with `before()`. The scopes and `afterInsert` work of the body's first render are taken by the insert of the fallback. The boundary needs its own `rendered` and `afterInsert` lists, and one `insertHTML` of the body.
- `generateRender` throws "only the server can render it" for a component that awaits a plain promise (`awaitsPromise`). `await $memo` is excluded from that check already. Option 3 could also wait on a plain promise in the script later. Out of scope here.

## Compostate `toResult`

- Can a continuation or a rerun use such a read: yes. The client runtime has the three states already. A slot that holds a promise in `loadingValues` is pending, with the promise as the request. A `MemoError` is a failure. Anything else is a value. `wait` should read the slot through one internal function that returns these three cases, about 60 B. Then a memo that already failed goes to `#try` at once, and a value goes on in the same render. For option 1, `use` would be the throwing form of the same read, the inverse of Compostate, whose `toResult` catches `ResourceNotReadyError`.
- Is a `toResult`-like macro worth exposing beside `await` and `$isPending`: not now. With option 3, a handler in a browser render reads an awaited memo directly, and `$isPending` and `await $resolve` cover the other memos. The macro would add a third API, a BRM182 guard, docs and checker cases for one gain: the error as a value, without `try`. If users ask for that, it can be a backlog outline, such as `$result(memo)` returning `{ type: 'pending' | 'success' | 'failure' }`.

## Proposed nodes

All on `feat/browser-async`. The outlines browser-loading-fallback, promise-in-markup and loading-on stay, refined as below, and one node is new.

1. browser-await (new, M, must). Compiler: split the render at `await $memo` in the instance script, in block scripts, and for markup awaits; `waitAll` for a run of awaits. Runtime: `wait` with the three-case read, the `rendered` and settled-slot fixes, props set before the wait, a second wait on a newer promise, throws of the rest sent to `fail`. Without `#loading`, the place fills when the memo settles. Updates docs/decisions.md:27 and website/docs/async-data.md. Tests in `resume.test.ts`, gzip of todos from `pnpm bench`. Provides the boundary interface (contract `client-pending-boundary`: a boundary counts waits and runs `done` at 0).
2. browser-loading-fallback (M). Compiles `#loading` in client mode to `$$b.loading(body, fallback)`, with its own `rendered` and `afterInsert` lists, `#reveal` order and `#try` around it. Depends on browser-await (hard, for the contract). It can start once the contract is written.
3. promise-in-markup (S). A promise in text or an attribute of a browser render shows its value when it settles, and counts as a wait of the boundary. Depends on browser-await.
4. loading-on (M). `#loading (memo)` shows the fallback again while a named memo loads again, through the same boundary. Depends on browser-loading-fallback, and waits on the approval of docs/debates/loading-on-update/debate.md.
5. The e2e cases of the story acceptance (an `#if` branch and a `#for` row, each with an awaited memo, a `#loading` fallback and a promise in text) can go in each node, or in one S node after 2 and 3.

## Decisions for the maintainer

- Pick the option. The spike recommends 3.
- Without `#loading`, pick one. The spike recommends the first.
  - Fill the component's place when its memo settles. The prototype does this. Insert sites do not change, and siblings show first.
  - Hold the whole block until every wait in it settles, as the server holds the page. Every insert site changes, so every page pays bytes.
- A `toResult`-like macro: the spike recommends not exposing one in 0.5.0.

## Deviations

- Option 3 is a prototype on the real runtime, with the compiler output edited by regular expressions in the test. Options 1 and 2 are measured estimates: sketches whose size was measured, and a timing of async calls. The brief allows either.

## Stubs left

- The prototype is not on any shipping path. browser-await and browser-loading-fallback replace it.

## Gotchas

- `createScope` returns an ID, not the scope. `wait` takes `ScopeId` and calls `resolveScope`.
- `vi.waitFor` polls every 50 ms by default. With a 40 ms load the test missed the state before the memo settled. The fixture loads in 150 ms and the test polls every 10 ms.
- Run `pnpm --filter brumate build` before `pnpm bench`. The bench uses the built package.
- A page cleared while a wait is pending leaves the end comment with no parent. `wait` checks `end.parentNode`.

## Proposed learnings

- A browser render that waits keeps its scope out of `rendered` until the rest runs | the insert around it would run its memos on empty slots | packages/brumate/src/runtime/client | yes

## Verification

- `npx vitest run test/_spike/await.test.ts` with `option3.patch` applied: 4 passed, 3 runs in a row, no unhandled errors.
- `git apply --check` of both patches on `6adea8fb`: pass.
- `pnpm bench --only brumate --scenario todos --metrics browser`: 14,829 B gzip with the helpers exported, 14,824 B without.
- `pnpm lint` (warnings only, none in this node), `pnpm format:check` and `pnpm typecheck`: pass, after building `packages/tsc` and `packages/language-server` in the worktree.

## Size

- Estimated M, actual M.
