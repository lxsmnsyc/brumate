---
branches:
---

# A smaller client

## Outcome

The JS before `load` shrinks toward Marko's: the marker index and the HTML string path go, and spikes decide whether functions for values and component inlining are worth building.

## Acceptance

- `pnpm bench`: the gzip size of the JS before `load` for todos is below the baseline that size-baseline records.
- `pnpm test && node e2e/run.mjs` passes.

## Priorities

- must: none. Size is important, but nothing waits for it.
- should: the baseline, and the rest of step 3.
- could: the spikes.
- later: fixed walks, in ../inbox.md.

## Constraints

- Each step is its own pull request, measured with `pnpm bench` before and after.
- `pnpm bench` runs one at a time (exclusive: bench).

## Non-goals

- Speed work that grows the size.

## Verification

- Fast check: `pnpm lint && pnpm format:check && pnpm typecheck`, then `pnpm --filter brumate exec vitest run`.
- Full check: `pnpm test && node e2e/run.mjs && pnpm bench`.

## Numbered resources

- None.

## Sources

- [A smaller and faster client](../../proposals.md#a-smaller-and-faster-client)
- The request of the user for component inlining and constant folding, 2026-10-26.

## Coverage

- Step 1, features of the build -> built: #147
- Step 2, more features of the build -> built: 4d1d0f14, 624e210b
- Step 3, nodes on the scope and cloned templates -> partly built (#149 to #166); the rest -> drop-marker-index
- Step 4, functions for values -> values-spike, then a build node if it is a go
- Later, fixed walks -> inbox: waits until speed matters more than size
- Component inlining and constant folding -> inlining-spike

## Open questions

- values-spike must fit with ordered-updates of ../core-next, which changes how the update tables run. Which goes first?

## Gates

- values-spike and inlining-spike: the user decides go or no-go from their outcomes.
