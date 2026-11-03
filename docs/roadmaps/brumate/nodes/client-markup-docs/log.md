# Log: client-markup-docs

- Wrote test/client-order.test.ts with fixtures clientOrder.brm and ClientOrderPart.brm (own mini harness, based on resume.test.ts).
- Test passes: callback runs after markup is in the page, in markup order; cleanups run in markup order on close; reopen runs fresh callbacks; page callback runs once.
- Added "A component that the browser renders" under `$client` in effects.md.
- Self review: 0 rounds needed beyond the writing pass. Not tested here: 'visible' for a part that opens (other tests cover visible).
