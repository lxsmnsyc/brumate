# Outcome: update-depth-guard

## Built

- `flushEffects` in packages/brumate/src/runtime/client/updates.ts counts rounds. Past 1000 rounds in one flush it sets `stuck`, so the next effect throws in place of running and the rest of that pass stops. The error goes through `fail` to the nearest `#try`, else to `onError` and the `brumate:error` event.
- One message for this limit and the existing 10000-round binding limit: `The effect e6 of DepthLoop_1vwqllt did not settle: it writes a value that it reads, and runs again without end. Wrap the read or the write in $untrack, or write only when the value changes [BRM187]`. Production: `Update loop <scope>:<name> [BRM187]`.
- BRM187 in error-catalog.ts, test/error-codes.json, both errors.md files, and a line in website/docs/effects.md. BRM186 is taken on feat/browser-async.
- Tests in resume.test.ts: an effect in a `#try` that runs `count++` (fixture depthLoop), and a child effect that calls its parent's writer with no `#try` (the O1 shape, fixtures depthLoopProp and DepthLoopChild). The fixtures cap the writes at 100000, so on main the tests fail in place of hanging.

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- The limit counts rounds inside one synchronous flush. A loop through a promise, such as `$resolve(memo).then(write)` that writes what the memo reads, starts a new flush each time and is not caught, as in Svelte 5 and React.
- The effect is named by its compiled name (`e6`) and the component id. The devtools Effects tab lists the same names.

## Proposed learnings

- A guard limit needs the deepest legitimate chain measured first | a probe in `drain` and `flushEffects` over the ui suite and e2e gave 3 effect rounds and 12 binding rounds | packages/brumate/src/runtime/client | no

## Verification

- Deepest legitimate chain, from a temporary probe: ui suite effects 3, bindings 12; e2e ui, todos, website, tracker effects 3 (/ui/date-range-picker), bindings 12. The limit of 1000 is 333 times the deepest.
- Server: effects never run there, signals are plain locals and the render is one pass, so no write re-renders and no loop of this kind can happen. No guard.
- `pnpm build`, `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (65 files pass), `pnpm --filter @brumate/ui test` (772 pass, 1 expected fail), `node e2e/run.mjs --only ui,todos,website` (55, 9, 72 pass).
- Bench todos: 14.9 kB gzip JS before load, same as main.

## Size

- Estimated S, actual S.
