# Log: promise-prop-memo

- First version (BRM186, a compile error for any read of a Promise prop other than `$memo(prop)`) was dropped on 2026-10-30 at the maintainer's request: a prop is a value like any other. The branch was reset to main.
- Probe: `test/render/promisePlain.brm` with `PromisePlainChild.brm`. On main the child's `value.then` throws "then is not a function" (the slot holds the unwrapped value), so the test fails.
- Where the unwrap was: `client/props.ts` (asyncMemo for a thenable prop) and `client/resume.ts` (a streamed promise slot is replaced by its value). A browser-rendered child also treats every thenable slot as a memo load (`setSlots`).
- Design: `Scope.plain` holds the slots of promise props. `get()` returns such a slot as it is, in a memo too, so `$memo(user)` gets a promise and loads it as an async memo (old value kept, pending until it settles).
- The browser cannot tell a prop slot from a memo slot in the state, so the server wraps a promise prop in `PropPromise` (`$b.q(...)`, seroval plugin `brumate/prop-promise`). `unbind` marks promise props with `Symbol.for('brumate.propPromise')` (a WeakSet failed after `vi.resetModules` in the tests: copies of the runtime differ). The first slot that holds a marked promise is the prop; a memo of it holds the same promise in a later slot.
- A memo of a prop in a child that the browser renders does not load (no update code is generated for `const x = $memo(prop)` there): same on main, not touched.
