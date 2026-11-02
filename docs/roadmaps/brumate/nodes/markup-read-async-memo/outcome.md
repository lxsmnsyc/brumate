# Outcome: markup-read-async-memo

## Built

- `Emitter.settledMemos` in packages/brumate/src/codegen/markup.ts. In client mode it finds the memos that a non-live insert or attribute reads. It skips memos that are primitives, arrays or functions.
- In packages/brumate/src/codegen/template.ts, the clone holds back those writes (`setContent`, `putText`, `setAttr`). It emits one `$$b.fillSettled(scope, [memos], (memos) => { writes })` per scope and memo set.
- `fillSettled(scope, values, write)` in packages/brumate/src/runtime/client/templates.ts, exported from `brumate/client`.
  - When no value is a promise, it writes at once.
  - Otherwise it writes after `Promise.all`, if the scope still exists.
  - A rejection goes to `fail` (the nearest `#try`, else `onError` and `brumate:error`), once per error and scope, and not at all for a closed scope.
- Tests in packages/brumate/test/resume.test.ts, describe "an async memo whose input never changes, in a browser render", 13 cases. Fixtures are in test/render: Gap*.brm, gapMarkup*.brm and gapData.ts.
- Changeset .changeset/markup-read-async-memo.md (patch, brumate).
- PR #419.

## Deviations

- Making such memos live was rejected. On server renders it would put their values in the page state, and a `#for` over `$memo(listIssues())` would become a live list. The fix is in client codegen only, and server output does not change.

## Stubs left

- None.

## Gotchas

- A render that falls back to HTML strings, instead of a cloned template, still does not fill. Examples are a `<template>` element or other comments.
- Block headers, props, `#for` lists and reads inside a function, such as `{list.map(() => value)}`, do not wait for such a memo.
- A primitive rejection (`reject('x')`) is not deduplicated. A shared rejection reported to scopes A, then B, then A reports to A twice.
- `putText` replaces its comment, so a second write has no place. That is why the writes are held back and not written twice.
- #417 (await-read-memo-rejection) touches `watchUnreadMemos` near this change. The `{await value}` test passes with the #417 markup.ts hunk applied. Expect a small rebase conflict in markup.ts and resume.test.ts.

## Proposed learnings

- A markup value that the browser renders from a memo that never changes has no update, so whatever writes it must wait for a promise itself | nothing else writes it | packages/brumate/src/codegen | yes

## Verification

- Test cases:
  - On main, all 13 cases fail (time out). The reviewer reproduced this on origin/main.
  - On the branch, all 13 pass.
  - With `settledMemos` disabled, all fail. Without the dedupe, the once-only case fails.
- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm --filter brumate test` (1324 passed) all pass.
- `pnpm bench --only brumate --scenario todos`: JS before `load` is 5 files, 35.5 kB / 14.8 kB gzip, the same as main.
- Review round 1 (fresh agent, pr-review): no blocking findings. The 7 non-blocking findings were fixed or noted.
- Review round 2: clean. Three low-priority non-blocking notes, left as is.

## Size

- Estimated S, actual S/M: three source files and one runtime helper.
