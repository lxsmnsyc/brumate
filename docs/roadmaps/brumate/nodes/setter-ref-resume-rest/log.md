# Log: setter-ref-resume-rest

- Probe: the test "a ref bound with a setter calls it through rest props" expected no call on resume. It passed on main, so the gap was real.
- The server's `restRef` now writes the setter of a non-slot binding into a new record field `r`, by the anchor of the element that spreads the rest. `addScopes` reads it and calls `give` for each.
- `give` moved from `forwardRef` to updates.ts next to `send`, so resume and a spread update share the `given` dedupe.
- `r` is a field of `ScopeState`, so SCOPE_IDS (shared.ts) and the full record of scope-ids.test.ts got it. A record with `r` is not packed, like one with `b`.
- Size: gzip -9 of every client js of the todos build, base then head: 38986 to 38993 B (+7).
- The bench harness (`pnpm bench`) was started and killed: the packages were rebuilt while it ran.
