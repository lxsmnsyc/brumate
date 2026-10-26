---
name: error-catalog
version: 1
status: draft
defined_by: brm-skill
---

# Contract: error-catalog

## Purpose

One entry for each compile error of the compiler. The skill renders errors.md from it (brm-skill), and `brumate check` adds a code and a docs link to each entry (brumate-check).

## Interface

To be frozen by brm-skill, as its first step. Proposed shape, in packages/brumate/src/error-catalog.ts:

```ts
export interface ErrorEntry {
  /** The message the compiler reports, with `{name}` for the parts that vary. */
  message: string;
  /** What causes it, in one sentence. */
  cause: string;
  /** The form to write instead, as a short `brm` example. */
  fix: string;
  /** Added by brumate-check: a code such as BRM012, and the docs page that explains it. */
  code?: string;
  link?: string;
}
export const ERRORS: readonly ErrorEntry[];
```

## Behavior

- A test fails when the compiler reports a message that has no entry.
- Codes are assigned once and never reused.

## Stub

None. brumate-check starts once the shape is frozen, and adds `code` and `link`.

## Contract tests

packages/brumate/test/skill.test.ts.

## Changes

- v1: draft.
