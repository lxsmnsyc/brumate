# Outcome: style-global

## Built

- `<style global>`: rules with no scope attribute, no entries in `targets`. `lang="scss"`/`less` and `${...}` work. `:global(...)` inside it is allowed and unwraps. Sent with the component like a scoped style.
- packages/brumate/src/{ast,parser,css,error-catalog}.ts; BRM189 (unknown `<style>` attribute), BRM190 (`global` with a value). `<style global>` in a block is the existing BRM011.
- Tests in packages/brumate/test/styles.test.ts. Docs: website/docs/styles.md ("Global blocks"), docs/grammar.md, docs/decisions.md. Changeset .changeset/style-global.md (minor, brumate).
- Generated: website/docs/errors.md, packages/brumate/skills/brumate/references/errors.md, test/error-codes.json.

## Deviations

- Codes BRM189 and BRM190 were picked as the next free ones; another node adding codes at the same time will collide in error-catalog.ts, error-codes.json and the two errors.md files (regenerate with UPDATE_SKILL=1).
- packages/language-core needed no change (it uses the parser). No changeset for it. The brm skill has no style section beyond the regenerated errors.md.
- The acceptance test for "applies to child components" is structural: no scope attribute in the CSS and no targets. The `website/ui` docs were not rewritten to use it.

## Gotchas

- The other attributes of `<style>` used to be ignored; now any besides `lang` and `global` is BRM189.

## Verification

- pnpm lint (warnings only), format:check, typecheck, `pnpm --filter website check:samples` (65 samples, 0 problems): pass.
- pnpm build: pass. pnpm test: after regenerating errors.md, packages/brumate passes; resume.test.ts hit a hook timeout under load and passed alone.

## Size

- Estimated S, actual S.
