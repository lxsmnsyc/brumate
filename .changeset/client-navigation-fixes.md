---
'brumate': patch
---

- A link that keeps the layout no longer loads the memos of the new page again after a value changed on the page before. Before, such memos called their server functions again.
- A redirect from a server function call or from the form of an `$action` now loads the page on the client, as a form without `$action` does, with a view transition of the type `form`. A redirect to another site, or with `navigate: false`, still loads the page in full.
- `unmount()` of `mount` from `brumate/testing` removes the scopes of the component from the client runtime. A refresh in a later test no longer loads the memos of components that unmounted.
- A `<window>` or `<document>` listener of markup that is gone, such as a page that client navigation replaced, no longer runs.
