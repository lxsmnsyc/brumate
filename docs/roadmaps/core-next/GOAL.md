---
branches:
---

# Core: safe changes and the update pass

## Outcome

The core is safe to change: every field with a scope ID is in one table, tests compile with the current compiler, and updates run in the order of the graph, once each. Text typed before the code loads reaches its signal. On top of the update pass, batching and `$searchParam` ship.

## Acceptance

- `pnpm build && pnpm test` passes, and the 5 `it.fails` tests of "updates of a signal and a memo of it" are `it`.
- `node e2e/run.mjs` passes.
- `pnpm bench`: the gzip size of the core for todos does not grow by more than 0.3 kB.

## Priorities

- must: the Order of the proposals puts these before other core work: the scope ID table, tests against the current build, ordered updates, and fields typed early.
- should: what builds on them, and the gaps that #243 left.
- could: none.
- later: parked in ../inbox.md.

## Constraints

- Size comes first. Every core change reports its effect on the gzip size of todos.
- The resume format can change. Breaking changes need no deprecation.
- client.ts is the hot file of the core. split-client-runtime splits it before the nodes that rewrite it. scope-id-table and visible-forwarded-ref edit small parts of it, or boot.ts, before the split.

## Non-goals

- Step 3 and 4 of the smaller client. They are in ../client-size.

## Verification

- Fast check: `pnpm lint && pnpm format:check && pnpm typecheck`, then `pnpm --filter brumate exec vitest run`.
- Full check: `pnpm build && pnpm test && node e2e/run.mjs`, about 10 minutes, with Chrome.

## Numbered resources

- None.

## Sources

- [Reactivity](../../proposals.md#reactivity)
- [Tests against the current build](../../proposals.md#tests-against-the-current-build)
- [State in the URL](../../proposals.md#state-in-the-url)
- [The Order of the proposals](../../proposals.md#order)

## Coverage

- Ordered updates -> ordered-updates
- Ordered updates, batching -> batching
- One table of the fields with scope IDs -> scope-id-table
- Fields typed before the code loads -> fields-typed-early
- Tests against the current build -> tests-current-build
- State in the URL -> search-params
- `$client` in markup that the browser renders -> client-markup-docs
- Ref forwarding (#243), the visible trigger gap -> visible-forwarded-ref

## Open questions

- Should client.ts be split by feature first (split-client-runtime)? Without it, the core nodes run one after another on the same file.

## Gates

- split-client-runtime: the user approves the change of layout.
