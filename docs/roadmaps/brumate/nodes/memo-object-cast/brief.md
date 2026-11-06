---
id: memo-object-cast
title: A memo of an object literal with a type cast compiles
status: todo
priority: must
type: fix
outline: false
milestone: 0.6.1
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/codegen/**
  - packages/brumate/test/**
reserves: []
provides: []
depends_on: []
---

# A memo of an object literal with a type cast compiles

## Goal

`$memo({ ... } as T)` (and `satisfies T`, `<T>{...}` where TypeScript allows it) compiles to a valid client part when the memo is live in the browser. Today the arrow body loses its parentheses:

```brm
<script>
  import { $memo, $signal } from 'brumate/signals';
  let n = $signal(1);
  const p = $memo({ a: n, b: 2 } as Record<string, unknown>);
</script>
<button onClick=(() => n++)>{p.a}</button>
```

`compile()` on main emits `$$b.memo($$s, 1, () => { a: $$b.get($$s, 0), b: 2 } as Record<string, unknown>);` in the update part. The braces parse as a block, so the vite transform fails with PARSE_ERROR. A memo that the compiler prunes (static) does not show it. `$memo<T>({ ... })` works.

Found by ui-stores-fields (2026-11-05) in packages/ui SearchField; confirmed on main the same day.

## Acceptance

- [ ] The sample above compiles and its client part parses; a test covers `as`, `satisfies` and a plain object literal, in the update part and the browser render.
- [ ] Any other place that writes an expression as an arrow body gets the same fix, or a test shows it already wraps.
- [ ] A patch changeset.

## Sizing

S.
