# Log: dom-content-loaded

- Read the runtime: `<document>` and `<window>` handlers attach at the boot scan; the entry script is an `async` module.
- Built examples/todos with a temporary exact-case `onDOMContentLoaded` and ran it in Chrome: it did not run in three loads, and ran when the event was dispatched by hand. Reverted the temporary change.
- Ran a Chrome page for the `webkit*` animation and transition names: only the camel name fires.
- Added BRM201, the parser check, the type change and the tests. Regenerated the catalog files.
- Measured sizes, ran the checks, opened a draft PR.
