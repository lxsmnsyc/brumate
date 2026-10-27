# Log: as-sound

- Wrote the new cases at the end of packages/ui/test/props-types.ts first. On the old as.ts the typecheck failed: 4 unused `@ts-expect-error` (tabIndex, innerHTML, className, scrollTop style fields were accepted), `currentTarget` untyped, `svg` not a target.
- Rebuilt as.ts on `Elements`, `ElementProps`, `Component` and `PropsOf` of `brumate/elements`. The extra `Handlers` and `Fields` types are gone, since `ElementProps` has the handlers.
- Worktree setup: language-core/node_modules must be a real directory with `brumate` linked to the worktree, or the checker uses the main checkout's stale brumate and types components as `Promise<string>`.
- Proved each new marker: removing it makes the typecheck exit 2.
