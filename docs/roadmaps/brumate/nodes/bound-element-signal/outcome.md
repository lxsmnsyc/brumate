# Outcome: bound-element-signal

## Built

- A signal that only the `ref` of a component binds is checked with `$$sendableRef`, which passes an `Element`, `null` or `undefined` and checks anything else as page state. `<Toolbar ref=$bind(el)>` with `let el = $signal<HTMLElement>()` type checks, as `<div ref=$bind(el)>` did.
- packages/brumate/src/analyze.ts, `declareBinding`: records the prop name of each binding in the new `Declaration.boundAs` (packages/brumate/src/model.ts).
- packages/brumate/src/check.ts, `sentDeclarations`: a declaration whose `boundAs` is exactly `{ref}` gets `$$sendableRef`, so a function in it still errors, also when a component types its `ref` as `Bindable<() => void>`. A signal that another prop also binds gets `$$sendable`.
- Tests in packages/brumate/test/check.test.ts ("signals that bind to a ref"): ref only uses `$$sendableRef`, a function bound only to `ref` too, ref plus another prop or another prop alone use `$$sendable`. A probe in packages/ui showed the function error at its declaration. The first failed on main.
- packages/ui/test/fixtures/asControls.brm: the 15 element signals are `$signal<HTMLElement>()`.

## Deviations

- The check knows the binding by the prop name `ref`, not by the `Bindable<...>` type of the prop. The `$$sendable` call sits at the declaration, before and apart from the component call, and the checker has no link from a signal to the type of the prop it is bound to. The name matches the element-types contract, where `ref=$bind(name)` is the only form of ref. A part that forwards an element through a prop of another name still gets the error.
- Edits outside the owned paths: analyze.ts and model.ts (the name must be recorded where the analyzer sees the binding), and packages/ui/test/fixtures/as-collections-template.brm (comment only).
- as-collections.brm and as-collections-template.brm keep `$signal<any>()` for `listRef` and `itemRef`. ListBox and ListBoxItem type `ref` as `Bindable<HTMLElement>` (no `undefined`), so a signal of `HTMLElement | undefined` fails with TS2322 there. ref-type-parts changes that type. After it lands, those four lines can use `$signal<HTMLElement>()`, and the comment above them goes.

## Stubs left

- None.

## Gotchas

- `ref=$bind(x)` on a component is an ordinary `value` attribute named `ref`. Only `ref` on an element is a `ref` attribute and fills `declaration.refs`.
- A `ref` binding of a signal that is also bound to another prop keeps the element check, since that value can reach the page state.

## Proposed learnings

- Compile-time checks that depend on how a prop is used belong in the analyzer's `declareBinding`, which sees the site and the owner | the check runs apart from the component call | packages/brumate/src | no

## Verification

- `npx vitest run` in packages/brumate: 55 files passed (975 passed, 5 expected fail).
- `npx vitest run --maxWorkers=2` in packages/ui: 56 files passed (529 passed, 7 expected fail).
- `npx tsc --noEmit -p .` in packages/brumate: no errors.
- `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui: exit 0 after `npx tsdown` in brumate, language-core and tsc. A deliberate `const bad: number = 'x'` failed it with TS2322, then I removed it.
- `npx oxlint`: exit 0. `npx oxfmt --check`: the only issue is docs/roadmaps/brumate/reviews/core-gaps-2.md, already on main and not touched here. `packages` and `.changeset` are clean.

## Size

- Runtime unchanged: only the compiler (analyze.ts, check.ts, model.ts) changed, so the produce and client chunks are not affected.
- Estimated S, actual S.
