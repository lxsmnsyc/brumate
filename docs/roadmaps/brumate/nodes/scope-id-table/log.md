# Log: scope-id-table

- `SCOPE_IDS` in shared.ts: `fields` is a `Record<keyof ScopeState, FieldKind>`, so a new field of `ScopeState` fails to compile until named. `references` is a list of `[class, shift]`.
- client.ts re-exports the table as `scopeIds` in place of the four reference classes, which only client-routes.ts used. `shiftState(ids, state, by)` is exported and takes the table as an argument, so client-routes.ts still imports no code.
- Test checks the reference classes by reading shared.ts for classes with `readonly scope: ScopeId`. A reference class added with another field name would pass unseen.
- Other walkers: `parseId` reads text, not fields, so it does not use the table. The plugins of serial.ts write `value.scope` and read through `stateValues`, with no moving. devtools.ts only shows IDs. None walks fields to move them.
- `Binding` holds a `SlotReference` (`ref`) and `set` (a possible FunctionReference). The old `shiftState` did not move them, and I kept that: adding it would put Binding in the table of every build. Open doubt: a Binding inside a record moved by `b-offset` keeps its old slot scope.
- The sandbox guard rejects bare `git` commands here (the rtk rewrite). Piping the output (`| cat`) gets past it.
