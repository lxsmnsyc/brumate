---
id: memo-errors-server
title: A memo that throws on the server renders the nearest #catch
status: todo
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "memo error"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/memoErrorServer*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/test/resume.test.ts
  - docs/decisions.md
  - website/docs/effects.md
reserves: []
provides: []
depends_on:
  - on: memo-errors-at-read
    kind: hard
    why: it adds the client rule and the it.fails test for the server case this node fixes
---

# A memo that throws on the server renders the nearest #catch

## Goal

On the server, a memo declared outside the `#try` that reads it fails at its declaration, so the page errors instead of rendering the `#catch`. The server codegen reads the memo into a `const` there (`awaitRun` and `memoValue` in `codegen/markup.ts`). Make the server hold the error and throw it where the memo is read, as the client does since memo-errors-at-read.

## Context

- Found in the review of memo-errors-at-read (#287). That PR adds the `it.fails` test "declared outside the #try" with the fixture `memoErrorServerOutside.brm`.
- Read the outcome of memo-errors-at-read first.

## Ready-made test for the awaited case

memo-errors-at-read checked this case in its worktree (it passes on main, no code change) but merged without it. Add it as is.

`packages/brumate/test/render/memoErrorAwaitOutside.brm`:

```
<script>
  import { $memo } from 'brumate/signals';

  async function bar(): Promise<string> {
    await Promise.resolve();
    throw new Error('Bar failed');
  }

  const foo = await $memo(bar());
</script>

<p class="before">before</p>
#try {
  <p class="data">{foo}</p>
} #catch (error) {
  <p class="caught">{String(error)}</p>
}
```

In `packages/brumate/test/resume.test.ts`, next to the other memo error tests:

```ts
it('holds the memo error until a read: an awaited memo declared outside the #try throws at its declaration on the server', async () => {
  await expect(resume('memoErrorAwaitOutside', {})).rejects.toThrow('Bar failed');
  expect(document.querySelector('.caught')).toBeNull();
});
```

Add to the memo error entry of docs/decisions.md: "An awaited memo, `const foo = await $memo(bar())`, throws at its declaration on the server, since `await` reads it there."

## Acceptance

- [ ] The "declared outside the #try" server test passes as `it`.
- [ ] A memo read in two `#try` blocks renders each block's own `#catch`.
- [ ] An awaited memo, `const foo = await $memo(bar())`, still throws at its declaration: `await` reads the memo there, so the error goes to the `#try` around the declaration (the maintainer's rule, 2026-10-27). A test covers it outside a `#try`.
- [ ] docs/decisions.md and website/docs/effects.md drop the inside-only caveat.
- [ ] Todos gzip within 0.3 kB of main (`pnpm bench --only brumate --scenario todos --metrics dist`).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a codegen change on the server path and its tests.
