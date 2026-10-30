# Outcome: code-examples

## Built

- Three examples in website/docs use the `{name}` shorthand: async-data.md, components.md, markup.md. The other examples already used the markup features.

## Deviations

- None. Few edits were needed since earlier work had already moved the examples to the idioms.

## Stubs left

- None.

## Gotchas

- The shorthand fits only when the attribute and the variable share a name, so `data-theme=theme` and `for=id` stay.

## Proposed learnings

- None.

## Verification

- `pnpm --filter website check:samples`: 65 samples, 0 problems.
- `pnpm lint` (warnings only, in e2e), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter website build`: pass.
- grep `\b(\w+)=\1` in website/docs and READMEs: only the cases left as is in log.md.

## Size

- Estimated M, actual S.
