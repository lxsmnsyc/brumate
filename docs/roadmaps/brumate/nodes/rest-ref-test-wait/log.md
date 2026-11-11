# Log: rest-ref-test-wait

- The two tests "a ref left in the rest props reaches the element that spreads them" and its cast twin in packages/brumate/test/resume.test.ts (about lines 5596 and 5603) waited `await new Promise((done) => setTimeout(done, 300))` after the click, then asserted once. The first module load can take longer than 300 ms under load, so `.seen` is still empty: `expected '' to be 'BUTTON'` (release-0.7 outcome).
- Not reproduced here: the suite was not looped, as the flake is rare. The fixed wait is the cause by construction, since the assertion runs once at 300 ms whatever the load.
- Fix: `await waitFor(() => expect(text('.seen')).toBe('BUTTON'))`, the file's own helper (5 s timeout, retries).
- The other fixed waits in the same describe (100 ms) come after a `waitFor` and check that nothing more happens. They do not race the element, so they stay.
