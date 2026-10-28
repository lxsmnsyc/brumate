# Outcome: handler-code-wait

## Built

- The compiler lists the handlers that write only the slots of their own component in a new table `w` of the client module (`export const w = ["h2", "h4"]`). `writesOwn` in `codegen/client.ts` checks the handler and, through its calls, the local functions it calls. A handler is not listed when it reads or writes a prop, a rest of props, a context, an import, a module binding, a template, an action, an error or a reset function, or when it sits in a template. It waits as before then.
- `updateReady(scope, handler)` in `client/updates.ts`: for a listed handler it loads only the update code of the module of its scope. Any other handler waits for the scope chain as before (scope, parents or owner, and the scope its children render in).
- A rejected load of a held write (`trigger`) sends the error to `fail(scope, error)` and runs the effects that waited (`flushEffects`). The load of a write that joins a pass that waits (`waiting`) reports its error the same way. Before, both stayed unhandled and the effects waited for the next pass.
- Order is unchanged: `handle` still chains on `lastHandler`.

## Deviations

- The contract `update-pass.md` is not changed: a handler still runs after the update code of the scopes it can write has loaded.
- `ClientModule` in `client/state.ts` gets `w?: string[]`. Compile snapshots of 20 fixtures and the inspect snapshot of todos changed by the `w` line.

## Stubs left

- None.

## Gotchas

- The rule is conservative on purpose. A wrong "wide" costs only the old wait. A wrong "own" would hold a write of a bound prop until after the handler returns, which stays correct but loses the single DOM write.
- A `#try` is in the `t` table only when its body has client code. The rejected-load test has a handler in the body for that.
- The test loader wraps modules with a `load(part)` to delay or reject the update part (`resumeParts` in the `a handler waits only for` tests). The usual `resume` helper loads whole modules.

## Proposed learnings

- A handler waits only for the update code of the scopes it can write | list own-component handlers in `w` | packages/brumate/src/codegen/client.ts | yes (waits only for tests)

## Verification

- Tests "a handler waits only for" in `packages/brumate/test/resume.test.ts`: 4 pass; all 4 fail on main.
- `npx vitest run` in packages/brumate, `npx oxfmt --check`, `npx oxlint` (warnings only), `npx tsc --noEmit`: pass.
- ui suite: 573 passed. `generics-markup.test.ts` (3 tests) fails in a worktree on main too, and passes in the main checkout.

## Size

todos, gzip of the client JS in dist: 28.1 kB before, 28.2 kB after by the harness (sum of gzip -9 per file: 28920 B before, 29014 B after, +94 B). Within 0.3 kB.

Estimated S, actual S.
