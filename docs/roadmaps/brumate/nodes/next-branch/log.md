# Log: next-branch

- Read GOAL.md, the roadmap CLAUDE.md, the brief and the release-0.4 outcome. The repo is public, so CI cost is not a concern.
- Maintainer and orchestrator decisions: no prereleases from `next`, the Release workflow stays on `main`; the orchestrator creates `next` after this PR merges; no other brief is edited.
- plan.py reads `branches:` as a map (`parse_frontmatter`), so a value of `a -> b` becomes a list. `promote: next -> main` parses as ["next", "main"], and both are known branches for `check`.
- No CONTRIBUTING.md exists. The contributor notes are in README.md (section Development), so the Branches section went there.
- test.yml: added `next` to the push branches. The pull_request trigger has no branch filter, so it already runs for `next`; left as is so stacked branches keep running.
- release.yml: unchanged, `main` only.
- `.changeset/config.json` has `baseBranch: main`; left unchanged since `next` publishes nothing.
