# Log: script-nonce

## 2026-11-26 setup

- A first `pnpm install` and `pnpm build` ran by mistake in the main checkout (the shell cwd, not the worktree). No tracked file changed there (`git status` clean); only ignored `node_modules` and `dist`. Redone in the worktree with `pnpm -C`.

## Proof (before the change)

Branch `fix/script-nonce` at the story head. `vitest run test/default-scripts` with the new tests:

- dev, `handle(request, { nonce: 'abc123' })`: the tag is `<script type="module" src="/@vite/client">`, expected ` nonce="abc123"`. Failed.
- build, same call: `<script type="module" async src="/assets/client-BLEDDbJL.js">`, no nonce. Failed.
- 8 other tests passed.

## Design notes

- The default scripts are a string fixed when the routes module is generated, and the nonce is per request. The generated `handle` now calls `withNonce(scripts, options?.nonce)`, which adds `nonce="…"` to each `<script` tag that has none. The nonce is escaped for an attribute.
- Shell pages: a prerendered page is written by `prerender()`, which passes no nonce, so its tags have none. The generated `loadShell` runs the same `withNonce` over the shell it reads from Nitro's server assets, with the nonce of the request. Both the entry tag and the inline state scripts get it. An explicit `options.shell` is left as the app gave it. A page written to `.output/public` is a file that Nitro serves before the entry, so it never sees a nonce: it needs `'self'` or the hashes of `.brumate/prerender.json`.
- Nonce source in e2e: the four example entries make a nonce per response, pass it to `handle` and send `script-src 'nonce-…' 'strict-dynamic'`. This is how an app with no policy proxy does it. The proxy in `serveNitro` joins its Trusted Types policy to that header. A proxy that invents the nonce could not tell the app which one it used, so the nonce would not reach `handle`.
- `serveNitro.stop()` fails the run when no page came with a nonce policy, so an entry that stops sending it cannot pass silently.
