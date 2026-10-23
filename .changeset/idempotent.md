---
'brumate': minor
---

`idempotent(fn)` from `brumate/server` makes a server function of a `'use server'` file run once for each form that the server renders for it. A second post of the same form, such as a double click or a post again after a reload, gets the result or the redirect of the first. With scripts, the form gets a new key after each answer. A form's `action` can now also be a server function that the component imports from a `'use server'` file.
