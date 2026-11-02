# Log: browser-try

- Probe on 2b1d12ca: 8 tests for a #try that the browser renders around a rejected `await $memo` (in the body, a child, a component that the browser renders, a #for row, a #loading inside the #try, nested #try, a throw in the rest). All pass on the base: the `t` entry exists for a #try with client code (try-around-child, try-template-call-site) and browser-await-blocks made #try bodies split. The brief's premise (no `t` entry) no longer holds.
- First nested test waited for loads [1, 2] at once; the inner load starts in the rest of the outer one. Fixed the test.
- macOS: `tryWaitKid.brm` and `TryWaitKid.brm` are the same file. Host renamed `tryWaitKidHost.brm`.
- Two cases failed on the base:
  - #try inside a #loading body: the wait's `fault` reached the #loading's `f`, which keeps the fallback and destroys the body. The #catch never rendered and no error was reported (`catchInto` found no block).
  - Two rows of a #try body rejecting in the same turn: `fail` is async, so both reach `catchInto`; the #catch renders twice and shows the second error. Same on main for two effects that throw in one update (probe `tryTwoEffects`).
- Fix 1: `attempt` in waits.ts, a `bound` owner for the #try body that counts once in the outer boundary and absorbs a failure with `f` (no catch render: `fail` does it).
- Fix 2: `fail` drops an error whose #try body scope left `scopes` before the catch.
- blocks.txt snapshot: the #try body around `<Broken />` is now a body function under `attempt`.
- Bench todos: 13,835 B gzip before `load` (13.5 kB), click checks pass.
