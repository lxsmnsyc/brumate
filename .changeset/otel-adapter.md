---
'brumate': minor
---

- `brumate/otel` exports `otel()`, an `onTrace` handler that makes an OpenTelemetry span for each brumate span, with its name, attributes, times, status and error message.
- A request with a `traceparent` header keeps that parent.
- `@opentelemetry/api` is an optional peer dependency. Without it, `otel()` throws once and names the package.
- Each span has the attributes `brumate.trace_id`, `brumate.span_id` and `brumate.parent_id`. The ids in the exporter come from the SDK's `IdGenerator` and differ from these. The span tree is the same.

```ts
// src/middleware.ts
import { otel } from 'brumate/otel';
export const onTrace = otel({ tracerName: 'brumate' });
```
