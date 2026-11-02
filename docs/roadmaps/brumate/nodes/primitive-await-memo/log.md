# Log: primitive-await-memo

## 2026-11-02

- Branch fix/primitive-await-memo from origin/main 4466ac70.
- The browser render compiles a memo with `await` inside to an async IIFE: `const greeting = (async () => (`Hi ${(await gapUser()).name}`))();`. On main, `settledMemos` skips it because `isPrimitive` takes the template literal for a string, so the clone writes `$$b.setContent($$e[0], (greeting))` with the promise. `watchUnreadMemos` skips it for the same reason, so a rejection is unhandled.
- `NEVER_PROMISE` (array, function) has the same gap: `$memo([await load()])` is a promise too.
- Wrote six tests in resume.test.ts, describe "an async memo that gives a string, with await inside, in a browser render": text and attribute, array memo text, rejection to `#catch`, rejection to the page once, unread memo rejection to the page and to `#catch`. All six time out with main's markup.ts.
- Fix: `isNeverPromise(declaration)` in markup.ts. It is true only for kind `memo` (no `await`, no server call) whose expression is a primitive, an array or a function. Both call sites use it. All six pass.
- The `loading` render snapshot changed: its `$memo(`Hello ${await ready}`)` inside `#loading` now goes through `fillSettled`. The old snapshot showed the bug, a promise passed to `setContent`.
- Checks: build, lint (oxlint exit 0, warnings only), format:check, typecheck, brumate tests 1395 passed.
- Bench todos: JS before `load` 5 files, 35.7 kB / 14.9 kB gzip, same as main.
- Review round 1: clean. Outcome written.
