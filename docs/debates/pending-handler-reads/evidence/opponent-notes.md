# Opponent round 1 notes (code reading on main 2bea4ee0)

## O1: update code reads a memo slot that holds its promise
- packages/brumate/test/.output/resume/search.brm.render.ts: browser render sets `results = search(query)` (a promise) and `setSlots($$s1, [query, results])`.
- runtime/client/components.ts:174-182 setSlots: a thenable slot goes into renderedLoads; the slot keeps the promise.
- runtime/client/updates.ts:358-362 memo(): first compute takes the rendered promise -> asyncMemo -> startLoading (updates.ts:213-218) -> trigger(scope, slot) while scope.s[slot] is still the promise.
- search.brm.client.update.ts b6: `$$b.list($$s, 2, $$b.listOf($$b.get($$s, 1)), ...)` runs from queue() (updates.ts:652-662), outside any memo compute or effect.
- On main get() returns the promise (updates.ts:47 only throws while computing) and listOf(promise) = Array.from(promise) = [] (lists.ts:28-30).
- Under P4 (throw for a loading-memo read outside memo compute/effect, no handling counter), b6 throws into #try at first load.

## O2/O7: the wait holds the global handler chain
- handlers.ts:229-236: `loaded = Promise.all([...])`, `started = lastHandler.then(() => loaded)`; lastHandler is module-global, reset only by resetHandler on navigation (handlers.ts:135-140).
- rpc.ts has an AbortSignal and no timeout. asyncMemo of an async iterable settles at the first item (updates.ts:292-310); documented at website/docs/async-data.md:231-255.
- server.ts:1270-1277 stateValue: a pending memo is a promise that resolves only when its record streams. Client: no code rejects pending state promises when the document finishes (only readyState uses: resume.ts:492, blocks.ts:191, boot.ts:486,520).

## O4: promise props and streamed promise signals
- runtime/client/props.ts:57-60: a promise prop loads as asyncMemo; the slot later holds the resolved value.
- runtime/client/resume.ts:225-233: every promise slot of a resumed scope is replaced by its value when it settles (and recorded in guesses.settled).
- website/docs/async-data.md:196-228 types the prop as Promise<...>; PR #352's async-data.md:131 says a promise in a signal or prop is an ordinary value.

## O6: $action submit does not queue behind handlers
- boot.ts:454-462: submit of a form with b-result calls submitAction directly, not handle().
- guesses.ts:56-66: guesses reset only when the last tracked server call finishes.

# Round 2

## O9: P10's load bound
- evidence/opponent-load-test/README.txt: Chromium fires no load event after a cut stream (42 s observed).
- navigate.ts:702-740: after client navigation the rest of the page streams through a fetch reader; window load fired long before, so a `load` race (proponent cap2.js: readyState=="complete" ? resolved) gives streamed slots of a navigated page no wait.

## O10: P9 lanes reorder handlers across components
- handlers.ts:229-236 main: one chain, event order for all handlers.
- website/ui/dialog.md:101: a form's onSubmit calls onSave, which writes the DialogTrigger's signal (a handler writing another component's state).
- handlers.ts:207-216: $bind writes are immediate and bypass the chain, so a waiting submit handler reads values typed after the submit.

## O11: P11 exemption paths
- insert.ts:62-79 refresh() runs update functions directly, outside queue(), with its own `refreshing` flag.
- children.ts:145-153: children whose code is not loaded render later from load().then(fill), outside the component render; their code reads parent slots through cells() getters (updates.ts:188-205 -> get()).
- handlers.ts:237 and references.ts:77: handlers and function-prop calls run inside pass(), so the counter must wrap the update run in queue() (updates.ts:659-662), not pass().
- devtools.ts reads no slot through get() (no import from updates.ts).

## O12: P12 and typed promise props
- async-data.md:221 types `user` as Promise<...>; props.ts:57-60 replaces it with the resolved object. No Awaited<> mapping in check.ts/analyze.ts (grep: none).

## O13: own-scope wait sizes (opponent-size)
