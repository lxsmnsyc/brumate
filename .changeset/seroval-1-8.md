---
'brumate': minor
---

- brumate uses seroval 1.8.0 and imports from its `read`, `write` and `shared` entry points.
- The answer of a server function is a byte stream of `@seroval/transport`, in place of brumate's own chunks. A page and a server from before this version cannot read each other's calls.
- The server checks the fields of brumate's values in the arguments of a call. A malformed one answers 400 with `The arguments of the call are malformed`, where it was a generic 500.
- The first server function call loads about 2.4 kB gzip more JavaScript (42.2 to 44.7 kB for the call chunk): seroval 1.8 and its plugins add 1.3 kB and 2.0 kB raw, and the transport reader 2.9 kB raw over the old one. The page load does not change.
- A result that cannot be serialized goes to the `onError` of the app.
