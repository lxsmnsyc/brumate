# Outcome: attribute-value-case

## Built

- `Keyword<S>` in packages/brumate/elements.d.ts: the keywords in any letter case. Applied to the enumerated HTML attributes (`dir`, `type` of button and input, `formmethod`, `enctype`, `loading`, `referrerpolicy`, `crossorigin`, `popover`, `contenteditable` and the rest).
- The empty string is accepted for `translate`, `autocapitalize`, `contenteditable`, `spellcheck`, `writingsuggestions`, `autocorrect`, `popover`, `hidden`, `capture` and `crossorigin`.
- Type tests in packages/brumate/test/elements-types.ts, with `@ts-expect-error` for a wrong keyword and for `dir=""`.
- Patch changeset .changeset/attribute-value-case.md.

## Proof

- base: af581bbf, `npx tsc --noEmit` in packages/brumate with the probe lines: TS2820 `"LTR"`, TS2322 `""` on translate, TS2820 `"Submit"`.
- branch: same command, no errors; `tsc -p tsconfig.elements.json` clean.

## Deviations

- The first 12 characters of a keyword take any case; the tail of a longer one (`application/x-www-form-urlencoded`, `strict-origin-when-cross-origin`, `no-referrer-when-downgrade`) is all lower or all upper. Every case mix would give a union too big for the compiler.
- Added `referrerpolicy` and `crossorigin`, `capture`, `wrap`, `kind`, `scope` to the set, as HTML matches them case-insensitively.

## Stubs left

- None.

## Gotchas

- A new enumerated attribute should use `Keyword<...>` unless HTML matches it case-sensitively.

## Proposed learnings

- Wrap the keywords of an enumerated HTML attribute in `Keyword<>` | HTML matches them case-insensitively | packages/brumate/elements.d.ts | yes

## Verification

- Full brumate vitest: 3026 tests, one load timeout in a resume file that passed on rerun. oxlint: 0 errors. typecheck: pass. format:check: only docs/roadmaps/brumate/nodes/editor-sizes/brief.md, not mine.

## Size

- Estimated S, actual S.
