# Prior art: marking derivations or handlers explicitly

- React useMemo/useCallback (deps arrays): manual markers that a value or function is stable/derived.
  React Compiler (1.0, Oct 2025) memoizes automatically; React docs say new code can rely on the
  compiler and leave out useMemo/useCallback, since manual markers were often missing or wrong.
  Finding: an explicit "this is derived/stable" marker was replaced by inference. Negative for the primitive.
- React useEffectEvent (stable in 19.2): an explicit marker for the reverse case, a function that reads
  latest values but must not make an effect reactive. Finding: an explicit "this is a handler, not a
  dependency" marker survived where inference (the deps lint) could not tell intent. Positive for a reverse marker.
- Solid: function props are getters; a call inside JSX or createMemo tracks, a call in an event handler
  does not, because tracking follows the call site at runtime. `untrack` cuts reads. No marker on the function.
- Svelte 5 runes: functions passed as props and called in the template or $derived are tracked at the
  call site; `untrack` cuts. No marker on the function.
- Vue: `computed` marks a cached derivation; a plain method called in a template re-runs each render.
  The marker exists for caching, not for liveness.
- Marko 6 (Tags API): the compiler infers closures and their reads at compile time, no marker, close to
  brumate's compile-time graph.
- Qwik `$()`: an explicit compiler marker for lazy-load boundaries (not reactivity). It is required on
  every handler/closure; a known learnability cost (users must learn the `$` suffix rules).
- Lab: docs/debates/pending-handler-reads (J13) chose the explicit `$resolve` over an implicit wait.
- Lab: brumate `$handler` (commit de590c95, 2026-10-23): 610 insertions in 22 files (analyze, codegen,
  runtime client/server/serial, docs). Calibration for the cost of a marker that crosses spreads/modules.
- Lab: PR #395 (fix/function-prop-reads): 229 insertions in 15 files, 37 lines in graph.ts.
