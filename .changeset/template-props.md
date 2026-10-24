---
'brumate': patch
---

A `#template` that a component gets as a prop now works with components inside it:

- The browser imports the components of the template, so a template that renders a component no longer throws when the browser renders it.
- The template renders where the component inserts it, as children do, so the components inside read the contexts that the component provides. This holds on the server and in the browser.
