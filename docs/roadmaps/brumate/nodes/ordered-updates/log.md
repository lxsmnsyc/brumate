# Log: ordered-updates

## 2026-10-27: plan

The 5 `it.fails` tests turned into `it` fail on main: `sum`, `label`, `both` and `shout` run twice, and the second `.grow` keeps `C`.

Order of a pass. A pass is the outermost `run` (running goes from 0 to 1), as for effects today. It stays one write for now: batching makes it a handler later.

1. A write queues the updates in `g` of its slot, keyed by scope and update, so each waits once. Memos go in one queue, bindings and block updates in another, effects in `pendingEffects` as now.
2. The outermost `run` runs the queued memo with the lowest rank, until none waits. The rank is the number in the name of the update, `m<site id>`. Sites are numbered in source order, and a memo is declared after the memos it reads, so the rank is a topological order inside a component. A memo that writes queues its readers, and a memo that is already queued stays in its place. So each memo computes once, after every memo it reads. If a rank were wrong, a memo would compute again with the new value: never a wrong value, only an extra run.
3. Then the bindings that wait, as one round in the order they were queued. Writes in the round, such as a prop of a child, queue memos and bindings for after the round. Then step 2 again, and so on until both queues are empty. So a child gets every new prop of the round before its memos compute.
4. Effects run after that, as now, once `running` is back at 0.

Memos stay eager: `set` returns after steps 2 to 4, so a handler that writes `count` and then reads `double` reads the new value.

- Async memos, `$debounced`, values the server streams and guesses write later, from a promise or a timer, with `running` at 0. Each starts a pass of its own. `startLoading` inside a memo queues the readers in the pass that runs.
- A `$bind` write from a child writes the slot of the child and of the parent in the same `set`, so both queue in the same pass.
- An effect that writes starts a pass of its own, as now, since effects run with `running` at 0.
- A queued update whose scope left the page in the pass (a block closed) does not run.
- A pass that throws drops what waits, as the loop of `run` did before.

No compiler change: `g` keeps its lists. The queues do what the transitive lists of the proposal would, without growing the tables.

## 2026-10-27: build

- The queues made 4 of the 5 pass. The child test still computed twice: on the first click, the update code of the child is not loaded, so each prop write waited on its own and ran as its own pass. Writes of one pass that wait now join one list and run as one pass.
- A first try joined every write that waits, also of separate clicks. That ran the `count++` and the `tab = 'a'` of the `#offscreen` test in one pass, so the effect of the body ran once it showed. Joining is now only for writes inside a pass. A second try made writes wait behind the waiting ones; that left memos stale in the ui parts (Slider `onChangeEnd` read the old value), so it is gone. The waiting path keeps the awaits of main, so the order of waiting writes is as before.
- ui: Transition "leaves the parent after its child" failed. On main, the effect of the child ran before the one of the parent, because a write ran its updates depth first. The pass now runs the effects of a later round before those of earlier rounds, which gives the same order.
- Size: todos +212 B gzip (27938 to 28150), budget 300.
