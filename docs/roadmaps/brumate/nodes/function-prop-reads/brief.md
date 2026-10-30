---
id: function-prop-reads
title: A memo that reads state through a function prop updates when that state changes
status: todo
priority: should
type: fix
outline: false
milestone: 0.5.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/test/**
  - website/docs/components.md
  - docs/decisions.md
reserves: []
provides: []
depends_on:
  - on: streamed-memo-reads
    kind: hard
    why: it changes how reads of loading memos run in updates.ts, and adds the rerun on settle for effects that this node may reuse for memos
---

# A memo that reads state through a function prop updates when that state changes

## Goal

The compiler decides at build time which memos and effects run again when a value changes. A child memo that calls a function prop, where the function reads the parent's state, is listed under the prop, not under the parent's state:

```brm
<!-- Parent.brm -->
<script>
  const user = $memo(getUser(id));
  function nameOf() { return user.name; }
</script>
<Child label=nameOf />

<!-- Child.brm -->
<script>
  const { label } = $props<{ label: () => string }>();
  const title = $memo(label().toUpperCase());
</script>
```

Read from the code on 2026-10-30, not reproduced: when `user` changes (or, if it is async, when its first value arrives), nothing runs `title` again until `label` itself changes. The docs (website/docs/components.md, "The call runs at once and returns the result, ... so the child can call a function prop in markup or a memo") allow the call, and the existing tests (valueFilter.brm) only pass pure functions.

## Steps

1. Probe on main first: a sync case (the parent's `first` signal read by a function prop, the child memo calls it, the parent writes `first`) and the async case in a parent that the browser renders. Record which of them fail.
2. The maintainer decides whether plain functions that read state are a supported way to derive values:
   - Supported: the child memo runs again when the state the function reads changes (for example the function prop counts as changed when the state it captures changes, or a pending memo waits on the promise it read, as effects do after streamed-memo-reads).
   - Not supported: a compile error when the compiler can tell the function is used as a derivation (called inside a memo or markup of the child and reading state), or a warning when it cannot tell a derivation from a handler. The docs line above changes with it.

## Acceptance

- [ ] The probe results are in log.md, and the maintainer's decision is in docs/decisions.md.
- [ ] Tests for the chosen behavior, sync and async.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a probe, a decision, and either a runtime and codegen change or a new diagnostic.
