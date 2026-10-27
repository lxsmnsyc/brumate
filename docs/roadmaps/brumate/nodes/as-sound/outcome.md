# Outcome: as-sound

## Built

- packages/ui/src/as.ts reads `Elements`, `ElementProps`, `Component` and `PropsOf` of `brumate/elements`. `AsTarget` is `keyof Elements | Component`, so SVG tags are targets. `TargetProps<T>` and `AsProps<T, Own>` keep their names and type parameters. `ElementTag`, `ElementProps` and `Component` are still exported (re-exported or derived from brumate).
- The local `Fields` and `Handlers` types are removed. Handlers come from `ElementProps`, so `currentTarget` is the element.
- A field that is not an attribute (`tabIndex`, `className`, `innerHTML`, `scrollTop`) is now an error. A closed set of values (`loading`) is checked.
- One block of new cases at the end of packages/ui/test/props-types.ts (starts at the comment `as-sound`), 11 `@ts-expect-error` lines.

## Deviations

- part-props stays at v1: no name changed. A line v1.2 in its Changes records the behavior.
- Added the changeset .changeset/as-sound.md (patch for @brumate/ui).

## Stubs left

- None.

## Gotchas

- SVG elements share one attribute list in `brumate/elements`, and its values are loose (`viewBox` takes a number), so only an unknown SVG attribute errors.
- A component target is any `Component<any>`; one whose props infer as `never` takes any attribute, as before.
- Worktree: packages/language-core/node_modules must be a real directory with `brumate` linked to the worktree, then `npx tsdown` in packages/brumate, packages/language-core and packages/tsc before `brumate-tsc`.

## Proposed learnings

- None.

## Verification

- Old as.ts with the new cases: typecheck exit 2 (unused markers, `currentTarget`, `svg`).
- New as.ts: `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui exits 0.
- Removed each new marker in turn: exit 2 every time.
- See the PR for the suite, lint and format results.

## Size

- Estimated S, actual S. No runtime code, so no gzip change.
