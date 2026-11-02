# Opponent round 2 checks

## P11: does a branch that opens under the hidden body join the header Boundary?
origin/feat/browser-async waits.ts:
- :41 `let boundary` is module state; :44 `within(own, render)` sets it only for the length of a render; :60 `bound` and fillRange are the only callers.
- :98 `join()` counts in `boundary`, i.e. only the render that runs. Contract (client-pending-boundary.md): "A wait that starts outside such a render fills in place"; Changes v1 re-review: "`join` no longer walks held scopes".
- An #if that opens in an update during a drain (blocks.ts branch render) runs outside any `within`, so join() returns undefined (or the root boundary once browser-root-boundary lands) and the wait fills in place, under the hidden range.
- A plain `$memo(getX())` (no await) in that branch is not a wait at all: no join, empty text until it lands (async-data.md:158, memo-prop-browser-child #379).
So P11's "joins it" needs: updates of scopes under a header body to run inside `within(header)` (a scope -> boundary lookup per update or per wait), and a count for unvalued memos. Both change the frozen contract v1.

## P13: block-script $memo inside #key
evidence/opponent-key-memo.mjs -> opponent-key-memo.txt (compile from packages/brumate/dist, 2026-11-02 12:52): compiles. Client part r2 renders `const user = (getUser(id))` and the #loading body at once (`user.name` of a promise), so the idiom shows #else only after browser-loading-fallback lands. P13's inference holds, with that dependency.

## P10: header as a $isPending-like reader
updates.ts:253-259 startLoading triggers readers on entering loadingSlots; :530-537 the settle deletes the key and triggers (set, or trigger when waited). codegen/patch.ts:298 folds $isPending to false on the server. Holds: no new subscription.

## Hiding of a control that is being typed in
branches.ts createHiding hideNode: `style.setProperty('display','none','important')` on each top-level element of the body. An element with display:none loses focus (HTML focus fixup). updates.ts:262-295: $debounced/$throttled memos are pending (startLoading) for the whole wait.

## Round 3: direction of the $isPending dependency list (P18)
- model.ts:234-252 upstreamMemos(d): the memos and props that d reads, transitively (upstream).
- codegen/rewrite.ts:461: $isPending(m) reads [m, ...upstreamMemos(m)]; codegen/scopes.ts:176 skips those added reads (empty range) in awaitedMemos.
- async-data.md:115: "$isPending(count) is true while results loads, because count reads it" (upstream).
- P18 needs the other direction: for a named `user`, the memos that read it (posts). No list in model.ts or codegen gives readers of a memo; it is a new inverted walk over plan.graph.model.sites.
- With the existing list, a header that names the downstream memo (`#loading (posts)`) covers `user` through upstreamMemos(posts) as $isPending(posts) does.
