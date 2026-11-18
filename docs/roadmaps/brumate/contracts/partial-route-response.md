---
name: partial-route-response
version: 1
status: draft
defined_by: partial-render-spike
---

# Contract: partial-route-response

## Purpose

How the browser asks for only the routes that change, and the shape of the answer. Used by partial-server-render, partial-client-apply, partial-prefetch, partial-fallbacks and the e2e tests. The spike may change names while it runs; the version rises when it freezes.

## Interface

Request headers on a GET navigation (a link, back, forward, prefetch):

```
x-brumate-base: <next free scope ID>          (exists today)
x-brumate-keep: <tree>
```

`<tree>` lists the route slots of the current page, nested in the order of the `<!--R-->` comments:

```
tree   = slot ( "," slot )*
slot   = name ":" key ":" layoutScope ":" routeScope [ "(" tree ")" ]
```

`name` is the slot name, `key` is `encodeURIComponent(slot.key)`, `layoutScope` and `routeScope` are the numbers in the region comment (`R<layoutScope>:<name>:<routeScope>:<key>`). The client builds it from `regions(document.body)` (`runtime/navigate.ts`). A page of another build sends the build in `x-brumate-build`.

Response, when the server answers in part:

```
status: 200
content-type: text/html; charset=utf-8
x-brumate-partial: 1
vary: x-brumate-base, x-brumate-keep, x-brumate-defer
```

Body: a normal HTML document (`<html b-partial>`, head, body) in which

- the head and the `<html>` attributes are those of the whole next page (`b-html` list included), so `updateHead` and the attribute copy stay as they are;
- the body holds only the changed regions, one after another, each as `<!--R<layoutScope>:<name>:<routeScope>:<key>--> ... <!--/R-->`, where `layoutScope` is the scope of the kept layout in the client's page, taken from the request;
- the state records of the new routes follow, with `b-root` equal to `x-brumate-base`;
- later markup (`#loading` bodies, `#defer`) streams after `</html>` as today.

Without `x-brumate-partial: 1` the body is a full page, and the client treats it as today.

## Behavior

- A slot is kept when the name and key match the next route's slot at the same depth, and all its parents are kept. The first slot that differs is replaced with everything below it.
- Kept layouts run on the server for their contexts. Their markup, state records and IDs are dropped, and IDs of new routes start at `x-brumate-base`.
- The server answers in full when: the header is missing or does not parse, the build differs, the root route differs, no slot is replaced, the route is a 404, an error route or a redirect, or the request is not GET.
- Errors in a new route use the error route as a full page.
- The page cache and shared caches follow the decision in `nodes/partial-route-responses/questions.md`.

## Stub

`packages/brumate/test/partial/fixtures/` (written by partial-render-spike): a route tree with two layouts and two pages, and the expected partial body for one link.

## Contract tests

`packages/brumate/test/partial/contract.test.ts` (partial-server-render) and the e2e suite `e2e/suites/partial.mjs` (partial-fallbacks).

## Changes

- v1: initial draft.
