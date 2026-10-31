# Opponent measurements, round 2

Scratch copies outside the repo (vitest run test/resume.test.ts in each). Nothing in the repo or worktree changed.
- pm: main's packages/brumate (0.4.0 rule, function props fixed).
- po: copy of the proponent's pc (option C + prototype (b)).
- pq: copy of pkg (option C) + C2: a call through a context value or a prop, outside $untrack, counts as a write.
  Diffs: opp-c2-analyze.diff (+17 lines), opp-c2-model.diff (+2), opp-c2-graph.diff (+3).

## 1. Context loop on main (pm)
opp-ctxEff.brm provides `{ add: addTotal, read: readTotal }` as in the proponent's ctxLoop; opp-CtxEffMid.brm runs
`$effect(() => { if (count > 0) ctx!.add(1); })` (capped at 50). No function prop involved.
Result on main: 51 effect runs after one click, total 50. The context is re-sent each time `total` changes
(read reads it) and the effect depends on `ctx`. So the P9 loop is main's context behavior reaching a prop.

## 2. Prototype (b) (po): child types that are not a literal function type
Same ctxLoop parent and mid as P9; only the child's `$props` type changes. Runs after one click (cap 50):
| child type of `add` | runs |
| `add: (n: number) => void` (proponent) | < 5 |
| `type Add = (n: number) => void; add: Add` | 51 |
| `add: ((n: number) => void) \| undefined` | 51 |
| `add(n: number): void` (method signature) | 51 |
| `$props()` without a type | 51 |
| `$props<RegProps>()`, RegProps imported from a .ts file | 51 |
Cause: markFixedFunctionProps tests `t?.type === 'TSFunctionType'`; anything else stays live, `Derived<F>` included.
Files: opp-Reg{Alias,Union,Method,Untyped,Import}Child.brm.

## 3. C2 (pq)
- resume.test.ts: 410/410, including the proponent's ctxLoop (no loop), regLoop and untrackWrite (J4).
- opp-modLoop.brm: a callback that writes through a .brm.ts module function (`increment()` of counter.brm.ts): no loop (passes under C2; the module's writes are already visible).
- node sz.mjs pkg pq over packages/ui, examples, website, benchmarks: 0 files differ from option C.
  FormSignupDemo keeps its prop update. Over test/render only CtxLoopMid differs (343 -> 279 B gzip: the update is gone).
- Cost: a derivation that reads through a context function or a prop function (`label=(() => ctx.read())`) stays fixed as on 0.4.0. 0 such props in the repo (the 0-file diff above).
