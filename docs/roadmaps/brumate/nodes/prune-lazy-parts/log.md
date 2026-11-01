# Log: prune-lazy-parts

- Work not on next at the start: loadPart, parts, loadedParts, getPart, updateReady, `w` and `loaders` were all there.
- Removed the loading in code.ts, state.ts, updates.ts, boot.ts, handlers.ts, references.ts, insert.ts, errors.ts, branches.ts, rpc.ts, resume.ts, client.ts, codegen/client.ts and compile.ts.
- Compiler: also removed `writesOwn`, `OUTER`, `wide` and `getPartName`, which only fed `w`.
- Tests: fixtures no longer fake `load`; the `a handler waits only for` suite became failing and slow module loads.
