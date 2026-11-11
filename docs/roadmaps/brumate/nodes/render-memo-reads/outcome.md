# Outcome: render-memo-reads

## Built

- packages/brumate/src/codegen/patch.ts: `heldMemos` decides which memos of the browser render keep `renderMemo` and the `readMemo` check on their reads. The others hold no error and compile to `$$b.memoNow(expr)` (a `$gate` to `$$b.gateValue(expr)`), and their reads are plain:
  - a memo with `await` (its compute is async, so it gives a promise and never a `MemoError`);
  - a memo that cannot throw and reads no memo that holds an error (`cannotThrow` in primitive.ts: names, literals, functions, arrays and objects of those, `===`, `!==`, `!`, `typeof`, `void`, `&&`, `||`, `??`, `?:`, `$isPending(x)`; nothing that converts a value, so no arithmetic, relational operators, `==`, unary `+ - ~` or template literals with a part);
  - option A: a memo that the render always reads, in code that always runs (text, attribute and prop values of markup outside blocks and component children, `$setContext` values, statements, `$signal` initial values, memos that run at once). Its throw at the declaration is the throw of the read. Only when nothing that can throw runs between the declaration and the first read (`inOrder`), so the first error is the one the base shows. Memos that fail the check stay held, and the whole choice is computed again.
- packages/brumate/src/runtime/client/components.ts, client.ts: `memoNow` (marks a promise or stream for `setSlots`), used by `renderMemo`.
- packages/brumate/test/codegen.test.ts: one test replaced by four. 4 render snapshots updated.
- .changeset/render-memo-reads.md (patch).

## Proof

- base: 2e1e84f0, compile of packages/ui/src: 401 `renderMemo`, 1022 `readMemo`. Client gzip (sum of dist/client/**/*.js, gzip -9, clean rebuild) todos 39,677 B, ui 211,188 B.
- first version (c367947c, unsound, replaced): todos 39,673 B, ui 210,588 B.
- branch: todos 39,691 B (flat, builds vary by about 20 B), ui 210,805 B (-383 B of the +861 B that render-memos added).
- Per step (todos / ui): 1 no check for `await` memos 39,681 / 211,175 (-13 ui); 2 and 3 together, after the fixes 39,691 / 210,805. The steps were not measured apart again after the review fixes.
- Second review: a child component in the markup before the first read can throw; option A now stays off when the markup has a component or a dynamic tag (childFirstTry fails on bfb27524).
- Review fixes: orderTry (error order) and convertTry (BigInt memo kept silent) in test/resume.test.ts fail on c367947c and pass now; three codegen tests pin the same.

## Deviations

- Snapshots test/**snapshots**/render/{doubler,loading,memos,todos}.txt are updated (under test/**, listed as shared).
- New fixtures in test/render: orderTry, OrderKid, orderData.ts, convertTry, ConvertKid, childFirstTry, ChildFirstKid, Thrower.

## Main bugs

- A memo of a bare array, template, binary or unary expression is inline (`neverPromise`), so it throws at its declaration, not at its first read. effects.md says a memo that nothing reads keeps its error silently. Repro: in a child inside `#try` and `#if (show)`: `let big = $signal(1n); const m = $memo(big + 1); function f() { return [m]; }` with `<button onClick=(() => f())>` and no markup read. The kid fails with "Cannot mix BigInt and other types" at render and the `#catch` shows. packages/brumate/src/codegen/{patch,primitive}.ts and runtime/client/components.ts are identical on origin/main and 2e1e84f0 (`git diff origin/main 2e1e84f0` empty), so main has it. Not fixed here.

## Stubs left

- None.

## Gotchas

- `$signal(held)` creates a site labelled `signal <name>`, not `setup`; the always-run check takes both.
- A read inside `fillSettled(..., (name) => ...)` refers to the callback parameter, but the compile maps it by position to the memo; the callback only defers for promises, which are never a `MemoError`.
- Still wrapped (161 reads, 58 memos in ui): memos read only in functions, handlers or blocks (they run later and must see the held error), and memos whose expression can throw (member access, calls).

## Proposed learnings

- A memo of the render that the code always reads needs no held error | the throw at its declaration is the throw of the read | packages/brumate/src/codegen | no

## Verification

- Targeted: render, resume, codegen, differential 1-4 and the memo tests; see the commit for the final run.
- Full brumate vitest (`--maxWorkers=3 --hookTimeout=120000`): 3168 passed, 4 render snapshots failed as expected, updated; render.test.ts then passes (56).
- `pnpm format:check` ok; oxlint 0 errors (`pnpm lint` exits 1 on the base too, ESLint JSON output parse failure of the wrapper); `pnpm typecheck` ok.

## Size

- Estimated M, actual M.
