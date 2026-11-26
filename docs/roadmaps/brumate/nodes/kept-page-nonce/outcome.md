# Outcome: kept-page-nonce

## Built

- `packages/brumate/src/runtime/server.ts`:
  - `KeptPage` stores the `nonce` of its render.
  - `keptPage(key, nonce)` replaces every ` nonce="old"` of the body with the nonce of the request, or removes it when the request has none, and drops `content-length`. The replacement is a function, so `$&`, `$'` and `` $` `` in a nonce are text.
  - A page kept without a nonce is not served to a request that has one. That request renders its own page and keeps it.
  - `keepPage(key, response, event, nonce)` does not keep a page when its nonce is in the body outside its `nonce="…"` attributes, or in a stored header value. The check covers the raw and the attribute-escaped nonce. Such a page renders for each request.
- `packages/brumate/src/runtime/route-render.ts`: passes `options.nonce` to both.
- `packages/brumate/test/page-cache-nonce.test.ts`: 7 tests (new nonce, no nonce, kept without a nonce, five nonces with `$`, and the nonce in a meta policy, in script text and in a header).
- `.changeset/kept-page-nonce.md` (patch).

## Proof

- base: `origin/main`, `pnpm --filter brumate exec vitest run test/page-cache-nonce`. 7 failed. A second request with nonce `two` got `<script nonce="one">` in the body from the store, and a request kept without a nonce was served to a request with one.
- branch: the same command, 7 passed.

## Deviations

- None. The files are the brief's shared paths.

## Stubs left

- None.

## Gotchas

- The check is conservative: a short nonce that appears in the page text by chance (`one` in a word) keeps the page out of the store. A real nonce is 16 bytes or more of random text, so this does not happen.
- `pageKey` has no nonce, so one stored page serves requests with and without a nonce once it was rendered with one. A page rendered without a nonce serves only requests without one.
- A CDN in front of the server that keeps the page (`cache-control: public`) also keeps the nonce of its response and its policy header together, so it does not mix them.

## Proposed learnings

- A per-request value must not be stored inside a kept page | a hit would send the old value with the new request's headers | packages/brumate/src/runtime | no

## Verification

- `vitest run test/page-cache test/cache test/idempotent test/routes`: 5 files, 67 passed.
- Checks of the whole node are in the commit run: lint, format:check, typecheck, `node e2e/run.mjs --only todos,tracker`.

## Size

- Estimated S, actual S.
- Risk estimated medium, measured medium: the hit path now rewrites the body when the nonce differs.
