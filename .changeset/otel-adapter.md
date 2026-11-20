---
'brumate': minor
---

`brumate/otel` exports `otel()`, a handler for `onTrace` that makes an OpenTelemetry span for each brumate span, with its name, attributes, times, status and error message. A request that has a `traceparent` header keeps that parent. `@opentelemetry/api` is an optional peer dependency; without it, `otel()` throws once and names the package. Every span also has the attributes `brumate.trace_id`, `brumate.span_id` and `brumate.parent_id`. The SDK's `IdGenerator` makes the ids, and it cannot be set from here, so ids in the exporter differ from the ones `onTrace` gets; the tree is the same, and the three attributes carry the brumate ids.

```ts
// src/middleware.ts
import { otel } from 'brumate/otel';
export const onTrace = otel({ tracerName: 'brumate' });
```
