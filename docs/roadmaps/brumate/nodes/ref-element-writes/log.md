# Log: ref-element-writes

- 2026-11-19 probe: packages/brumate/test/resume.test.ts already had a resume test with `refLoop` ("stops updates that keep writing what they read"). It clicks "Go" and expects one console error with "did not settle" (BRM187). It passes on this base (`vitest run test/resume.test.ts -t "keep writing"`). So the resumed page loops after one write, as the code reading said, and the guard stops it. I kept it and named the ref case in its title.
- Option A: `ref-loop` in test/differential/data.ts is now `accepted`, with the reason (new row, new element, Svelte and Solid loop too).
- BRM187 message: not changed. The guard in `queue` (runtime/client/updates.ts) sees only the update name and scope key. The ref write is a plain `set` queued in `afterInsert`, so the guard cannot tell it from another write without a flag on every write. Not worth it for a message. No changeset.
