---
'brumate': minor
---

The browser now loads the code of the components on the page when the page starts, instead of on the first event. A function of another component, such as a function prop, a function in a context or a template, then runs at once and returns its result, as on the server. Before, it returned a promise, so a child that used its result, such as a `filter`, got a promise instead.

A build groups the client code into one bundle for each root component, such as a route, and a page of `handleRoute` preloads the bundles of its views, so the code of a page comes in one request with the HTML.
