# Questions: observability

## 1. Should the browser send `traceparent` with server calls and navigations?

A click that calls a server function makes a browser span and a server span. Joining them in one trace needs the browser to send the W3C `traceparent` header on the request, so the server span has the browser span as its parent.

Options:

- A. Send it when the browser has an `onTrace` (default `traceparent` of the span that sent the request). One header of about 55 bytes per call and per navigation. The server (`observability-core`) reads it whether or not the browser traces. Who does it: `observability-browser` writes the header in `rpc.ts` `post` and in the navigation fetch (`navigate.ts`); `observability-core` reads it. Like OpenTelemetry's fetch instrumentation, which propagates to same-origin URLs by default.
- B. Never send it. Browser and server spans are separate traces, joined by the app with an attribute such as the call ID. Nothing changes in `rpc.ts` or `navigate.ts`, and the cache keys of `GET` navigations stay as they are. Who does it: `observability-browser` only; core still reads an incoming header from a caller outside the app.
- C. A start option, `onTrace` plus `propagate: true`. Same code as A with a second switch. Who does it: as A, plus the option in `virtual:brumate/start` and the docs.

Recommendation: A. The reason to have both sides is one trace for a slow click, and a header that only exists when the app opted in to tracing costs nothing for others. C adds an option for a case (tracing the browser but hiding the link) that no one has asked for.

If you do not answer, the children build A.
