# Outcome: next-branch

## Built

- GOAL.md: `branches:` is filled (`feature`, `fix`, `docs`, `chore`, `refactor`, `spike` -> `next`; `hotfix` -> `main`; `promote: next -> main`). The "Empty until then" comment now states the policy. The Milestones line for 0.4.1 says the 0.4.x nodes keep `target: main` in their briefs.
- docs/decisions.md: one entry with the policy (pull requests to `next`, hotfixes from `main` to `main`, `main` merged into `next` after every release, `next` promoted by a gated release node, no prereleases and no changesets pre mode).
- README.md: a Branches section after Development. There is no CONTRIBUTING.md, and the README holds the contributor notes.
- .github/workflows/test.yml: pushes to `next` run the Test workflow (test, check and website jobs). The `pull_request` trigger has no branch filter, so pull requests to `next` already run. `paths-ignore: docs/**` is unchanged.
- .github/workflows/release.yml: unchanged, `main` only.

## Evidence

`plan.py docs/roadmaps/brumate ready --json` now gives `target: next` to the ready feature nodes (for example usage-pruning-spike, search-params, style-global, values-spike; 29 of 31 ready nodes). The two ready 0.4.1 nodes, runtime-brand-checks and setter-ref-resume-rest, show `target: main`. visible-forwarded-ref, function-prop-reads and release-0.4.1 are not ready yet; their briefs have `target: main` written, so the policy does not reach them. `plan.py check` reports no errors and no policy warning (no "not a branch in the policy").

## Deviations

- `next` is not created. The orchestrator creates it from `main` after this PR merges, so it carries the CI change. The first acceptance item ("`next` exists") is pending that.
- No prereleases: the brief asked to decide on changesets pre mode, and the maintainer decided against it.
- No `type: hotfix` was written on the 0.4.1 nodes, since they set `target: main` explicitly. No other brief was edited.

## Notes

- The "release-node pattern for the sync of `next`" is in the decision and the README as a step after each main release; no release node was added.
- `.changeset/config.json` keeps `baseBranch: main`. `changeset status` in a pull request to `next` still compares with `main`, which is fine while `next` is only ahead of `main`.
- After `next` exists, set it as the target of new pull requests; GitHub's default branch stays `main`.
- Acceptance: policy in docs/decisions.md and GOAL.md: pass. CI on `next`: pass by trigger (to be seen on the first push to `next`). Targets in `ready --json`: pass. `next` exists: pending the orchestrator.
