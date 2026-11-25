# Outcome: script-nonce

## Built

- `packages/brumate/src/routes.ts`: the generated `handle` writes `scripts: options?.scripts ?? withNonce(<default>, options?.nonce)`. `withNonce` adds `nonce="…"` (escaped for an attribute) to each `<script` tag that has none, so both dev tags and the entry tag of a build carry it. Without a nonce the tags are as before. An explicit `scripts`, including `''`, is written as the app gave it.
- Prerendered shells: `loadShell`, which reads the shell of a page from Nitro's server assets, runs `withNonce` over it with the nonce of the request. The entry tag and the inline state scripts of the shell get the nonce. An explicit `options.shell` is left alone.
- `packages/brumate/types.d.ts`: `handle` of `virtual:brumate/routes` takes `RouteOptions`.
- `examples/{tracker,kit-app,ui,browser-async}/src/entry-server.ts`: each makes a nonce per response (`btoa(crypto.randomUUID())`), passes it to `handle`, and sends `content-security-policy: script-src 'nonce-…' 'strict-dynamic'` on HTML answers.
- `e2e/lib.mjs`: `serveNitro` joins its Trusted Types policy to the policy of the app instead of replacing it, and `stop()` fails the run when no page came with a nonce policy. `e2e/README.md` describes it. The four suites call `watchPolicy`, so a script that the policy blocks fails them.
- Tests: `packages/brumate/test/default-scripts/default-scripts.test.ts` checks the nonce on every tag with a `src` in dev and in a build, none without a nonce, an escaped nonce, and an explicit `scripts` that wins.
- `.changeset/script-nonce.md` (patch).

## How an app passes a nonce

Pass `nonce` in the options of `handle` (`virtual:brumate/routes`), and send a policy that names the same nonce:

```ts
const nonce = btoa(crypto.randomUUID());
const answer = await handle(request, { nonce });
answer.headers.set(
  'content-security-policy',
  `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`,
);
```

- The default scripts (`/@vite/client` and the start module in dev, the entry tag in a build), the inline scripts and the `<style>` and `<link>` elements of the render all carry it.
- Make a new nonce for each response. A page that `cache` keeps still holds the nonce of its first render, on main as well as here. Node `kept-page-nonce` fixes it from main, so until it ships, do not combine a nonce policy with a `cache` export.
- A prerendered page cannot carry a per-request nonce:
  - A page that the build wrote to the client output (`.output/public`) is a file that Nitro serves before the entry. It has no nonce and no policy from the entry. A policy for it needs `'self'` for the entry script and the hashes of `.brumate/prerender.json` for the inline scripts.
  - A shell page (a page with a `#defer` block under Nitro) goes through `handle`, so it gets the nonce of the request on every script tag. The nonce is added at request time to the build's text.
  - A shell that the app passes as `options.shell` is sent as given.

## Proof

- base: `fix/script-nonce` at the story head (0f7c50d6 plus the brief), `pnpm --filter brumate exec vitest run test/default-scripts` with the new tests. Dev: `<script type="module" src="/@vite/client">` has no ` nonce="abc123"`. Build: `<script type="module" async src="/assets/client-BLEDDbJL.js">` has none. 2 failed, 8 passed.
- branch: the same command, 10 passed.

## Deviations

- Edited `examples/{tracker,kit-app,ui,browser-async}/src/entry-server.ts`, outside the brief's paths. The brief allows no other way to get a nonce into `handle`.
- Nonce source for e2e: the entries make the nonce and send the policy, not the proxy. An app with no policy proxy does it this way. A proxy that makes the nonce cannot give it to `handle`, since the proxy sits outside the process. A proxy that reads a header such as `x-nonce` would need the same entry change and trusts a header from the client.
- `serveNitro.stop()` asserts at least one page had a nonce policy, which the brief did not ask for.

## Stubs left

- None.

## Gotchas

- For client-scripts-docs: document the `nonce` option as the way to run under a strict policy, with the limit for prerendered files above. `'strict-dynamic'` allows the module chunks that the entry imports, but a file from `.output/public` has no nonce, so that page needs `'self'`.
- `withNonce` uses a replacement function, so a `$&` or `$'` in a nonce is text. A test covers four such nonces.
- The nonce is added by a regex on `<script` followed by a space or `>` with no `nonce=` in the tag. The build text of a shell holds no `<script` inside a string, as the state script escapes `<`. A shell that an app writes by hand with such a string would get an extra attribute there.
- The first `pnpm install` and `pnpm build` of this run ran in the main checkout by mistake (shell cwd). Tracked files are clean there. Only ignored `node_modules` and `dist` were rebuilt, from the main branch sources.

## Proposed learnings

- A value that is per request (nonce) cannot be baked into generated module text | write it at call time in the generated function | packages/brumate/src/routes.ts | yes

## Verification

- `vitest run test/default-scripts test/routes test/prerender test/prerender-environments test/no-hand-scripts`: 5 files, 58 passed.
- `node e2e/run.mjs --only tracker,kit,ui,browser-async,todos,nitro`: tracker 18, kit 5, ui 61, browser-async 6, todos 10, nitro 2 passed.
- `oxlint --quiet`: 0 errors. `oxfmt --check`: pass. Root `pnpm typecheck`: pass.
- Self-review (round 1): found a `no-conditional-expect` lint error in the test helper, fixed. No other findings.

## Size

- Estimated S, actual S.
- Risk estimated low, measured low: the change only adds an attribute when a nonce is passed.
