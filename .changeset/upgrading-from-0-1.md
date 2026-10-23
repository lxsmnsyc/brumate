---
'brumate': minor
---

**Upgrading from 0.1.** These changes need attention:

- The page format changed. The scopes inside blocks and `#loading` bodies have IDs such as `4.0`, so the client of one version cannot resume a page that another version rendered. Deploy the server and the client build together. Skew protection loads such a page again in full.
- Event handlers run as if each element had its own listener. `:capture` handlers run first, and an event that does not bubble, such as `focus`, no longer runs the handlers of the elements around its target.
- A modifier after an event name, such as `onSubmit:prevent`, still works, with a warning. Use the wrappers of `brumate/events` instead. A modifier on a component is now a compile error.
- `URL` and `URLSearchParams` use the plugins of `seroval-plugins` in place of brumate's own, so state that a page of 0.1 wrote does not resume with 0.2.
