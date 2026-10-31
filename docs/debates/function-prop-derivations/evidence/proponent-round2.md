# Proponent measurements, round 2

Setup: scratch copies of the opponent's branch package (pkg, src/graph.ts = option C), outside the repo:
- pc: option C + prototype (b) (child-declared type). Diffs: proto-b-graph.diff, proto-b-analyze.diff, proto-b-model.diff.
- pe: option C + "effects ignore typed function props" (C'). Diff: proto-ce-graph.diff.
Tests run with `npx vitest run test/resume.test.ts` in each copy. Nothing in the repo or worktree changed.

## 1. Context-write loop probe (ctxLoop.brm, CtxLoopMid.brm, pcCtx.ts, child RegLoopChild.brm)
ctxLoop provides `{ add: addTotal, read: readTotal }` (addTotal writes `total`). CtxLoopMid passes
`add=add` where `function add(n) { if (ctx!.read() < 1000) ctx!.add(n); }`: it reads state through the
context and writes through a context function the compiler cannot see (the J8 shape, under a non-`on` name).
RegLoopChild runs `$effect(() => add(value))`, capped at 50 runs.
| rule | runs after one click | total |
| #395 write scan (branch graph.ts) | 51 (cap) | 50 |
| option C (pkg graph.C.ts) | 51 (cap) | 50 |
| main rule (function props fixed) | < 5, test passes | |
| prototype (b), child types `add: (n: number) => void` | < 5, test passes | |
| C' (effects ignore typed function props) | < 5, test passes | |
Logs: scratchpad pcprobe.log, pcprobe395.log, pcprobeMain.log.

## 2. Prototype (b): child declares `Derived<F>`; a prop typed as a plain function type is fixed in the child
- analyze.ts: markFixedFunctionProps, read from the `$props<T>` type with memberNames, as markPromiseProps
  and Bindable already do (analyze.ts:186-196, :381-398). model.ts: `fixedFunction?: boolean`.
- graph.ts: no edges from a fixed function prop, and it is not a live source.
- Result: resume.test.ts 404/410 with the fixtures as they are; the 6 failures are the #395 derivation
  tests whose children type `label: () => string`. Retyping FnReadChild and FnReadEffectChild to
  `label: Derived<() => string>` (2 lines): 410/410, including regLoop, ctxLoop and the J4 test (untrackWrite).
- Size, compiled alone, gzip of parts + table, option C vs (b), ui/examples/website/benchmarks:
  43 files differ, 95994 B -> 95100 B (-894 B). See proto-b-size.txt. This is the compile-alone case;
  with project analysis many of these props are already not live, so the build saving is likely smaller.

## 3. C' (effects ignore typed function props, memos and markup still follow them)
- resume.test.ts 409/410: fails only "runs an effect of the child again when the state that the function reads changes".
- On real code it changes one file: TextField.brm (-1 B). TextField calls `validate` in an `$effect`
  (TextField.brm:179-185, setCustomValidity(customMessage(value)), customMessage calls validate at :171).
  So the one real derivation in the repo (J7, FormSignupDemo `validate=matches`) is read by an effect,
  and C' would leave the native validity stale. An effect that calls a derivation (validate) and an effect
  that calls a callback (Q4's add) are the same shape in the child; only a declaration tells them apart.

## 4. Path (a), call at the prop site
- ui/src has 63 function-typed members under names without `on` (grep of `name?: (...) =>` in *.brm),
  among them validate, isDateUnavailable, getTextValue, filter, defaultFilter, formatRange, getItems,
  getDropOperation: the child supplies the arguments, so the caller cannot pass the result as a value.
- FormSignupDemo (website/ui/demos/FormSignupDemo.brm:19-21, :56) can migrate by binding the confirm field:
  `let confirm = $signal('')`, `value=$bind(confirm) isInvalid=(confirm !== password)`, with the message in FieldError.
