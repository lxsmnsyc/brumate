# Outcome: style-nonce

## Built

- `styleElement(id, css, nonce?)` in `packages/brumate/src/runtime/html.ts` writes `nonce="…"` (escaped) before `b-style` when it gets a nonce.
- `Context` in `packages/brumate/src/runtime/server.ts` has a `nonce` field, set from `options.nonce` in `render`. `Context.style` passes `this.root.nonce`, so child contexts, streamed bodies and `#defer` renders (all made by `render` or from the root) carry it.
- `addStyle` in `packages/brumate/src/runtime/client/page.ts` sets `sheet.nonce` from the first `[nonce]` element of the document. The `nonce` property keeps the value after browsers hide the attribute.
- Changeset `.changeset/style-nonce-csp.md` (patch, `brumate`).
- Tests: `packages/brumate/test/styles/nonce.test.ts` (server) and `nonce-browser.test.ts` (happy-dom).

## Proof

- base: `f6974d95`, `cd packages/brumate && npx vitest run test/styles/nonce.test.ts`. The nonce test fails: the output is `<style b-style="Card_1">…` with no `nonce`.
- branch: the same command passes, and `npx vitest run test/styles` passes (22 tests).

## Deviations

- None.

## Gotchas

- Server `style=""` attributes written from `${}` interpolations are inline style attributes. A nonce cannot apply to them, so a policy needs `style-src-attr 'unsafe-inline'` (or hashes) for them. The browser path uses `style.setProperty`, which CSP allows. Not changed here.
- `addStyle` finds the nonce on any `[nonce]` element. A page with a nonce has at least the state script or the server `<style>` elements with it. A page without a nonce gets no attribute.

## Verification

- `pnpm bench --only brumate --scenario todos`: JS before `load` 13.8 kB gzip before and after (33.1 kB raw both). Client JS emitted in dist 27.8 kB before, 27.7 kB after. Todos imports no `addStyle` path, so the client entry did not change.
- Fast and full checks: see the commit report.

## Size

- Estimated S, actual S.
