# Outcome: docs-generator

## Built

- The props-table contract, frozen at v1 (docs/roadmaps/brumate/contracts/props-table.md): the `props Name` fence, the sections of a page in order, and the format of the props, anatomy, data attribute and keyboard tables.
- website/plugins/props-table.ts: `readProps(part)` returns the rows of a part from `<Name>OwnProps` or `<Name>Props` of its module script, with defaults from `$props` and descriptions from doc comments. `renderProps(rows)` returns the HTML. `SECTIONS` lists the section names.
- website/plugins/markdown.ts turns a `props Name` fence into the table, and watches the part file.
- website/ui/button.md has a Props section with the generated table. Its Attributes heading is now Data attributes.
- website/test/props-table.test.ts (8 tests), website/vitest.config.ts, and the `test` script of website/package.json.
- website/scripts/check-samples.ts reads website/ui as well as website/docs.

## Deviations

- No PropsTable.brm and no change to DocPage.brm: the table is HTML in a `raw` part, which costs no client code. The two files stay owned by this node.
- vitest is a devDependency of website (`^5.0.4`), added after the review. The lockfile is updated by the maintainer.

## Stubs left

- None.

## Gotchas

- Most props have no doc comment yet, so the docs nodes must write them in packages/ui.
- Button.brm's comment for `href` says "as in React Aria". The table prints it. Remove it in packages/ui.
- A part type that extends another interface lists only its own members. A type that is not an interface or an object type alias is an error.
- The formatter adds a blank line inside the empty `props` fence. The generator and the contract allow it.
- website tsconfig does not include test/.

## Proposed learnings

- A page shows a part's props only through a `props Name` fence, never a hand-written table | the table follows the type | website/ui | no

## Verification

- `node ../packages/ui/node_modules/vitest/vitest.mjs run` in website: 8 passed.
- `node scripts/check-samples.ts`: 63 samples, 0 problems; with a broken sample in website/ui: 1 problem, exit 1.
- `npx vite build` (client and ssr) in website: passes, and the server bundle holds the table.
- `npx brumate-tsc --noEmit` in website: passes. Root `npx oxfmt --check`: passes. `npx oxlint`: only warnings outside the node.

## Size

- Estimated M, actual M.
