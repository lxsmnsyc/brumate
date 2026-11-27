---
'brumate': patch
---

- A `#template` call that a signal, a store, a module signal or a prop holds now throws into the `#try` around its insert in the browser when a change makes its markup throw, as it does on the server. This holds for any insert expression that reads the value, such as `{box.row}` or `{c ? c : 0}`. The page shows the `#catch` body and no longer logs an uncaught error.
- A `#try` whose body inserts such a value now ships its `#catch` body and an error table, about 0.9 kB of raw code for each such component. This happens for a prop typed `unknown`, an object or a named type, and for a signal that does not start as a literal. A prop typed as strings, numbers or booleans, a plain member or element of a typed prop, a literal signal, a context value and `children` add nothing.
