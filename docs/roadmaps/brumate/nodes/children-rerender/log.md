# Log: children-rerender

- 2026-11-19: built on batch/brumate-main. Wrote the guard test in packages/ui/test/navigation-tree.test.ts: mount once and unmount (loads the core), mount again, then open and close rows.
- First run failed on my own expectation: the chevron press keeps focus on the row, not on the chevron (as tree.test.ts says). Fixed the test, not the code.
- The test passes with no runtime change, so #281 and rest-ref-local-error already fix the case.
