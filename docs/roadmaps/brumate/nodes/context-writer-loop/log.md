# Log: context-writer-loop

- The loop: the provider's `$setContext` site depended on `total` through `readTotal`, so each write of `addTotal` sent the context again. The child effect reads the context slot, so it ran again and wrote again.
- Fix in graph.ts: a `provide` site whose functions write (the `writes()` rule of function props) gets edges only from the values it holds itself, not through the functions it calls. The context stays fixed when a function in it reads state.
- Cost: markup in a child that calls a reading function of such a context (`{ctx.read()}`) no longer updates when the provider also holds a writer. Documented in website/docs/context.md.
- Test: resume.test.ts, fixtures ctxWriterLoop*. It hung on main (timeout) and passes now.
- ui suite: failures vary between runs under load (13, then 100+ with 4 workers). On main and on the branch, bind-kept-writes (1), generics-markup (3), skill (1) and token-field-sync (1 or 2) fail the same. No ui part output changed.

## Rework after the fresh review

- The graph rule was too wide: it froze reading functions of the context for markup, memos and effects, and changed the output of 42 ui parts. Reverted graph.ts and the context.md note.
- New fix in the client runtime (updates.ts, context.ts): the effect that is running is the origin of the writes it causes. A queued update inherits the origin, also across the async load of update code. When a context send (`updateContext`) would queue the same effect, the queue skips it. Any other effect, memo or markup still updates.
- The compiler is unchanged from main, so the compiled output of every .brm, ui included, is identical.
- Probe test (markup, `$memo` and `$effect` on `ctx.read()` after a click): passes on main and on the branch.
