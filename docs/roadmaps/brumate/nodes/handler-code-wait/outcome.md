# Outcome: handler-code-wait

## Built

- The compiler lists the handlers that can write a slot of another component in a new table `w` of the client module (`export const w = ["h2"]`). It emits no table when there is none, so a page like todos pays nothing. `writesOwn` in `codegen/client.ts` checks the handler and, through its calls, the local functions it calls. A handler is listed when it reads or writes a prop, a rest of props, a context, an import (the wrappers of `brumate/events` do not count), a module binding, a template, an action, an error or a reset function, or when it sits in a template.
- `updateReady(scope, ref)` in `client/updates.ts`: a handler that is not in `w` loads the update code of its scope and of the root scope of its component (the same `update` part, so a signal of a block scope is covered). A listed handler waits for the scope chain as before (scope, parents or owner, and the scope its children render in).
- A rejected load of a held write (`trigger`) sends the error to `fail(scope, error)` and runs the effects that waited (`flushEffects`). The load of a write that joins a pass that waits (`waiting`) reports its error the same way (`fail`). Before, both stayed unhandled and the effects waited for the next pass.
- The error reaches the nearest `#try` when the failed chunk is not the update code of that `#try`'s own module. In the same module, `catchInto` loads the `update` part again, which holds the `#catch` body, and it fails again: the error is logged once (`console.error`, `onError`) and no `#catch` shows. Main does the same. A test pins it.
- Order is unchanged: `handle` still chains on `lastHandler`.

## Deviations

- The contract `update-pass.md` is not changed: a handler still runs after the update code of the scopes it can write has loaded.
- `ClientModule` in `client/state.ts` gets `w?: string[]`. Compile snapshots changed by the `w` line where a component has a listed handler.

## Stubs left

- None.

## Gotchas

- The rule is conservative on purpose. A wrong "wide" costs only the old wait. A wrong "own" would hold a write of a bound prop until after the handler returns: the result stays correct, but the single DOM write is lost, and the contract line "a handler runs after the update code of its scope has loaded" breaks for the parent's scope.
- An own handler loads the update code when its scope or the root scope of its component has readers. It does not look at the slots the handler writes, so it can load code that it does not need.
- A `#try` is in the `t` table only when its body has client code. The rejected-load test has a handler in the body for that.
- The test loader wraps modules with a `load(part)` to delay or reject the update part (`resumeParts` in the `a handler waits only for` tests). The usual `resume` helper loads whole modules.

## Proposed learnings

- A handler waits only for the update code of the scopes it can write | list the wide handlers in `w`, absent means own | packages/brumate/src/codegen/client.ts | yes (waits only for tests)

## Verification

- Tests "a handler waits only for" in `packages/brumate/test/resume.test.ts`: 7 pass. The 4 first fail on main; the block-scope and joined-load tests guard the new paths.
- Note, not done: narrow the own wait to the written slots. It needs the written slots in the table and costs bytes.
- `npx vitest run` in packages/brumate, `npx oxfmt --check`, `npx oxlint` (warnings only), `npx tsc --noEmit`: pass.
- ui suite: 573 passed. `generics-markup.test.ts` (3 tests) fails in a worktree on main too, and passes in the main checkout.

## Size

todos, gzip -9 per chunk of `dist/client`, base then branch: core 10587 to 10637 B (+50), App 887 to 889 B (+2), all JS 28921 to 28968 B (+47). At the brief's limit of 0.05 kB for the core. A first version, which listed the own handlers, cost +69 B in the core and +20 B in App.

Estimated S, actual S.
