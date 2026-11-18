---
goal: Choose brumate's next navigation model, partial route responses, a component-based client router, or keeping today's full-page swap
date: 2026-11-18
rounds: 3 of 3
status: proposed
roadmap: ../../roadmaps/brumate
supersedes: none
decision: none
---

# Debate: the next navigation model

## Settled structure

1. Keep today's full-page swap (`planRoutes`, `replaceRoutes` in `runtime/navigate.ts`). (A2, O16, P11)
2. No component-based client router. It would ship every page component to the browser and add a render path beside resume. Neither side argued for it. (P4, J6)
3. Park the partial-route-responses story. It restarts only when an app with a server asks for it, or when a throttled run of the navigation benchmark shows a wait a person would notice. (O15, O16, P11)
4. Run a throttled measurement of today's full page: Fast 4G and Slow 4G with a 4x CPU slowdown, using `benchmarks/navigation`. This takes one harness run and no node. Repeat it on the deduped page if the spike in step 5 passes. (P13, O7)
5. Run a gated spike on state dedupe. The server leaves out a long state string that its own markup already printed. First it must show that no prop change, `#key`, `#loading` reload or refresh renders a block again from a blanked string, and that it renders the same HTML as an unblanked page. A miss is a no-go and the full swap stays as it is. A pass leads to one M node. (P7, P12, O12)

## Budget

- device: one worker at a time. The machine has 8 GB RAM and 13 GB of free disk, and the load average ran at 10 to 28 with three workers. (J1)
- time: the spike and the measurement fit inside 0.9.0. The partial story's four L children leave the 0.9.0 critical path. (J8, O16)
- tokens: about 0.4M for the dedupe spike, about 0.3M for the dedupe node if it passes, and about 0.05M for the measurement. The partial story would have cost about 2.4M. (P12, P13, O5)
- simplicity: no new request header, response shape or second navigation path. (O16)
- app-value: the dedupe helps every page, static or served, and the first load too. The partial helped only apps with a server. (O11, J4)

## Rejected

- Partial responses as the main model: the measured saving on release/0.9 is 36.7% to 39.6% gzip, under the 40% gate fixed before the measure. It cannot reach the static website. (P1, beaten by O8, J4)
- Partial responses on top of the dedupe: they save about 13 KB a click, which is 12 to 65 ms. The harness cannot see that, and it costs about 2.1M tokens. (P8, P9, P10, beaten by O15)
- Static routes-only files: they give the same saving and add about 24 MB of deploy output. (P2, A1, beaten by O8, O10)
- Sending only the new route's state: the new route needs about 96% of the state record. (P5, beaten by O9)
- A component-based client router: it ships every page component, needs server-only components to run in the browser, and adds a render path beside resume. browser-await removed only the `await` part of that cost. (J6, J7, P4)

## Scope changes

- park partial-route-responses and its open children (partial-render-spike, partial-server-render, partial-client-apply, partial-prefetch, partial-fallbacks, partial-docs): see settled structure 3. (O16, P11)
- keep route-render-split (PR #522) and partial-measure (PR #521). The split helps server.ts whatever comes next, and the benchmark is the restart condition's tool.
- add state-dedupe-spike (gated) to 0.9.0 as a should. It adds no API, so it does not count as a feature. (P12)
- 0.9.0 goes from 10 features to 9.

## Proofs

- None. Every claim was settled by measurement on a release/0.9 build (d713634e).

## Prior art

- Next.js app router: it sends the router state in a request header and renders from the changed segment. It hashes those headers into `_rsc`, because CDNs ignore `Vary`. (P1, O13)
- React Router single fetch and Qwik Router: they prerender `.data` and `q-route.json` files for static sites. (P2)
- htmx issues 724 and 497: a fragment was served as the full page on tab restore and on reload. (O4)
- Marko Run, the closest resumable framework, does full-document navigations. (J6)

## Open risks

- Dedupe safety (O12): spike. A block that renders again from a prop must never read a blanked string.
- Whether navigation is slow on real links (O7): measurement. This is settled structure 4, and it is also the restart condition of the partial story.

## Inferred choices

- Size does not decide; simplicity and app value do (J9): from GOAL.md Constraints (2026-11-12, 2026-11-02) and Outcome (from 0.9.0).
- The website is static (J4): from website/vercel.json and website/vite.config.ts.

## Answers from the user

- None asked. The 2026-11-18 answers on caching and prefetch (never cache partials; prefetch the partial on hover) belong to the parked story.

## Overruled

- none

## Cost of this debate

- 3 of 3 rounds, about 235,000 tokens, plus about 145,000 for the partial-measure baseline.
