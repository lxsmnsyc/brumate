# Checkpoint 2026-10-27, wave 8

## Merged

- ui-generics (#300): the parts that take values have a type parameter `V` (`<V, T>` with `as`). No `any` is left in their props. A `#template` parameter needs a type until template-context-types lands.
- docs-generator (#298): a ```` ```props Name ```` block becomes a props table from the exported type, as plain HTML (no browser code). The props-table contract v1 is frozen (the maintainer approved it). The website has its own vitest, and CI runs its tests.
- rest-ref-local-error (#299): props and rest are destructured, spread in markup, or read by key; any other use of the whole object is an error, and a write to a key is an error (props are read-only). Casts are allowed in a key read and in a markup spread. The only hit, NavigationTreeItem, now passes its attributes in markup, so a ref reaches its row.
- Not roadmap nodes: #301 (a React Aria mention removed from Button.brm, since the props table prints doc comments).

## Decisions (the maintainer)

- The props-table contract v1, as written.
- Props rule details: casts allowed, mutations are errors, call results spread in markup are fine (`{...field.attrs(path)}`); only passing the props or the rest itself is an error.
- The conditional spread `{...(open ? rest : {})}` stays an error until conditional-rest-spread defines the "branch off" behavior.

## Added nodes

- should: template-context-types (types; an untyped template parameter gets no type, and template bodies may not be checked at all), conditional-rest-spread (core-correct).
- The four docs nodes now write the doc comments of their parts' props in packages/ui/src.

## Notes

- Lockfile changes go through a clean worktree with `pnpm install --lockfile-only`, never in a worktree with linked node_modules.
- A worker's force push was refused; `gh pr update-branch` brings a branch up to date instead.
- Several workers' runs of the ui suite failed under load and passed on a rerun.

## Next

- `plan.py ready`: the four docs nodes, drop-react-aria-refs, element-checks (L, critical path), aria-types, brumate-check, and the core-correct should nodes (memo-error-resume, handler-code-wait, runtime-brand-checks, setter-ref-forward, conditional-rest-spread, visible-forwarded-ref).
