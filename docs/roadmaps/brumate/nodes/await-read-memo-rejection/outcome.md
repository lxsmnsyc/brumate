# Outcome: await-read-memo-rejection

## Built

- `Emitter.watchUnreadMemos` in packages/brumate/src/codegen/markup.ts counts a memo as unread when every read is an `await` read, unless the `await` is the whole argument of another memo (same start and end), as in `$memo(await side)`. That memo holds the same promise and is watched itself, so the error is reported once.
- Tests in packages/brumate/test/resume.test.ts, describe "an async memo that a browser render reads only with await": `await side;`, `$memo((await side).length)`, `$memo(await side + 1)`, `$memo(await side)` (one report), and `#catch`. Fixtures: test/render/AwaitReadKid.brm, AwaitFieldKid.brm, AwaitSumKid.brm, AwaitMemoKid.brm, their hosts, awaitReadTry.brm, awaitReadData.ts.
- Changeset .changeset/await-read-memo-rejection.md (patch, brumate).

## Deviations

- `$memo(await a)` as the whole value already worked on main. The failing forms of the brief's second case are an `await` inside a larger expression, such as `$memo((await a).length)` or `$memo(await a + 1)`.

## Stubs left

- None.

## Gotchas

- A memo's site node is the `$memo` argument, so "the whole value" is a range match between `read.await` and `read.site.node`. Matching only the start takes `await a + 1` for `await a`.
- `$memo(await side ?? x)` still makes the outer memo hold the promise and also watches `side`; not probed for a double report. Not on the tested paths.

## Proposed learnings

- When the browser compiles `await memo` to a plain read, the promise flows on or is dropped; codegen must tell the two apart | packages/brumate/src/codegen | yes

## Verification

- `pnpm --filter brumate exec vitest run resume.test.ts -t "reads only with await"`: 5 passed; 4 fail on main (all but `$memo(await side)`).
- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (1316 passed).
- `pnpm bench`: todos JS before `load` 14.8 kB gzip, same as main.
- Review: 2 rounds (fresh agent, pr-review). Round 1 found the start-only range check; round 2 clean.

## Size

- Estimated S, actual S.
