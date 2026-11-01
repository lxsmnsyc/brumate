# Log: runtime-brand-checks

- Reproduced outside vitest: two copies of the built `dist/runtime/server.js`. `A.mergeAttributes([{ 'b-on': B.internal('click') }])` returns `{}`; with `A.internal(...)` it keeps the attribute.
- Surveyed the other `instanceof` checks of runtime classes. Only `Internal` fails silently (drops data). The others (`NotReady`, `Redirect`, `Context`, `Children`, `FunctionReference` and the like) throw or misbehave loudly, are made and checked inside one render or one client, and were left alone to keep the client small.
- `Internal` is exported, so a computed `[INTERNAL]` class field fails `--isolatedDeclarations` (TS9038). The brand is set on the prototype instead, which also avoids a field on every instance.
- The resume.test.ts workaround (dynamic import of server.ts for gapStyleVar tests) is replaced by `resume(name, {})`.
