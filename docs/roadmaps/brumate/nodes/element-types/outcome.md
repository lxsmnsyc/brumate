# Outcome: element-types

## Built

- `brumate/elements` (packages/brumate/elements.d.ts, in `exports` and `files`): `Markup`, `Component<P = never>` (with `brumateId`), `Template<A>`, `PropsOf<C>`, `Elements`, `ElementProps<T>`, `ElementOf<T>`, `GlobalAttributes<E>`, `Handlers<E>`, `ElementEvents`.
- `Elements` has every tag of HTMLElementTagNameMap and SVGElementTagNameMap, with the attributes as the markup writes them. Apps merge custom tags into `Elements` and custom events into `ElementEvents`.
- packages/brumate/test/elements-types.ts, checked by `tsc --noEmit -p .`: 22 `@ts-expect-error` lines (unknown attribute of `a`, wrong `href`, wrong event, `Markup` is not a string, wrong `ref` subtype, template typo, and more).
- Review fixes: `ref` takes a supertype signal (`$signal<HTMLElement>()`) through a required `WritableMark<W>` in the `BoundSignal<T>` that `$bind` returns, so a bare `BindableMark` is not a ref. check.ts and types.d.ts give `Promise<Markup>`, and a .brm import is `Component<any>`. packages/brumate/tsconfig.elements.json checks elements.d.ts with `skipLibCheck: false`, and the `typecheck` script runs it.
- The contract element-types is frozen at v1.

## Deviations

- Contract names changed from the proposal: `Component<P>` answers `Promise<Markup>` and defaults to `never` (a call through the default is an error; use `Component<any>` to call). Added `Template`, `ElementOf`, `ElementEvents`, `Handlers`, `GlobalAttributes`. All recorded in the contract.
- Files outside the brief's paths, after the review: packages/brumate/src/check.ts (generated component and template return `Promise<$$Markup>`), packages/brumate/types.d.ts (.brm import is `Component<any>`; shared in the brief), packages/brumate/src/runtime/signals.ts (shared: `WritableMark`, `$bind` return type), packages/brumate/src/runtime/server.ts (`Component` answers `Promise<string | object>`, and four casts to string), packages/brumate/test/check.test.ts (the expected template signature), packages/tsc/test/tsc.test.ts (the message of a bad `$bind` now names `BoundSignal<number>`), packages/brumate/tsconfig.elements.json (new), and the `typecheck` script in package.json.
- Fallout: none beyond those files. `brumate-tsc --noEmit` exits 0 in packages/ui, website and the seven examples. A probe file with a wrong use of a .brm import failed, so the check runs.

## Stubs left

- None.

## Gotchas

- element-checks must emit `{ ref: $bind(name) }` for `ref`: check.ts still writes `$$use(name)`, so `ref` is not checked yet.
- `ref` imports `BindableMark` and `WritableMark` from `brumate/signals`, which resolves to dist. A typecheck needs `npx tsdown` first, as types.d.ts already needs. A test must import `$bind` from `brumate/signals`, not from src, or the two `BindableMark` types differ.
- skipLibCheck is on in tsconfig.json, so only `tsc --noEmit -p tsconfig.elements.json` checks errors inside elements.d.ts. The typecheck script runs both. `Attr<Referrr>` failed the second and passed the first.
- server.ts cannot import `Markup` from `brumate/elements`: tsdown then inlines a second copy, with its own unique symbol. Its `Component` takes `Promise<string | object>`.
- SVG elements share one attribute list, so an SVG attribute on the wrong SVG element is not an error.
- Event names must be in `ElementEvents` (the DOM `HTMLElementEventMap`). An event of a component part, such as `onItemaction`, on a plain element needs a merge into `ElementEvents`.
- `style` is a string only, as in the markup.

## Proposed learnings

- A d.ts contract needs a test with `@ts-expect-error` and a proof that each fails without its comment | skipLibCheck hides errors in the d.ts itself | packages/brumate | yes

## Verification

- `npx tsc --noEmit -p .` and `-p tsconfig.elements.json` in packages/brumate: exit 0, after `npx tsdown`.
- Blanked the 22 `@ts-expect-error` comments in a copy: 19 errors, one each.
- `node ../tsc/bin/brumate-tsc.js --noEmit` exit 0 in packages/ui, website and the seven examples.
- `npx vitest run` in packages/tsc: passed.
- `npx vitest run --maxWorkers=2` in packages/ui: 505 passed. Removed `wbr` from `Elements`: the coverage line failed.
- `npx vitest run` in packages/brumate: 955 passed, 5 expected fail.
- `npx oxlint` and `npx oxfmt --check`: exit 0.
- packages/ui not changed, so its suite was not run.

## Size

- Estimated M, actual M. No runtime code, so no gzip change.
