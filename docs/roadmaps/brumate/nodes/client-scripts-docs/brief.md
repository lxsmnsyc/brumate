---
id: client-scripts-docs
title: Docs: vite dev serves pages, scripts are a default
status: done
priority: 
type: docs
story: client-scripts
early: false
outline: false
milestone: 
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: 
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent: 212505
owns:
  - website/docs/getting-started.md
  - website/docs/reference-plugin.md
shared:
  - website/docs/deploying.md
  - packages/brumate/skill/**
reserves: []
provides: []
depends_on:
  - on: examples-glue
    kind: hard
    why: the docs show the examples as they end up
  - on: script-nonce
    kind: hard
    why: the docs describe the nonce on the default tags
  - on: nitro-prerender
    kind: hard
    why: the docs describe prerendering under Nitro
---

# Docs: vite dev serves pages, scripts are a default

## Goal

- getting-started "Serve pages in development" becomes: run `vite dev`. The own-server code moves to deploying.md as the advanced path, with `toNodeHandler` from `srvx/node` and no `scripts`.
- deploying.md: Nitro is the production server, and the own-server section uses `srvx/node`, with no manifest read and no `node.ts`; one paragraph says `scripts` overrides the default (for example a nonce or `''`).
- reference-plugin: `appType: 'custom'` default, the `middlewareMode` and Nitro skips, the warning for `spa`/`mpa`.
- The brumate skill: no hand-written script tags in its server examples.
- Prerendering under Nitro (nitro-prerender, 2026-11-26; read its outcome's Gotchas): `website/docs/deploying.md` Prerendering (about lines 202-237) describes only the `--ssr` build and says a server passes `shell` itself; under Nitro the plugin prerenders after the server environment, plain pages go to `.output/public` as files, shell pages go to Nitro server assets and `handle` passes them with no entry code, and the routes must build in their own environment (`src/entry-server.ts`). A page with a user-specific `#defer` must use shell mode or stay out of `paths`. `website/docs/reference-plugin.md:44` gives the `client` default as `'dist/client'`; under Nitro it is the client environment's output, and `clientOutDir` exists (default-scripts).
- Nonces (script-nonce, 2026-11-26): `website/docs/reference-security.md:89-97` still shows a hand-written `scripts` tag with the nonce and `'self' 'nonce-…'` without `'strict-dynamic'`. An app passes `handle(request, { nonce })` and sends `script-src 'nonce-…' 'strict-dynamic'; object-src 'none'; base-uri 'none'`; prerendered files rely on the hashes in `.brumate/prerender.json`. The cache docs should say a kept page gets the request's nonce (kept-page-nonce).
- From the examples-glue review (2026-11-26): `website/docs/deploying.md:139` still says `examples/todos` has `toRequest`/`send` in `node.ts`, which is deleted; point it at `server.prod.ts` and `toNodeHandler`. The getting-started server example (about line 110) writes a hand-written tag; the guard test exempts that one occurrence until this node removes it. The five examples now run on Nitro, todos on `srvx/node` (see examples-glue's outcome).

## Acceptance

- [ ] The guard test of examples-glue passes with the new docs.
- [ ] Writing follows the plain-writing skill.

## Sizing

S: three doc pages and the skill.
