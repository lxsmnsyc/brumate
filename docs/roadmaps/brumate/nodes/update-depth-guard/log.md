# Log: update-depth-guard

- 2026-11-02: Read updates.ts. `drain` already stops binding rounds after 10000 (`stuck`, the refLoop test). `flushEffects` loops `while (pendingEffects.size > 0)` with no limit, so an effect that writes what it reads runs forever in one task.
- Failing test first: `depthLoop.brm`, an effect in a `#try` that runs `count++` while `count < 100000`. The cap ends the loop on main, so the test fails in place of hanging: on main it reaches 100000 runs in under 200 ms with no error. `depthLoopProp.brm` covers the O1 shape: a child effect calls its parent's writer through a function prop, with no `#try` around it.
- Measured the deepest legitimate chain with a temporary probe in `drain` and `flushEffects` (removed before commit):
  - ui suite (773 tests): effects 3 rounds, bindings 12 rounds.
  - e2e ui, todos, website, tracker (150 checks): effects 3 rounds (/ui/date-range-picker), bindings 12 rounds.
- Limit: 1000 rounds of effects in one flush, 333 times the deepest seen; Svelte 5 uses 1000. The binding limit stays at 10000.
- Design: `flushEffects` counts rounds and sets `stuck` before the pass of round 1001. The `later` wrapper already throws when `stuck` is set and stops the rest of the pass (`failed`), so the error goes through `fail` to the nearest `#try`, else onError and `brumate:error`. One message for both limits, BRM187, naming the effect or update and its component id.
- Server: effects never run on the server, signals are plain locals and the render is one pass from top to bottom. No write re-renders anything, so no loop of this kind exists there. No guard.
- Out of scope: a loop through `await` or a promise (an effect that writes after an awaited value) starts a new flush each time, as in Svelte 5 and React; the counter does not see it.
