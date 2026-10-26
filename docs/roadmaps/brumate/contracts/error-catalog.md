---
name: error-catalog
version: 1
status: frozen
defined_by: brm-skill
---

# Contract: error-catalog

## Purpose

One entry for each compile error of the compiler. The skill renders errors.md from it (brm-skill), and `brumate check` adds a code and a docs link to each entry (brumate-check).

## Interface

Frozen by brm-skill at version 1, in packages/brumate/src/error-catalog.ts:

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

The file also exports helpers that do not change the shape:

- `findError(message)`: the entry for a message that the compiler reported, with or without its `(File.brm:line:column)` suffix.
- `matchesError(entry, message)`: true when a message has the form of an entry.
- `renderErrors()`: the text of `packages/brumate/skills/brumate/references/errors.md`. A test fails when the file differs. `UPDATE_SKILL=1 npx vitest run test/skill.test.ts` writes it again.

Rules of an entry:

- `message` is the text of the compiler's message with each part that varies as `{name}`, where `name` is one word. Two entries never have the same message once the names are removed. A message that the compiler builds from other text has no entry, such as the message of a script that the parser of the code rejects.
- `cause` and `fix` are plain text. `fix` is a fragment of a `.brm` file or of its script, so it is not compiled.
- An entry holds the errors that the compiler reports for a `.brm` file: the syntax errors, the errors of the script functions, the errors of the code that the browser gets, and the errors of modules of reactive logic. Warnings have no entry.

## Behavior

- A test fails when the code of the compiler reports a message that has no entry. It reads the literals that `fail`, `report('error', …)`, `ModuleError` and `severity: 'error'` take, so a new error needs an entry in the same change.
- Codes are assigned once and never reused.

## Stub

None. brumate-check starts once the shape is frozen, and adds `code` and `link`.

## Contract tests

packages/brumate/test/skill.test.ts.

## Changes

- v1: draft.
- v1: frozen, with the shape unchanged. brumate-check fills `code` and `link` of each entry, and `renderErrors()` already prints them.
