# Log: missing-attributes

- Read the review (type-parity.md, section 2 and 4 I). `autocorrect` was already global; the rest was missing.
- Added the attributes and value types to packages/brumate/elements.d.ts, a case for each group to test/elements-types.ts, and .changeset/missing-attributes.md (minor).
- On the old elements.d.ts, `tsc --noEmit` in packages/brumate gives 11 errors with the new cases; now 0.
- No caller in the workspace broke from the closed values.
