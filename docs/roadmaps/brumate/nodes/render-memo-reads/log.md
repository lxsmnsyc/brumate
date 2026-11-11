# Log: render-memo-reads

- Base 2e1e84f0. Count of the render modules of packages/ui/src (compile, 119 files, a few fail on a missing import): 401 `renderMemo`, 1022 `readMemo`.
- Client gzip (sum of dist/client/**/*.js, gzip -9, rebuild of brumate dist, then `vite build`), base: todos 39,677, ui 211,188.
- Step 1, no check on the reads of a memo with `await`: its compute is async, so it gives a promise and never a `MemoError`. todos 39,681, ui 211,175.
- Step 2, a memo that cannot throw (names, literals, arrays and objects without a spread, operators except `in`, `instanceof`, `delete`, functions) and reads no memo that holds an error gets `memoNow(expr)` and no read check. todos 39,670, ui 210,947.
- Step 3, option A: a memo that the render always reads (text, attribute and prop values of markup that is not inside a block or a component's children, `$setContext` values, statements, `$signal` initial values, and memos that run at once) is not wrapped: the throw at its declaration is the throw of the read. It gets `memoNow(expr)` (a `$gate` gets `gateValue(expr)`), no read of it is checked. A fixed point, since a memo that settles settles the memos it reads. todos 39,690, ui 210,584. Adding `$signal` initial values changed nothing in size (210,588).
- Builds vary by about 20 B (todos), so todos is flat. ui: -604 B of the +861 B that render-memos added.
- Remaining in ui packages: 161 `readMemo` and 58 `renderMemo` (from 1022 and 401): memos read only in functions, handlers or blocks, and memos whose expression can throw.
- Not done: dropping the check in a function that cannot run during the render. A handler runs later and must see the held error.
- Known flakes of the suite were not rerun.
- Review of c367947c: (1) option A changed the first error when memos are read in another order than declared; (2) `cannotThrow` allowed `big + 1`, templates and other conversions. Fixed: `inOrder` blocks option A when code that can throw runs between the declaration and the first read (markup counts as unordered, and so do the bodies it renders); `cannotThrow` keeps only forms without a conversion.
- Sizes after the fixes: todos 39,682, ui 210,802 (the unsound version gave 210,588).
- origin/main has the same patch.ts, primitive.ts and components.ts as the base, so the inline-memo throw on `$memo(big + 1)` is on main.
- Second review: any component or dynamic tag in the markup of the scope blocks option A for a memo first read in markup. Sizes: todos 39,691, ui 210,805.
