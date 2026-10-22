---
'brumate': minor
---

`brumate/events` wraps event handlers with what must happen before their code loads: `prevent(handler, ...keys)`, `stop(handler)`, `once(handler)` and `capture(handler)`. The compiler reads the wrappers in markup, so the loader applies them on the first event. On a keyboard event, `prevent` can name the keys to prevent, such as `onKeyDown=(prevent(move, 'ArrowDown', 'Enter'))`, and TypeScript checks the names. A modifier after the event name, such as `onSubmit:prevent`, still works, with a warning that points to the wrapper. A modifier on a component is now a compile error, since nothing applied it.
