# Outcome: drop-react-aria-refs

## Built

- Every mention of React Aria in packages, website, docs (not docs/roadmaps), examples and README.md is reworded to describe the behavior. Before: 358 lines in 207 files. After: 0.
- Hook and component names of that library are gone from comments, such as `useInteractOutside`, `FocusScope`, `usePress`, `useFocusRing`, `mergeProps`, `useListData`. React Stately (24 lines) is reworded too.
- website/ui/influences.md has "How the parts behave" in place of the React Aria section. It names Terracotta and Headless UI as projects, with the WAI-ARIA patterns and the platform.
- docs/proposals.md keeps its design and names the WAI-ARIA patterns as the source of behavior.
- Test names and headers describe the behavior. Prop names such as `isDisabled` and `onPress` stay.
- Changeset .changeset/drop-react-aria-refs.md (patch).

## Deviations

- React Stately and `data.md` heading "Differences from React Stately" (now "Notes on the data") were also reworded. The brief names only React Aria.
- The Apache-2.0 sentence in the proposals is gone, because the package is MIT and no code is ported.
- No code changed. Only comments, prose and test names.

## Stubs left

- None.

## Gotchas

- `oxfmt --check` at the root fails on docs/roadmaps/brumate/reviews/wave-8.md on main. It is outside this node.
- The "Differences from" section of data.md now has a neutral heading. Its three bullets are unchanged.

## Proposed learnings

- Do not name another library as the source of a behavior in code or docs | the package is MIT and the behavior is described by WAI-ARIA | packages/ui, website/ui | yes (the verify grep)

## Verification

- `git grep -n -i 'react aria\|react-aria\|reactaria\|stately' -- packages website docs ':!docs/roadmaps' examples README.md`: 0 lines.
- `npx vitest run` in packages/ui: 58 files, 540 passed, 1 expected fail.
- `node scripts/check-samples.ts` in website: 63 samples, 0 problems.
- `npx oxlint --quiet`: clean. `npx oxfmt --check`: only wave-8.md fails, as on main.
- `npx brumate-tsc --noEmit` in packages/ui: exit 0.

## Size

- Estimated M, actual M.
