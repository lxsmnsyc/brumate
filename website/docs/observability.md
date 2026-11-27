---
type: concept
---

# Observability

`onTrace(span)` receives each span of the server and of the browser when it ends, with its name, its times and its trace. Use it to see where the time of a request or a click goes, or to send the spans to OpenTelemetry. Nothing runs, and no code ships for it, until you set it.

## On the server

Export `onTrace` from `src/middleware.ts`, next to `onError`:

```ts
// src/middleware.ts
import type { TraceSpan } from 'brumate/server';

export function onTrace(span: TraceSpan) {
  if (span.end - span.start > 200) {
    console.warn(`slow ${span.name} ${span.label}: ${Math.round(span.end - span.start)} ms`);
  }
}
```

The server calls it with each span of a request: the request, its render, each memo that loaded, each server function that ran, and each `#loading` or `#defer` body. A call outside a Vite app passes the same function as the `onTrace` option of `handleRequest`.

- A span is handed over once, when it ends, so a child comes before its parent. It is a finished record, not a live span: there is no way to add attributes while the work runs.
- A throw or a rejection of `onTrace` is logged with `console.error`. It does not change the answer and does not reach `onError`.
- The server does not wait for an `async` handler. On a host that stops the work when the response ends, a handler that awaits a slow export can be cut off, because `onTrace` is not given to `waitUntil`. Keep it short.
- A span that fails has `status: 'error'` and `error.message`, with no stack. `onError` still runs. A `ServerError` or a redirect is an answer, not a fault, so it gives `ok`.

## In the browser

Pass `onTrace` to `start` in the script that starts the loader:

```ts
// src/client.ts
import { start } from 'brumate/loader';
import { load } from 'virtual:brumate/manifest';

start({
  load,
  onTrace(span) {
    navigator.sendBeacon('/spans', JSON.stringify(span));
  },
});
```

The browser spans are the event (`brumate.event`), the code the handler needed (`brumate.load`), the handler (`brumate.run`), a server function call (`brumate.fetch`) and a navigation (`brumate.navigation`). `brumate.load` appears only for a handler whose code had to load, so a slow first click shows its load apart from its run. Its types come from `brumate/client`.

The build removes this code from every page whose app has no browser `onTrace`: the Vite plugin sets a build constant from the scan of `src/`. If your script that starts the loader is outside `src/`, or the build warns that it cannot find the `onTrace`, set the plugin option `trace`:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [brumate({ trace: true })],
});
```

`trace: false` leaves the spans out even when `onTrace` is set. With `'auto'`, the default, the dev server always has the spans on.

## One trace for a click

When the browser has an `onTrace`, a server function call and a navigation send a `traceparent` header, so the server span of the request is a child of the browser span. A click that calls a server function gives one trace:

```brm live
<script>
  import { $signal } from 'brumate/signals';

  async function save(title: string) {
    'use server';
    return title.length;
  }

  let length = $signal(0);

  async function press() {
    length = await save('milk');
  }
</script>

<button onClick=press>Save {length}</button>
```

```text
brumate.event    click App#press            browser
  brumate.load   App                        only when the code had to load
  brumate.run    App#press
    brumate.fetch   save
      brumate.request  POST /_brumate/save  server, same traceId
        brumate.call   save
```

A call or a navigation joins the trace of a handler only when the handler makes it before its first `await`. After an `await`, or from a memo or a form, it starts a trace of its own, so a span never joins the wrong handler. A link that was prefetched sends no header, as the request ran before the click.

A page with `onTrace` does not load the page of a link early on hover or focus, since that request would carry no `traceparent`: each navigation requests its page when it starts. A request to another origin sends no `traceparent`, so the other site does not learn the trace. The server reads an incoming `traceparent` even when the browser does not trace: a valid one sets the `traceId` of the request and the `parentId` of its root span, and an invalid one is ignored.

## Spans

| Name                 | Where   | What it times                                          | Attributes                                                              |
| -------------------- | ------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `brumate.request`    | server  | a request: page, call, form, endpoint or `#defer` body | `http.method`, `http.route`, `http.status_code`, `brumate.kind`         |
| `brumate.render`     | server  | the render of a page                                   |                                                                         |
| `brumate.stream`     | server  | the rest of the page, after the first bytes            |                                                                         |
| `brumate.memo`       | server  | a server memo that loaded                              |                                                                         |
| `brumate.call`       | server  | a server function that ran                             |                                                                         |
| `brumate.body`       | server  | a `#loading` or `#defer` body                          |                                                                         |
| `brumate.event`      | browser | from the event to the end of its handler               | `brumate.event.type`                                                    |
| `brumate.load`       | browser | the code a handler needed, loaded                      |                                                                         |
| `brumate.run`        | browser | the handler itself                                     |                                                                         |
| `brumate.fetch`      | browser | a server function call, as the browser sees it         | `http.method`, `http.route`, `http.status_code`                         |
| `brumate.navigation` | browser | a navigation, from the request to the DOM update       | `http.method`, `http.route` (page with route state), `http.status_code` |

Every span has this shape:

```ts
interface TraceSpan {
  name: TraceName;
  label: string; // such as `GET /todos`, `Todos#add`, `click`
  traceId: string; // 32 hex characters
  spanId: string; // 16 hex characters
  parentId?: string;
  start: number; // epoch milliseconds, with a fraction
  end: number;
  status: 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
  error?: { message: string };
}
```

`brumate.kind` is `page`, `call`, `form`, `endpoint` or `defer`. On the server, render and stream are children of the request, and memo, call and body are children of the latest render. The request span ends when its response has been read to the end. When the reader leaves or the request aborts, the spans still open end as `error` with the reason.

## OpenTelemetry

`otel()` from `brumate/otel` returns an `onTrace` that makes one OpenTelemetry span for each brumate span. Install the API and set up the SDK in your app, as for any OpenTelemetry code:

```sh
npm install @opentelemetry/api
```

```ts
// src/middleware.ts
import { otel } from 'brumate/otel';

export const onTrace = otel({ tracerName: 'my-app' });
```

`@opentelemetry/api` is an optional peer dependency. `brumate/otel` is the only part that imports it, so an app without the adapter never loads it. Without the package, the first span makes the handler throw an error that names it.

- The adapter keeps the names, attributes, times and the tree of one trace. `brumate.request` is a server span, `brumate.fetch` and `brumate.navigation` are client spans, and the rest are internal.
- Every span also has `brumate.label`, and `brumate.trace_id`, `brumate.span_id` and `brumate.parent_id`. The SDK makes the real ids, so the ids in your exporter differ from the ones `onTrace` gets. Use these attributes to match them.
- A failed span has the error status, with the message and an `exception` event. There is no stack.
- A child waits for its parent, because spans arrive child first. A parent that ends after the process stops, or that never ends, loses its waiting children on shutdown. After 60 seconds a child whose parent has not arrived is exported as a root, on the next span. At most 10,000 spans wait.
- The adapter does not read trace flags, so an incoming `traceparent` that is marked as not sampled is exported as sampled. Do the sampling in the SDK, or in your own `onTrace` before you call the adapter.

The adapter is tested on the server only. To trace the browser, send its spans to your server.

## What is never recorded

- Arguments and results of server functions, cookies, headers, and the query string.
- A route is its pattern, such as `GET /items/[id]`, never the URL. A navigation that has no route state is `GET` with no `http.route`.
- An error has its message only, never a stack.

The message of an error can still hold a value that your code put in it.

## What it costs

- With no `onTrace` on the server, a request makes no span and no `traceparent` is read for it. The server checks one field before it makes a span.
- With no `onTrace` in the browser, the build leaves the spans, the header and the `traceparent` code out. A page has the same bytes as before.
- With `onTrace` in the browser, the code adds about 1.2 kB gzip to the loader and the core, and each call and navigation sends one header of about 55 bytes.

Not done: metrics, logs, a hosted exporter, and sampling. Your `onTrace` decides which spans to keep.
