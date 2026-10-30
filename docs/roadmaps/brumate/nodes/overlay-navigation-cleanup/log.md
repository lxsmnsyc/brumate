# Log

- Cause: a client navigation runs the cleanups of the page (leavePage, or removeScope for kept layouts) before it removes the markup. The `leave` cleanup of the three parts only released when the element was no longer connected, so it did nothing. Portal markup also stays behind on a route replace.
- Fix: the `$client` cleanup now releases unconditionally (`leavePage`) and removes the layer. The `$effect` cleanup keeps the connected check, since it also runs when the value changes.
- Tests: unmount a mounted page with a modal, popover and tooltip open; each failed before the fix (7 failures, including later tests that inherited the leftover state).
