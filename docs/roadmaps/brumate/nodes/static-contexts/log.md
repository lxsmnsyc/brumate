# Log: static-contexts

## 2026-11-03

- Read GOAL, CLAUDE, the brief, ui-date-i18n outcome and the context lines of decisions.md. The work did not exist: `declaration.kind === 'context'` was always live (graph.ts) and the server provider always wrote the value to the page state.
- Probe first: compile a reader with `liveContexts: new Set()`. The update part for a memo of the context and the `u` table entries vanish, so the existing machinery handles a non-live context declaration without changes. `strings` stays a slot only when a handler reads it.
- Design (written in the outcome): contexts are named by export name, the project fixpoint adds a name when a provider is live, holds a function, sits in a browser-created scope or in a browser-rendered file, or when a reader runs in the browser. Unknown provider name makes `*`.
- Browser-rendered files: a component used in a created body or template, anything a browser-rendered file renders, and the children of a component whose file has created scopes.
- Found: the differential harness, render.test.ts and resume.test.ts compiled with `liveProps` only, so I pass `liveContexts` from `analyzeProjectAll` there too. Otherwise no test page would exercise the analysis.
- Timeouts of 5 s and hook timeouts of 10 s in differential-1..4, render, resume, feature-flags-off and skill under a load average of 20. Rerun alone with `--maxWorkers=3`: 8 files, 1260 tests pass.
- Measured the website with and without the analysis (vite.ts passing `liveContexts: undefined`): total gzip of all JS 1,373,299 B before, 1,372,402 B after (-897 B); home entry set of 48 files 88,619 B before, 88,618 B after.
- Proof for I18nProvider: a probe project (Prov sets a locale context from a prop, Part reads it and looks a table up in a memo) ships `getDateStrings` in the update part before and not after. The move back in packages/ui was not made (see outcome).
