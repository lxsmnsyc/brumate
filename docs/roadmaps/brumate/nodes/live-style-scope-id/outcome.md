# Outcome: live-style-scope-id

## Built

- `componentId()` in packages/brumate/src/codegen/markup.ts: the `b-v` value for the component scope is `<scope>.id` when the component scope is not created by the current render function (`isInside` false), as `anchor` and `bindingScope` do. Used by `emitLiveStyles` and the spread path (`"b-v": $$b.internal(...)`).
- Tests in packages/brumate/test/resume.test.ts with fixtures liveStyleChildren.brm, LiveStyleInner.brm, liveStyleRows.brm in test/render.
- Changeset .changeset/live-style-scope-id.md (patch, brumate).

## Proof

- base 2b94abf4: `npx vitest run test/resume.test.ts -t "style variables"` in packages/brumate. Both new tests fail with `b-v="[object Object]"` (children in a `#if` the click opens, and a row the click adds to a top-level `#for`). See log.md.
- branch: same command, 6 passed. The span goes from 10px to 20px after `w` changes; the row follows too.

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- Release/0.8 (merge of main): `liveVariableScopes` already applies the same rule for block scopes (`!owner || this.isInside(owner) ? name : name.id`) but not for the component scope. There `owner` is undefined for the component, so the component branch is always `name`. Fix: in the component case use `this.isInside(component) ? name : \`${name}.id\``, i.e. replace `!owner || this.isInside(owner)` with `this.isInside(owner ?? this.plan.graph.model.component)`. The spread path at ~markup.ts:2868 uses the same function, so one change covers both. Add the two resume tests and fixtures; they pass there only with the change.
- Adding fixtures to test/render shifts differential-N shard membership; the test names move between files.
- Output change for packages/ui TreeItem and ColorThumb (expected); not diffed by hand.

## Proposed learnings

- A scope name written into the output outside the render function that creates it needs `.id` | `[object Object]` otherwise | packages/brumate/src/codegen | no

## Verification

- resume + styles tests: 664 passed.
- Full brumate vitest (--maxWorkers=2): load failures in differential-* (76 failures in one run), render.test.ts (hook timeout), vite.test.ts. Alone: differential-2/3/4 pass 140 each; differential-1 fails ResolveGoneChild, which fails on the base too; vite.test.ts has the same 4 failures on the base.
- `pnpm --filter @brumate/ui exec vitest run`: 22 failures after build (Button pointer press, as-collections, ...); Button.test.ts fails 5 on the base too, so not from this change.
- `pnpm exec oxlint`: warnings only. `pnpm format:check`: one file, docs/roadmaps/brumate/nodes/editor-sizes/brief.md, not mine.
- `pnpm typecheck`: passes (after `pnpm build`).

## Size

- Estimated S, actual S.
