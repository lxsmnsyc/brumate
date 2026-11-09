# Log: conditional-rest-spread

- The verify test did not exist (all skipped), so the work was not done.
- Analyzer: `spreadsWhole` allows the rest as a branch of `?:`, `&&`, `||`, `??` when other branches are empty (object literal, undefined, null, false) or the same name.
- First render already forwards (spreadsRest reads props). Off branch: values hold no `ref`, nothing is given.
- Update path (`attrs`) did not clear. Added `forwarded` WeakMap in inserts.ts and a `held` argument (`(rest).ref`) that codegen/client.ts passes for a conditional spread, since the browser does not know the server rendered the ref.
- Found: props.ts `prop()` deleted a rest key when the binding value was undefined, so the ref left the rest once cleared. It now deletes only when the bound prop itself is undefined.
