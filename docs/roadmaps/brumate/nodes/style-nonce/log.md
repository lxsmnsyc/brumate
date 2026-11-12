# Log: style-nonce

## Proof on the base

- Commit `f6974d95` (`fix/style-nonce`, from `batch/brumate-main`), no source change.
- Command: `cd packages/brumate && npx vitest run test/styles/nonce.test.ts`.
- Result: fails. `render(Styled, {}, { nonce: 'a"b' })` returns `<style b-style="Card_1">p{color:red}</style><p>Hi</p>`, with no `nonce` attribute. The no-nonce test passes.
