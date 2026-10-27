# Outcome: dynamic-tag-rest-ref

## Built

- `<{as} {...rest}>` with a plain element in `as` gives the element to a `ref` left in the rest props, on the first render. Codegen (packages/brumate/src/codegen/markup.ts, `emitDynamic`) wraps the props in `restRef(props, scope, anchor, tag)` under the gate that elements use, now the shared `spreadsRest`. A tag that names a component is skipped, since the component gets `ref` as a prop and forwards it.
- `restRef` takes the tag as a fourth argument, on the server context (runtime/server.ts) and in the client (runtime/client/inserts.ts).
- Tests in packages/brumate/test/resume.test.ts, in "a dynamic tag that spreads the rest props": server render, a block that the browser renders, `as` changing between two elements, and the page state. Fixtures `RestRefTag.brm`, `restRefTagPage.brm`, `restRefTagPageBlock.brm`, `restRefTagPageSwap.brm`.
- Changeset `.changeset/dynamic-tag-rest-ref.md` (patch, brumate).

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- The ui parts: 30 of the 52 parts with a dynamic tag name `ref` in `$props` and write `ref=$bind(ref)`. The other 22 (Label, Text, Separator, Group, Header, Keyboard, VisuallyHidden, FieldError and others) leave `ref` in their rest, so they are the ones this fix serves.
- The change of `as` needed no new code: the update of the spread already forwards the element.
- The gate is the same as for elements: a spread through a local const or memo is not detected.

## Proposed learnings

- None.

## Verification

- `npx vitest run test/resume.test.ts -t "dynamic tag that spreads the rest"` in packages/brumate: 3 of 4 failed on main, 4 pass now.
- packages/brumate: 56 files, 1063 passed. packages/ui: 57 files, 537 passed, 1 expected fail.
- `oxlint` (warnings only, none new), `oxfmt --check`, `tsc --noEmit` in packages/brumate, `brumate-tsc --noEmit` in packages/ui: pass.
- Not run: `pnpm bench`, `node e2e/run.mjs`.

## Size

- Chunks of dist (`npx tsdown`), minified with esbuild, gzip -9, main then head: client 16904 to 16911, produce 1994 to 1994. The eager core grows by 7 B, within 0.1 kB.
- Estimated S, actual S.
