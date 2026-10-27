# Outcome: rest-ref-spread

## Built

- A `ref` left in the rest props reaches the element that spreads them. Three paths:
  - Server render: `restRef(attributes, scope, anchor)` on the server context (packages/brumate/src/runtime/server.ts) forwards an `ElementReference` to the slot that the `ref` binding names, and on through the bindings above it, as `bindings()` does for a named `ref`.
  - Markup that the browser renders: `restRef` in runtime/client/inserts.ts (exported from client.ts) pushes the same forward to `afterInsert`.
  - Updates: `attrs` forwards the element whenever a spread updates. `prop()` in runtime/client/props.ts now keeps the Binding in a rest prop, where it stored the bare value, so a later update does not lose the `ref`.
- `ref` as a Binding is never written as an attribute: `attributeText` in html.ts and `attrs` skip it.
- Codegen (codegen/markup.ts): an element with a spread that reads a `prop` or `props-rest` declaration, and no own `ref=`, wraps its merged attributes in `restRef(...)`. Other spreads cost nothing.
- Tests in packages/brumate/test/resume.test.ts: the `it.fails` test is `it`; two new ones for a spread in a `#if` block that the browser renders, and for a rest that changes (title) after the first render. Fixtures `restRefBlockPage.brm`, `restRefChangePage.brm`. "leaves the element out of the page state" still passes.
- Changeset `.changeset/rest-ref-spread.md` (patch, brumate).

## Deviations

- None in code paths outside the brief's lists, except runtime/client.ts (one export line) and runtime/client/props.ts (inside runtime/client/**).

## Stubs left

- None.

## Gotchas

- A rest prop now keeps a Binding on the client after `prop()`, as the server state already did. Code that reads a rest key directly gets the Binding for a `$bind` prop, as on the server.
- A `ref` bound with a setter, `$bind(root, fn)`, is not forwarded, as for a named `ref`.
- A spread whose rest goes through a local const or memo is not detected (the gate reads `prop` and `props-rest` only), so the first render there forwards nothing. An update of the spread still does.
- Dynamic tags (`<{as} {...rest}>`) are not covered by the first-render forward.
- vitest skips paths under `.git`, so worktrees there need a config with `server.fs.strict: false` and an `exclude` without `.git`.

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate exec vitest run test/resume.test.ts -t "a ref left in the rest props"` equivalent (`vitest run -t "rest props"` with the config above): 4 passed.
- packages/brumate full suite: 1033 passed, 1 expected fail, 8 failed in testing.test.ts and vite.test.ts, the same 8 as on main in a worktree under .git.
- packages/ui: 57 files, 537 passed, 1 expected fail.
- `oxlint` exit 0, `oxfmt --check` pass, `tsc --noEmit -p .` in packages/brumate pass, `brumate-tsc --noEmit` in packages/ui pass.
- Not run: `pnpm bench`, `node e2e/run.mjs`.

## Size

- Chunks of dist (`npx tsdown`), minified with esbuild, gzip -9, main then head: client 16575 to 16675, produce 1995 to 1994. The eager core grows by 99 B, within 0.1 kB.
- Estimated S, actual S.
