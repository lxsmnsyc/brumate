---
'brumate': patch
---

Three fixes that make the browser render match the server render. A ref setter (`$bind(signal, fn)`) called after the render now calls the exported function of its component, not a copy of the render that wrote stale values. A memo that rejects inside a `#try` with a `#catch` no longer reaches `onError`, as on the server. A `class` with conditional classes before a static class keeps the order of the server.
