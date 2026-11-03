# Log: a11y-in-tests

- Checked first: no `checkAccessibility` in testing.ts, no peer dependency. e2e uses axe-core in its own package.
- The brief says `mount` and `visit` return the method. Both do now, through a shared `Checks` interface. `answerCalls` and the `Actions` type are unchanged.
- happy-dom runs axe-core. Layout rules (color-contrast, scrollable-region-focusable) are off.
- The test runs a fixture through createVitest, as testing.test.ts does, in test/testing-a11y/, so the 6-test count of that file stays.
- Full `pnpm test` under load failed render/resume tests (timeouts, different files each run); both pass alone.
