---
'brumate': minor
---

The browser loads the code of the components on the page when the page starts, instead of on the first event. A function of another component, such as a function prop, a function in a context or a template, then runs at once and returns its result, as on the server. Before, it returned a promise, so a child that used its result, such as a `filter`, got a promise. A build groups the client code into one bundle for each root component, and a page of `handleRoute` preloads the bundles of its views.

Breaking: the features that loaded code early are removed.

- The `prefetch` attribute is a compile error.
- The loader no longer preloads handlers on hover, near the viewport or when the browser is idle, and the `preload` option of the plugin and the loader is gone.
- `brumate report` no longer lists what each handler loads, and `budget.event` is gone.
- The devtools have no Loading tab. `data-prefetch="none"` on a link still turns off the prefetch of its page for navigation.
