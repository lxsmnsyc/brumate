# Outcome: observability-docs

## Built

- `website/docs/observability.md`: server `onTrace` in `src/middleware.ts`, browser `onTrace` in `start`, the `trace` plugin option, the trace of one click (live `.brm` sample and the span tree), the span table and shape, `otel()` with its limits, what is never recorded, and the cost off and on. Added to the Production group in `website/src/docs.ts`; `routing.md` links to it.
- `docs/decisions.md`: one entry with sub-bullets (finished spans, `onTrace` beside `onError`, OpenTelemetry subpath and optional peer, build constant, answer to the story question A, async-handler attribution rule).
- `docs/proposals.md`: the Observability section links to the page.
- `packages/brumate/skills/brumate/SKILL.md`: one bullet on `onTrace`. Changeset `.changeset/observability-skill.md` (patch).

## Deviations

- The brief owns `packages/brumate/skill/**`; the real path is `packages/brumate/skills/brumate/`.
- `routing.md` and `.changeset/observability-skill.md` were also edited (a link, the changeset); both are small.
- The skill bullet has no code block, so the skill test has nothing new to compile.

## Stubs left

- None.

## Gotchas

- `check:samples` needs `pnpm --filter brumate build` first.
- Only `live` samples are compiled; the `ts` samples on the page are checked by hand.

## Proposed learnings

- None.

## Verification

- `pnpm lint` (existing warnings only), `pnpm format:check`: pass.
- `pnpm --filter website check:samples`: 72 samples, 0 problems.
- `pnpm --filter website build`: pass, `docs/observability` is in the output.

## Size

- Estimated S, actual S.
