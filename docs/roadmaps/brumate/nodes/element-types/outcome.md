# Outcome: element-types

## Built

- `brumate/elements` (packages/brumate/elements.d.ts, in `exports` and `files`): `Markup`, `Component<P = any>`, `PropsOf<C>`, `Elements`, `ElementProps<T>`, `ElementOf<T>`, `GlobalAttributes<E>`, `Handlers<E>`, `ElementEvents`.
- `Elements` has every tag of HTMLElementTagNameMap and SVGElementTagNameMap, with the attributes as the markup writes them. Apps merge custom tags into `Elements` and custom events into `ElementEvents`.
- packages/brumate/test/elements-types.ts, checked by `tsc --noEmit -p .`: 14 `@ts-expect-error` lines (unknown attribute of `a`, wrong `href`, wrong event, `Markup` is not a string, and more).
- The contract element-types is frozen at v1.

## Deviations

- Contract names changed from the proposal: `Component<P>` answers `Promise<Markup>` (components render on the server) and defaults to `any` (a `Record<string, unknown>` default rejects components of typed props). Added `ElementOf`, `ElementEvents`, `Handlers`, `GlobalAttributes`. All recorded in the contract.
- types.d.ts is not changed: a .brm import is still `(props: any, ctx) => Promise<string>`. Switching it and check.ts to `Component` is for element-checks and ui-generics.
- No change to signals.ts, tsconfig.json or other files outside the brief.

## Stubs left

- None.

## Gotchas

- `ref` imports `BindableMark` from `brumate/signals`, which resolves to dist. A typecheck needs `npx tsdown` first, as types.d.ts already needs. A test must import `$bind` from `brumate/signals`, not from src, or the two `BindableMark` types differ.
- skipLibCheck is on, so tsc does not check errors inside elements.d.ts. Only the test catches them. Run `npx tsc --noEmit -p . --skipLibCheck false` to check the file itself (one unrelated error from happy-dom remains).
- SVG elements share one attribute list, so an SVG attribute on the wrong SVG element is not an error.
- Event names must be in `ElementEvents` (the DOM `HTMLElementEventMap`). An event of a component part, such as `onItemaction`, on a plain element needs a merge into `ElementEvents`.
- `style` is a string only, as in the markup.

## Proposed learnings

- A d.ts contract needs a test with `@ts-expect-error` and a proof that each fails without its comment | skipLibCheck hides errors in the d.ts itself | packages/brumate | yes

## Verification

- `npx tsc --noEmit -p .` in packages/brumate: exit 0, after `npx tsdown`.
- Blanked the 14 `@ts-expect-error` comments in a copy: 14 errors, one each. Removed `wbr` from `Elements`: the coverage line failed.
- `npx vitest run` in packages/brumate: 955 passed, 5 expected fail.
- `npx oxlint` and `npx oxfmt --check`: exit 0.
- packages/ui not changed, so its suite was not run.

## Size

- Estimated M, actual M. No runtime code, so no gzip change.
