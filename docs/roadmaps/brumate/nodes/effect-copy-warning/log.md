# Log: effect-copy-warning

- 2026-11-19: started on `feat/effect-copy-warning` from `batch/brumate-release-0.9` (8cebc3ae). Nothing of the node existed.
- `checkEffectCopies` in `analyze.ts` runs after the resolver, over each `effect` site whose node is a function (a `$searchParam` site has a call as node, so it is skipped). `collectCopies` walks the body, `isPure` checks each expression.
- One catalog entry, `BRM209`, with `{form}` for both texts, so `BRM210` stays unused. `matchesError` turns `{form}` into a lazy match.
- `++` and `--` end the check, since a counter reads itself and a memo cannot replace it. A `+=` still warns, with the `a $memo` text.
- Warnings now look up the catalog in `check-command.ts`, `language-server/src/diagnostics.ts` and `vite.ts` (`withCode`).
- Scan: `brumate check --no-types` in `packages/ui`, `website`, `examples` and `benchmarks` gives no BRM209 warning.
- No setting turns a warning off today, so none was added.
