---
'brumate': patch
---

- A `#template` that a component calls again at the same place with new arguments, such as for an item of a list whose object changes, updates its markup in place, as a snippet of Svelte does, and keeps focus.
- A template at an insert updates in place only when it is the same template that the server rendered there. A template shown again after other content, and a switch between two templates of one component, render the right one.
- A `#template` that a component gets as a prop works with components inside it. The components read the contexts that the component provides, on the server and in the browser.
- Markup that streams in after a write, such as a `#loading` body, keeps the templates that it renders.
