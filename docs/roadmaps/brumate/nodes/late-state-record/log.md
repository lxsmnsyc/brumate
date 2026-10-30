## 2026-10-30

- Not fixed by #352: resume.ts still wrote the record when the slot held the server promise, even after asyncMemo started a newer load.
- Tests in resume.test.ts (reads that the compiler cannot check): record before the new load settles (failed on main: the slot became 1), and new load settled first (passes on main, kept as a guard).
- Fix: the record writes only when `loads` has no entry for the slot.
- "gives the element of a component in as" failed once under load, passes alone.
