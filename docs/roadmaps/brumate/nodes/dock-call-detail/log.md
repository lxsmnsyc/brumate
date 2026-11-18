# Log: dock-call-detail

- The context gives `drawCallDetail(entry)` only a log entry (time, kind, text), and a call outside a handler is stored nowhere else. So the entry now carries `call?: CallTiming` (set in both `add` calls of the fetch wrapper).
- Run again and Copy as fetch need what was sent. The record holds cut arguments and a form post decodes to an object, so it cannot be replayed. `CallTiming.request` keeps url, `content-type` and `x-brumate-*` headers, and a string or FormData body. Dev only.
- Styles are in a `<style>` inside the detail, not in `style.ts`, so no shared file is touched. Prototype variables missing from the current panel (`--bg2`, `--pink`, `--line2`) are set on `.calld`.
- Copy as fetch: a JSON body goes as `new Blob([json], { type: 'application/json' })`, so the call needs no `headers` key. A form post with files needs `x-brumate-args`, the only header written.
- "After the call" is the `write` lines of the log in the 300 ms after the answer. A heuristic: the record has no link from a result to its writes.
- Doubt: the Log redraws the whole list on `state.changed`, which removes an open detail (it appends under the list). The record arrives after the row, so the detail may lose its place when the record fills in. dock-activity owns that.
- Review round 1: styles copied from the prototype; the path line and the close button left out (see outcome); `printValue` now walks a copy with an ancestor set, since a replacer that returns a new object for a Map breaks `this` tracking.
