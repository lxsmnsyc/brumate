# Outcome: release-0.9

## Release

Released 2026-11-25. The maintainer merged the promotion #528 (d77f1cad, 2026-11-24), then module-async-memo #531 (75fa5fbd) went to `main`, the 0.9 changesets were rewritten as one-line lists in #532, and the maintainer merged Version Packages #529 (43661dd8). Release and Test passed on 43661dd8. brumate 0.9.0, @brumate/ui 0.3.1 and @brumate/language-core 0.3.2 are on npm. `release/0.10` is cut from `main` at 43661dd8 and `release/0.9` is closed.

## Deviations

- module-async-memo merged into `main` after the promotion, not into `release/0.9`, so the promotion did not carry it; Version Packages released it.
- The roadmap status was not updated at release time; this outcome was written afterwards.

## Open

None.
