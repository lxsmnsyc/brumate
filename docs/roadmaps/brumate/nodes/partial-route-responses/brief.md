---
id: partial-route-responses
title: A client navigation fetches only the routes that change
status: todo
priority: later
type: story
story:
early: false
outline: false
milestone: backlog
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
spent:
owns:
  - docs/roadmaps/brumate/nodes/partial-route-responses/**
shared: []
reserves: []
provides: []
depends_on:
  - on: html-attributes-navigation
    kind: hard
    why: both change how navigate.ts applies the next page; this builds on the attribute ownership it adds
---

> 2026-11-18: parked by the maintainer after the navigation debate (../../../../debates/navigation/debate.md). It restarts only when an app with a server asks for partial navigation, or a throttled run of benchmarks/navigation shows a wait a person would notice.

> 2026-11-18: the maintainer asked whether a component router would be better. Order now: partial-measure, then navigation-debate (gated), then partial-render-spike (gated: at least 40% fewer gzip bytes, or the debate's threshold). A no-go at either gate stops the story and keeps the full-page swap. route-render-split goes on, since it only splits server.ts.

> 2026-11-12: a must feature of 0.9.0 (docs/debates/0.9.0-cut/debate.md). It is a story: its children merge into `feat/partial-route-responses`.
> 2026-11-18: refined into 8 children. Two design questions are in [questions.md](./questions.md); the briefs assume the recommended answers until the maintainer decides.

# A client navigation fetches only the routes that change

## Goal

> 2026-11-26: kept parked by the maintainer after state-dedupe-spike's throttled run: Slow 4G swaps take 3.2 to 4.3 s on static pages (the website's deployment) and about 0.9 s from a server; partial responses can't reach static pages. state-printed-html takes the static case.

A link navigation sends the routes it keeps, and the server renders and streams only the routes that change, with their head entries, `<html>` attributes and state records. A form, a reload, an unknown build, a request without the header and any case the server cannot answer in part get the full page, as today.

The model stays the same: the server renders, the client resumes, and a page that needs no code ships none. The client still swaps route regions in `planRoutes` and `replaceRoutes`; it no longer downloads or parses the layouts it keeps.

## Context

- Chosen by the maintainer on 2026-10-30 over component-based routing (React Router, Solid Router). A client router would ship every page component to the browser, and would need server-only components and `await` in the browser (browser-await-spike). This story is the first step if navigation cost matters.
- Spec: `docs/proposals.md` (client router) and `docs/decisions.md` line 30 (routes and layouts), line 46 (`navigate`, loader), line 144 (head rerun scripts).

### Current code (packages/brumate/src, at main ffd77d73)

- `runtime/navigate.ts:187` `planRoutes` compares the current route state (`b-route`, `b-root`) and pairs route slots by name and key in `plan` (`:123`). `:214` `replaceRoutes` swaps the regions, calls `keepStyles` (`:163`), sets `b-drop`, `b-roots`, `b-alias` and runs the new state records.
- `runtime/navigate.ts:700-720` `navigate` sends `x-brumate-base` (the next free scope ID, from `base()` at `:434`) and reads the whole first render up to `</html>` (`:752`), parses it with `DOMParser` (`:771`), then calls `planRoutes`. The head is merged in `updateHead` (`:513`), the `<html>` attributes are copied at `:785-795`.
- `runtime/navigate.ts:581` `prefetch` fetches the full page with `x-brumate-base`, keeps it 10 s in `prefetched` (`:565`), and `takePrefetched` (`:620`) uses it only when `base` is equal.
- `runtime/server.ts:4235` `renderPage` reads `x-brumate-base`, renders the full tree through `viewComponent` (`:4120`), which writes `<!--R<layout scope>:<slot>:<route scope>:<key>-->` around each slot (`:4126`). It sets `vary: x-brumate-base` (`:4313`). `renderRoute` (`:4725`) keeps public pages under `pageKey` (`:3965`), which already includes the base.
- `runtime/server.ts:4482` `handleRoute` skips the prerendered shell when `x-brumate-base` is present. `runtime/defer.ts:50` also sends the base.
- Server pieces that the partial render must keep correct: layouts render before their routes and provide contexts (`decisions.md:30`); the `b-html` list of `<html>` attributes (`server.ts:3314`); state records and their `b-root`, `b-route`, `b-build` attributes (`server.ts:2500`); `#loading` views (`renderView`, `:4088`).

### Design decisions (made here from the code and the prior art)

1. The request header is `x-brumate-keep` and replaces nothing: `x-brumate-base` stays for the ID start. The value lists the slots that the client has, as `name:key:layoutScope:routeScope`, nested. The server needs the client's layout scope IDs to write the same `layout` field in the region comments as the page that the client has.
2. A kept layout still runs on the server, with its output and state records dropped. Contexts that a layout sets reach the new routes, as they do today. Skipping the layout would break `$getContext` in a route. The saving is bytes and client parsing, not server work. A later node can cache the layout's context.
3. The response is still HTML with the same region comments, so `planRoutes` and `replaceRoutes` stay, and the client pairs by `layout` scope, not by nesting. The server marks the answer with the response header `x-brumate-partial: 1` and `b-partial` on `<html>`. Without the header, the client reads a full page.
4. The server decides when it cannot answer in part (a root layout change, a different build, a 404 or error route, a redirect) and sends the full page. The client never has to guess.
5. Streaming is unchanged: the first render ends at `</html>` and `#loading` bodies follow, with IDs above `x-brumate-base`.
6. Caching and prefetch follow the two answers in questions.md.

### Prior art (each choice, with the source at a pinned commit)

| Choice                                | Next.js                                                                                                                                                                                                                     | React Router                                                                                                                                                                                                       | Turbo                                                                                                                                                                            | htmx                                                                                                                                                                           | Astro, Marko Run                                | brumate                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------ |
| Client tells the server what it keeps | `next-router-state-tree` header, [app-router-headers.ts](https://github.com/vercel/next.js/blob/a86aeba10e7b32041ead6e252f807ad080166ef6/packages/next/src/client/components/app-router-headers.ts)                         | `?_routes=` filters the server loaders by route ID, [single-fetch.tsx](https://github.com/remix-run/react-router/blob/c9a237a0bd095714fd0111c7e49e18768e1eb8ba/packages/react-router/lib/dom/ssr/single-fetch.tsx) | `Turbo-Frame` header names one frame, [frame_controller.js](https://github.com/hotwired/turbo/blob/e1936dfeef1878a582b27e13bada5f74b9b2e575/src/core/frames/frame_controller.js) | `HX-Target` and `HX-Request` headers, [hx-target.md](https://github.com/bigskysoftware/htmx/blob/fa978b24e75fb03c137bf2cdae4fef0e711cf8a1/www/content/attributes/hx-target.md) | none: the whole document is fetched and swapped | `x-brumate-keep` header (decision 1)                                     |
| Server skips what is kept             | renders only from the changed segment, [parse-request-headers.ts](https://github.com/vercel/next.js/blob/a86aeba10e7b32041ead6e252f807ad080166ef6/packages/next/src/server/route-modules/app-page/parse-request-headers.ts) | skips the loaders of kept routes, [single-fetch.ts](https://github.com/remix-run/react-router/blob/c9a237a0bd095714fd0111c7e49e18768e1eb8ba/packages/react-router/lib/server-runtime/single-fetch.ts)              | the app renders the full page, the client extracts the frame                                                                                                                     | the app returns a fragment                                                                                                                                                     | n/a                                             | layouts run silently, output dropped (decision 2)                        |
| Response format                       | a stream of RSC payload, not HTML                                                                                                                                                                                           | turbo-stream data, not HTML                                                                                                                                                                                        | full HTML, frame cut by the client                                                                                                                                               | HTML fragment                                                                                                                                                                  | n/a                                             | the same HTML with region comments (decision 3)                          |
| Fallback when the server cannot       | full tree is sent when the client state is unknown                                                                                                                                                                          | the client calls the route loaders again                                                                                                                                                                           | the client reads the whole page for a frame miss                                                                                                                                 | the client swaps what it gets                                                                                                                                                  | n/a                                             | full page, marked by the missing `x-brumate-partial` header (decision 4) |
| Cache key                             | `Vary` on the router headers, [cache.ts](https://github.com/vercel/next.js/blob/a86aeba10e7b32041ead6e252f807ad080166ef6/packages/next/src/client/components/segment-cache/cache.ts) for the client side                    | a separate `.data` URL                                                                                                                                                                                             | none                                                                                                                                                                             | `Vary: HX-Request` advised                                                                                                                                                     | n/a                                             | see questions.md                                                         |

Notes: Marko Run and Astro only swap whole documents (Astro in `transitions/`), so they give no model. silmaril has no router. Turbo and htmx are the closest to "HTML comes back, the client swaps a part", and neither knows a nested route tree, which is why the client here sends the tree, as Next.js does.

## Children

| id                    | size     | depends_on                                    | role                                           |
| --------------------- | -------- | --------------------------------------------- | ---------------------------------------------- |
| route-render-split    | S, early | none                                          | moves the route rendering out of `server.ts`   |
| partial-measure       | M        | none                                          | harness and the baseline numbers               |
| partial-render-spike  | M, spike | none                                          | proves silent layouts and freezes the contract |
| partial-server-render | L        | split (hard), spike (contract)                | the server side                                |
| partial-client-apply  | L        | spike (contract)                              | the browser side                               |
| partial-prefetch      | M        | client-apply (hard), server-render (behavior) | prefetch of partial responses                  |
| partial-fallbacks     | L        | server-render, client-apply (behavior)        | every case that must stay full                 |
| partial-docs          | S        | prefetch, fallbacks, measure (behavior)       | docs, decision record, final numbers           |

Contract: [partial-route-response](../../contracts/partial-route-response.md).

## Acceptance

- [ ] A link between two docs pages that share layouts sends `x-brumate-keep`, gets an `x-brumate-partial: 1` response with only the changed routes, and swaps them. The kept layouts keep their DOM nodes and their state (a focused input in the layout stays focused).
- [ ] A form post, a reload (`visit.reload`), a build mismatch, a request without the header, a redirect, a 404, an error route and a static file all give the full page and the client swaps as today. One e2e case for each.
- [ ] Head entries, `<html>` attributes (`b-html`), state records and `#loading` bodies of the new routes arrive, and the title, announcer and focus move as today.
- [ ] Before and after, on the website docs between two pages that share layouts (for example `/docs/styles` to `/docs/context`), measured by `partial-measure` on the same machine: transfer bytes (raw and gzip) of the navigation response, and milliseconds from the click to the end of `replaceRoutes` (median of 20 runs, warm cache). The after numbers are in `partial-docs`'s outcome. Target: a response at most 50% of the full page bytes, and no slower swap. A miss is reported, not hidden.
- [ ] `pnpm test` at the root and `pnpm e2e` pass. A minor changeset (new behavior of the loader and server, with a new request header).

## Sizing

L as a story: server, browser, caching and prefetch, each with failure paths. Children carry their own size.
