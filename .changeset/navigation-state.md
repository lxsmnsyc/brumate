---
'brumate': minor
---

`navigate(href, { replace, scroll })` from `brumate/routes` loads a page as a link does, and returns when it shows. `$route()` gives the URL, the query string and the params of the route, typed from the route files, on the server and in the browser, and updates when navigation changes it. `$navigation()` gives the navigation that loads, `{ pending, from, to }`. The loader sets `data-navigating` on `<html>` while a page loads. After a navigation, it announces the new page to screen readers in a live region, and moves the focus to the first `<h1>` of the new content, or to `<main>`, except when only the query string changes. `navigate: { focus: false }` in the plugin keeps the focus.
