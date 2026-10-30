# Outcome: changeset-review

## Built

- PR #390 cut the pending changesets from 166 to 51, one entry per user-facing change: brumate 41 (22 minor, 19 patch), @brumate/ui 7 minor, language-core 1 minor, language-server, tsc and typescript-plugin 1 patch each. No major.
- About 90 changesets were merged into about 30 entries. Internal refactors, doc-comment work and every @brumate/ui patch were dropped: @brumate/ui is at 0.0.0 and no fix of it ever reached a user.
- New changesets for language-server, tsc and language-core, whose source changed with none written.
- Breaking changes start with "Breaking:" and are minor.
- `benchmarks/brumate-0.3` depends on `npm:brumate@0.3.0`, so the version step no longer rewrites it to the new release.

## Decisions (the maintainer)

- The renames of `formErrorsOf` and `rootOf` stay out of the changelog: they are internal.
- `update-batching` is marked "Breaking:".

## Notes

- `changeset version` prints three warnings for `bench-brumate-0.3` about its `npm:` dependency. They are harmless: the package is ignored.
- The language packages' changelogs get many "Updated dependencies" lines, the default changesets output.
